// file path: CvSUHimayV2\backend\src\routes\student.js

const express = require('express');
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
// Fix 3: import requireActiveAccount to block suspended/pending accounts on attempt writes
const { requireActiveAccount } = require('../middleware/auth');
const { updateStreak } = require('../utils/gamification');
// Fix 1: import evaluateAndPersist so simulation attempts trigger achievement evaluation
const { evaluateAndPersist } = require('../utils/achievementUtils');
const studentOnly = require('../middleware/studentOnly');
const router = express.Router();

// Maximum wall-clock time for a simulation run. Enforced server-side to prevent
// a client from submitting duration_seconds = 1 on every run to exploit Speed Demon.
// 3600 s (1 hour) is far above any realistic deboning session.
const MAX_DURATION_SECONDS = 3600;

// ==================== COURSE / INSTRUCTOR BROWSING ====================

// Get all available instructors (with their active courses)
router.get('/instructors', authMiddleware, studentOnly, async (req, res) => {
  try {
    const [instructors] = await pool.query(
      `SELECT
        u.id,
        u.full_name,
        u.email,
        u.created_at,
        COUNT(DISTINCT CASE WHEN ce.status = 'accepted' THEN ce.student_id END) AS student_count
       FROM users u
       LEFT JOIN courses c  ON c.instructor_id = u.id AND c.status = 'active'
       LEFT JOIN course_enrollments ce ON ce.course_id = c.id
       WHERE u.role = 'instructor'
       GROUP BY u.id
       ORDER BY u.full_name`,
      []
    );
    res.json({ instructors });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch instructors', details: e.message });
  }
});

// Get all courses the student has an enrollment row for (with instructor info)
// Fix 2: course_code removed — it is a join credential, not a display field
router.get('/my-instructors', authMiddleware, studentOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT
        u.id          AS instructor_id,
        u.full_name,
        u.email,
        c.id          AS course_id,
        c.name        AS course_name,
        ce.status,
        ce.enrolled_at  AS requested_at,
        ce.responded_at
       FROM course_enrollments ce
       JOIN courses c  ON ce.course_id  = c.id
       JOIN users u    ON c.instructor_id = u.id
       WHERE ce.student_id = ?
       ORDER BY ce.enrolled_at DESC`,
      [req.user.id]
    );
    res.json({ instructors: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch instructors', details: e.message });
  }
});

// Get all active courses for a specific instructor (so student can pick which to join)
// Fix 2: course_code removed — a student browsing courses has not yet been given the code
router.get('/instructors/:instructorId/courses', authMiddleware, studentOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT
        c.id, c.name, c.description, c.status,
        ce.status AS enrollment_status
       FROM courses c
       LEFT JOIN course_enrollments ce
         ON ce.course_id = c.id AND ce.student_id = ?
       WHERE c.instructor_id = ? AND c.status = 'active'
       ORDER BY c.name`,
      [req.user.id, req.params.instructorId]
    );
    res.json({ courses });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch courses', details: e.message });
  }
});

// ==================== PROFILE MANAGEMENT ====================

router.put('/profile', authMiddleware, studentOnly, async (req, res) => {
  const { experience_level, bio } = req.body;

  try {
    // bio stays on users; experience_level lives in student_profiles
    const userUpdates = [];
    const userValues  = [];

    if (bio !== undefined) {
      userUpdates.push('bio = ?');
      userValues.push(bio);
    }

    if (userUpdates.length > 0) {
      userValues.push(req.user.id);
      await pool.query(`UPDATE users SET ${userUpdates.join(', ')} WHERE id = ?`, userValues);
    }

    if (experience_level && ['beginner', 'some', 'intermediate', 'advanced'].includes(experience_level)) {
      await pool.query(
        `INSERT INTO student_profiles (user_id, experience_level)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE experience_level = VALUES(experience_level)`,
        [req.user.id, experience_level]
      );
    }

    if (userUpdates.length === 0 && !experience_level) {
      return res.status(400).json({ error: 'No valid fields to update' });
    }

    res.json({ message: 'Profile updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update profile', details: e.message });
  }
});

// ==================== ATTEMPTS TRACKING ====================

router.get('/attempts', authMiddleware, studentOnly, async (req, res) => {
  try {
    const [attempts] = await pool.query(
      `SELECT id, score, hints_used, course_id, completed, duration_seconds, created_at
         FROM attempts WHERE user_id = ? AND completed = 1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ attempts });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch attempts', details: e.message });
  }
});

// ==================== DASHBOARD STATISTICS ====================

router.get('/dashboard/stats', authMiddleware, studentOnly, async (req, res) => {
  try {
    const [totalAttempts] = await pool.query(
      'SELECT COUNT(*) as count FROM attempts WHERE user_id = ? AND completed = 1',
      [req.user.id]
    );

    const [avgScore] = await pool.query(
      'SELECT AVG(score) as avg_score FROM attempts WHERE user_id = ? AND completed = 1',
      [req.user.id]
    );

    const [bestScore] = await pool.query(
      'SELECT MAX(score) as best_score FROM attempts WHERE user_id = ? AND completed = 1',
      [req.user.id]
    );

    const [recentAttempts] = await pool.query(
      `SELECT id, score, hints_used, course_id, completed, duration_seconds, created_at
         FROM attempts WHERE user_id = ? AND completed = 1 ORDER BY created_at DESC LIMIT 5`,
      [req.user.id]
    );

    const [enrolledCourses] = await pool.query(
      'SELECT COUNT(*) as count FROM course_enrollments WHERE student_id = ? AND status = "accepted"',
      [req.user.id]
    );

    res.json({
      stats: {
        total_attempts:   totalAttempts[0].count,
        average_score:    avgScore[0].avg_score ? Math.round(avgScore[0].avg_score) : 0,
        best_score:       bestScore[0].best_score || 0,
        enrolled_courses: enrolledCourses[0].count,
        recent_attempts:  recentAttempts,
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch statistics', details: e.message });
  }
});

// ── Attempts router (mounted at /api/attempts in server.js) ──────────────

const attemptsRouter = express.Router();

// Fix 1: accept all schema columns; validate all inputs; enforce enrollment gate
// Fix 3: requireActiveAccount blocks suspended/pending accounts from writing attempts
attemptsRouter.post('/', authMiddleware, requireActiveAccount, async (req, res) => {
  const {
    score,
    hints_used      = 0,
    course_id       = null,
    completed       = false,
    duration_seconds = 0,
  } = req.body;

  // score must be an integer 0–100 (percentage stored, not raw points)
  if (!Number.isInteger(score) || score < 0 || score > 100) {
    return res.status(400).json({ error: 'score must be an integer between 0 and 100' });
  }
  // hints_used: count of hint accesses, non-negative integer
  if (!Number.isInteger(hints_used) || hints_used < 0) {
    return res.status(400).json({ error: 'hints_used must be a non-negative integer' });
  }
  // Fix 3: enforce upper bound — prevents Speed Demon exploit via fabricated low durations
  // and caps obviously invalid submissions (e.g. duration_seconds = 999999).
  if (!Number.isInteger(duration_seconds) || duration_seconds < 0 || duration_seconds > MAX_DURATION_SECONDS) {
    return res.status(400).json({ error: `duration_seconds must be an integer between 0 and ${MAX_DURATION_SECONDS}` });
  }

  try {
    let resolvedCourseId = course_id;

    if (resolvedCourseId !== null) {
      // Explicit course_id: validate it is a positive integer and the student is enrolled.
      const courseIdNum = Number(resolvedCourseId);
      if (!Number.isInteger(courseIdNum) || courseIdNum < 1) {
        return res.status(400).json({ error: 'course_id must be a positive integer' });
      }
      const [[enrollment]] = await pool.query(
        `SELECT id FROM course_enrollments
         WHERE course_id = ? AND student_id = ? AND status = 'accepted'`,
        [courseIdNum, req.user.id]
      );
      if (!enrollment) {
        return res.status(403).json({ error: 'Not enrolled in this course' });
      }
    } else {
      // No course_id provided — auto-resolve from the student's most recent accepted
      // enrollment so sim/sessions can always link the attempt to a course for analytics.
      // Without this, POST /api/sim/sessions rejects with 422 (attempt.course_id null).
      const [[enrollment]] = await pool.query(
        `SELECT course_id FROM course_enrollments
         WHERE student_id = ? AND status = 'accepted'
         ORDER BY enrolled_at DESC LIMIT 1`,
        [req.user.id]
      );
      resolvedCourseId = enrollment?.course_id ?? null;
    }

    // Write all schema columns — course_id links attempt to instructor analytics
    const [insertResult] = await pool.query(
      `INSERT INTO attempts (user_id, score, hints_used, course_id, completed, duration_seconds)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [req.user.id, score, hints_used, resolvedCourseId, completed ? 1 : 0, duration_seconds]
    );

    updateStreak(req.user.id, pool).catch(err =>
      console.error('streak update error', { userId: req.user.id, err: err?.message ?? String(err) })
    );

    // Fix 1: evaluate achievements after every simulation attempt so simulation-category
    // achievements (Lab Rat, Speed Demon, streak tiers, etc.) fire at the right moment.
    // Awaited so newlyUnlocked is available in the response for the completion screen.
    // Failure must not block or reverse the saved attempt.
    let newlyUnlocked = [];
    try {
      newlyUnlocked = await evaluateAndPersist(req.user.id);
    } catch (achErr) {
      console.error('achievement eval error', { userId: req.user.id, err: achErr?.message });
    }

    res.json({ message: 'Attempt saved', id: insertResult.insertId, newlyUnlocked });
  } catch (e) {
    res.status(500).json({ error: 'Save failed', details: e.message });
  }
});

attemptsRouter.get('/', authMiddleware, requireActiveAccount, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, score, hints_used, course_id, completed, duration_seconds, created_at
         FROM attempts WHERE user_id = ? AND completed = 1 ORDER BY created_at DESC`,
      [req.user.id]
    );
    res.json({ attempts: rows });
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

// ── Rules router (mounted at /api/rules in server.js) ────────────────────

const rulesRouter = express.Router();

rulesRouter.get('/', authMiddleware, async (_req, res) => {
  try {
    const [rows] = await pool.query('SELECT id, step, instruction, correct_action FROM rules ORDER BY step');
    res.json(rows);
  } catch (e) {
    res.status(500).json({ error: 'DB error', details: e.message });
  }
});

module.exports = { studentRouter: router, attemptsRouter, rulesRouter };
