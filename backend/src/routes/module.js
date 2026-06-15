// file path: backend/src/routes/module.js
//
// [fix #13] Renamed from learning.js → module.js. Route prefix: /api/module
// Handles module progress and completion only.
// All quiz endpoints live in routes/quiz.js.
//
// Changes from learning.js:
//   [fix #4]  Milestone notification uses type 'all_modules_completed' — no longer
//             collides with 'student_progress' perfect-score notifications.
//   [fix #5]  evaluateAndPersist and all notifications are fire-and-forget.
//   [fix #6]  recentAttempts query gains module_id range filter.
//   [fix #11] isStudent replaced with shared studentOnly middleware.
//
// Audit fixes applied here:
//   [audit #1] Milestone notification dedup now scoped to (instructor, student) pair
//              via a student-specific link field. Previously deduped on (user_id, type)
//              only — the first student to complete all modules permanently suppressed
//              all subsequent notifications for every other student.
//   [audit #2] GET /progress gains studentOnly middleware — route semantics are
//              student-only; instructors hitting this endpoint received their own
//              empty stats with no error signal.
//   [fix D]    Removed double-ROUND from avg_percentage in GET /progress.
//              ROUND(AVG(ROUND(...))) discretizes each attempt's percentage before
//              averaging, introducing systematic rounding bias. Correct form:
//              ROUND(AVG((score / total_questions) * 100)).

const express           = require('express');
const router            = express.Router();
const pool              = require('../db');
const authenticateToken = require('../middleware/auth');
const studentOnly       = require('../middleware/studentOnly'); // [fix #11]
const { createNotification } = require('../utils/notifications');
const { TOTAL_MODULES }      = require('../utils/gamification');
const { evaluateAndPersist } = require('../utils/achievementUtils');

function validateModuleId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_MODULES ? n : null;
}

// ══════════════════════════════════════════════════════════════════════════
// GET /api/module/module-progress
// Returns per-module completion state for the current student.
// ══════════════════════════════════════════════════════════════════════════
router.get('/module-progress', authenticateToken, studentOnly, async (req, res) => {
  try {
    const [progress] = await pool.query(
      `SELECT module_id,
              (completed_at IS NOT NULL) AS completed,
              completed_at
       FROM module_progress
       WHERE user_id = ?
         AND module_id BETWEEN 1 AND ?`,
      [req.user.id, TOTAL_MODULES]
    );
    res.json(progress);
  } catch (err) {
    console.error('module-progress error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'MODULE_PROGRESS_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// POST /api/module/modules/:id/complete-module
// Marks a module completed. Idempotent — safe to call multiple times.
// ══════════════════════════════════════════════════════════════════════════
router.post('/modules/:id/complete-module', authenticateToken, studentOnly, async (req, res) => {
  const moduleId = validateModuleId(req.params.id);
  if (!moduleId) return res.status(400).json({ error: 'INVALID_MODULE_ID' });

  try {
    // INSERT ... ON DUPLICATE KEY UPDATE:
    //   affectedRows=1, changedRows=0 → fresh insert (newly completed)
    //   affectedRows=2, changedRows=1 → first-time update (NULL→NOW())
    //   affectedRows=2, changedRows=0 → repeat call, already completed
    const [result] = await pool.query(
      `INSERT INTO module_progress (user_id, module_id, completed_at)
       VALUES (?, ?, NOW())
       ON DUPLICATE KEY UPDATE
         completed_at = IF(completed_at IS NULL, NOW(), completed_at)`,
      [req.user.id, moduleId]
    );

    const wasNewlyCompleted = result.affectedRows === 1 || result.changedRows === 1;

    if (wasNewlyCompleted) {
      const [[{ done }]] = await pool.query(
        `SELECT COUNT(DISTINCT module_id) AS done
         FROM module_progress
         WHERE user_id = ? AND completed_at IS NOT NULL AND module_id BETWEEN 1 AND ?`,
        [req.user.id, TOTAL_MODULES]
      );

      if (Number(done) === TOTAL_MODULES) {
        // [fix #5] All-modules milestone notification — fire-and-forget IIFE.
        // Failure must not block the completion response.
        ;(async () => {
          try {
            const [[student]] = await pool.query(
              'SELECT full_name FROM users WHERE id = ?', [req.user.id]
            );
            const studentName = student?.full_name || 'A student';

            const [instructors] = await pool.query(
              `SELECT DISTINCT c.instructor_id
               FROM courses c
               JOIN course_enrollments ce ON ce.course_id = c.id
               WHERE ce.student_id = ? AND ce.status = 'accepted'`,
              [req.user.id]
            );

            // [audit #1] Link encodes the completing student's ID so the dedup check
            // is scoped to (instructor_id, student_id) — not per-instructor globally.
            const notifLink = `/instructor/dashboard?student=${req.user.id}`;

            for (const { instructor_id } of instructors) {
              const [existing] = await pool.query(
                `SELECT id FROM notifications
                 WHERE user_id = ? AND type = 'all_modules_completed' AND link = ?
                 LIMIT 1`,
                [instructor_id, notifLink]
              );
              if (existing.length === 0) {
                await createNotification({
                  userId:  instructor_id,
                  type:    'all_modules_completed',
                  title:   'Student Milestone',
                  message: `${studentName} completed all ${TOTAL_MODULES} learning modules.`,
                  link:    notifLink,
                });
              }
            }
          } catch (err) {
            console.error('milestone notification error', { userId: req.user.id, err: err?.message });
          }
        })();
      }

      // [fix #5] Achievement evaluation — fire-and-forget.
      evaluateAndPersist(req.user.id).catch(err =>
        console.error('achievement eval error', { userId: req.user.id, err: err?.message })
      );
    }

    res.json({
      success:         true,
      message:         'Module marked as completed',
      newly_completed: wasNewlyCompleted,
    });
  } catch (err) {
    console.error('complete-module error', { userId: req.user.id, moduleId, err: err.message });
    res.status(500).json({ error: 'COMPLETE_MODULE_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/module/progress
// Aggregated learning progress: module counts + quiz summary + recent attempts.
//
// [audit #2] Added studentOnly — this endpoint's semantics are student-only.
// [fix D]    avg_percentage uses ROUND(AVG(...)) without inner ROUND to avoid
//            systematic rounding bias from discretizing each attempt's percentage
//            before averaging. Same fix already applied in leaderboard.js.
// ══════════════════════════════════════════════════════════════════════════
router.get('/progress', authenticateToken, studentOnly, async (req, res) => {
  try {
    const [[moduleStats]] = await pool.query(
      `SELECT COUNT(*) AS completed_modules
       FROM module_progress
       WHERE user_id = ? AND completed_at IS NOT NULL
         AND module_id BETWEEN 1 AND ?`,
      [req.user.id, TOTAL_MODULES]
    );

    const [[quizStats]] = await pool.query(
      `SELECT
         COUNT(DISTINCT module_id)                        AS modules_with_attempts,
         COUNT(*)                                         AS total_attempts,
         ROUND(AVG((score / total_questions) * 100))      AS avg_percentage,
         MAX(score)                                       AS best_score
       FROM quiz_attempts
       WHERE user_id = ?
         AND module_id BETWEEN 1 AND ?`,
      [req.user.id, TOTAL_MODULES]
    );

    // [fix #6] Added module_id range filter — missing in original learning.js
    const [recentAttempts] = await pool.query(
      `SELECT id, module_id, score, total_questions, passed, time_spent,
              xp_earned, is_first_pass, created_at,
              ROUND((score / total_questions) * 100) AS percentage
       FROM quiz_attempts
       WHERE user_id = ?
         AND module_id BETWEEN 1 AND ?
       ORDER BY created_at DESC
       LIMIT 10`,
      [req.user.id, TOTAL_MODULES]
    );

    res.json({
      success: true,
      stats: {
        completed_modules:     moduleStats.completed_modules,
        total_modules:         TOTAL_MODULES,
        modules_with_attempts: quizStats.modules_with_attempts,
        total_quiz_attempts:   quizStats.total_attempts,
        avg_percentage:        quizStats.avg_percentage || 0,
        best_score:            quizStats.best_score     || 0,
      },
      recentAttempts,
    });
  } catch (err) {
    console.error('module progress error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'MODULE_PROGRESS_FAILED' });
  }
});

module.exports = router;
