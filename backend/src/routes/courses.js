// file path: backend/src/routes/courses.js

const express        = require('express');
const rateLimit      = require('express-rate-limit');  // Fix 10
const pool           = require('../db');
const authMiddleware = require('../middleware/auth');
// Fix 3: requireActiveAccount blocks suspended/pending/rejected accounts on all routes
const { requireActiveAccount } = require('../middleware/auth');
// Fix 9: consolidated role guard — replaces inline isInstructor
const instructorOnly = require('../middleware/instructorOnly');
const router         = express.Router();
// [audit #8] Moved from require('./notifications') (route file) to the actual utility
// path. routes/notifications.js only re-exports from utils; importing it directly
// creates a lateral route→route dependency that breaks if the route is reorganised.
const { createNotification, createNotifications } = require('../utils/notifications');
const { auditLog } = require('../utils/auditLog');
// [audit #6] TOTAL_MODULES needed to add module_id range guard to instructor
// quiz-progress query (matches the guard already present in student-facing endpoints).
const { TOTAL_MODULES } = require('../utils/gamification');

// ── Course-code generator ─────────────────────────────────────────────────
// Fix 4: generateUniqueCode() removed — uniqueness is now enforced by the DB
// UNIQUE constraint (uq_course_code) with application-level retry on ER_DUP_ENTRY.
// The old SELECT-then-INSERT loop had a TOCTOU race and no iteration cap.

function generateCourseCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Max retries for course-code INSERT/UPDATE before giving up
const MAX_CODE_RETRIES = 10;

// ── Enrollment rate limiter ───────────────────────────────────────────────
// Fix 10: prevents request flooding and instructor notification spam.
// Applied to all join/reapply endpoints. Keyed by authenticated user ID.
const enrollLimiter = rateLimit({
  windowMs:        15 * 60 * 1000, // 15 minutes
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => String(req.user.id),
  message:         { error: 'RATE_LIMIT', message: 'Too many enrollment requests. Try again later.' },
});

// ==================== STUDENT ROUTES ====================

// Browse all active courses
// Fix 2: course_code removed from SELECT — it is a join credential, not a display field.
//        Returning it here let any authenticated user harvest all codes from the response.
// Fix 3: requireActiveAccount added
// Fix 6: correlated subqueries for student_count and enrollment_status replaced with
//        derived-table LEFT JOINs — was one extra query per course row (N+1 in SQL)
router.get('/browse', authMiddleware, requireActiveAccount, async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT
        c.id, c.name, c.code_name, c.description, c.status, c.created_at,
        u.full_name AS instructor_name, u.email AS instructor_email,
        COALESCE(cnt.student_count, 0) AS student_count,
        my_enr.status                  AS enrollment_status
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       LEFT JOIN (
         SELECT course_id, COUNT(*) AS student_count
         FROM course_enrollments
         WHERE status = 'accepted'
         GROUP BY course_id
       ) cnt ON cnt.course_id = c.id
       LEFT JOIN course_enrollments my_enr
         ON my_enr.course_id = c.id AND my_enr.student_id = ?
       WHERE c.status = 'active'
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ courses });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch courses', details: e.message });
  }
});

// Get student's enrolled courses (§5.1 — correlated subqueries replaced with derived-table JOIN)
// Fix 3: requireActiveAccount added
router.get('/my-courses', authMiddleware, requireActiveAccount, async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT
        c.id, c.name, c.code_name, c.description, c.course_code, c.status, c.allow_reapply,
        u.full_name  AS instructor_name,
        u.email      AS instructor_email,
        ce.status    AS enrollment_status,
        ce.enrolled_at,
        ce.responded_at,
        ce.rejection_reason,
        COALESCE(stats.total_attempts, 0) AS my_attempts,
        COALESCE(stats.avg_score,   0)    AS avg_score,
        COALESCE(stats.best_score,  0)    AS best_score,
        COALESCE(cnt.student_count, 0)    AS student_count,
        CASE WHEN COALESCE(stats.total_attempts, 0) = 0 THEN NULL
        ELSE (
          SELECT COUNT(DISTINCT ce2.student_id) + 1
          FROM course_enrollments ce2
          WHERE ce2.course_id = c.id
            AND ce2.status = 'accepted'
            AND (
              SELECT COALESCE(MAX(a2.score), 0)
              FROM attempts a2
              WHERE a2.user_id = ce2.student_id AND a2.course_id = c.id
            ) > COALESCE(stats.best_score, 0)
        ) END AS my_rank
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id   = c.id
       JOIN users   u ON c.instructor_id = u.id
       LEFT JOIN (
         SELECT course_id,
                COUNT(*)   AS total_attempts,
                AVG(score) AS avg_score,
                MAX(score) AS best_score
         FROM attempts
         WHERE user_id = ?
         GROUP BY course_id
       ) stats ON stats.course_id = c.id
       LEFT JOIN (
         SELECT course_id, COUNT(*) AS student_count
         FROM course_enrollments
         WHERE status = 'accepted'
         GROUP BY course_id
       ) cnt ON cnt.course_id = c.id
       WHERE ce.student_id = ?
       ORDER BY ce.enrolled_at DESC`,
      [req.user.id, req.user.id]
    );
    res.json({ courses });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch enrolled courses', details: e.message });
  }
});

// Reapply to a course after rejection via course code (§2.2)
// Fix 3: requireActiveAccount added
// Fix 10: enrollLimiter added
// Must be registered before /join/code to avoid route shadowing
router.post('/join/code/reapply', authMiddleware, requireActiveAccount, enrollLimiter, async (req, res) => {
  const cleanCode = String(req.body.course_code || '').trim().toUpperCase();
  if (!cleanCode) return res.status(400).json({ error: 'Course code is required' });

  try {
    const [courses] = await pool.query(
      `SELECT c.*, u.full_name AS instructor_name
         FROM courses c JOIN users u ON c.instructor_id = u.id
        WHERE c.course_code = ? AND c.status = 'active'`,
      [cleanCode]
    );
    if (courses.length === 0) return res.status(404).json({ error: 'Invalid course code' });
    const courseData = courses[0];

    if (!courseData.allow_reapply) {
      return res.status(403).json({ error: 'This course does not allow reapplication.' });
    }

    const [existing] = await pool.query(
      'SELECT status, responded_at FROM course_enrollments WHERE course_id = ? AND student_id = ?',
      [courseData.id, req.user.id]
    );
    if (existing.length === 0)
      return res.status(400).json({ error: 'No previous request found. Use /join/code.' });
    if (existing[0].status !== 'rejected')
      return res.status(400).json({ error: `Cannot reapply — current status is "${existing[0].status}".` });

    // Rate-limit: one reapply per 24 hours per (student, course)
    if (existing[0].responded_at) {
      const [[{ hours }]] = await pool.query(
        'SELECT TIMESTAMPDIFF(HOUR, ?, NOW()) AS hours',
        [existing[0].responded_at]
      );
      if (Number(hours) < 24)
        return res.status(429).json({ error: 'You can only reapply once every 24 hours.' });
    }

    await pool.query(
      `UPDATE course_enrollments
          SET status = 'pending', responded_at = NULL, enrolled_at = NOW()
        WHERE course_id = ? AND student_id = ?`,
      [courseData.id, req.user.id]
    );

    const [[student]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    await createNotification({
      userId:  courseData.instructor_id,
      type:    'reapply_request',
      title:   'Reapply Request',
      message: `${student?.full_name || 'A student'} re-requested to join "${courseData.name}".`,
      link:    `/instructor/dashboard/courses/${courseData.id}?tab=students&filter=pending&focus=${req.user.id}`,
    });

    res.json({ message: 'Reapply submitted', course_id: courseData.id, status: 'pending' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reapply', details: e.message });
  }
});

// Join course by code (§9 — normalization fix; §C3 — audit-log)
// Fix 3: requireActiveAccount added
// Fix 5: INSERT wrapped in try/catch for ER_DUP_ENTRY — concurrent duplicate
//        requests previously surfaced as 500; now returns 409 with clear message
// Fix 10: enrollLimiter added
router.post('/join/code', authMiddleware, requireActiveAccount, enrollLimiter, async (req, res) => {
  const cleanCode = String(req.body.course_code || '').trim().toUpperCase();
  if (!cleanCode) {
    return res.status(400).json({ error: 'Course code is required' });
  }

  try {
    const [courses] = await pool.query(
      `SELECT c.*, u.full_name AS instructor_name
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       WHERE c.course_code = ? AND c.status = 'active'`,
      [cleanCode]
    );

    if (courses.length === 0) {
      return res.status(404).json({ error: 'Invalid course code' });
    }

    const courseData = courses[0];

    // Pre-check for UX: return the current status so the frontend can show a
    // specific message. The INSERT below is still guarded by the DB UNIQUE
    // constraint in case a concurrent request slips through.
    const [existing] = await pool.query(
      'SELECT status FROM course_enrollments WHERE course_id = ? AND student_id = ?',
      [courseData.id, req.user.id]
    );

    if (existing.length > 0) {
      const statusMessages = {
        pending:  'You already have a pending enrollment request for this course',
        accepted: 'You are already enrolled in this course',
        rejected: 'Your previous enrollment request was rejected. Use reapply if available.',
      };
      return res.status(400).json({
        error:  statusMessages[existing[0].status] || 'Already enrolled in this course',
        status: existing[0].status,
      });
    }

    // Fix 5: catch ER_DUP_ENTRY from the UNIQUE constraint (uq_course_student)
    // so concurrent duplicate requests return 409 instead of 500
    try {
      await pool.query(
        'INSERT INTO course_enrollments (course_id, student_id, status) VALUES (?, ?, "pending")',
        [courseData.id, req.user.id]
      );
    } catch (insertErr) {
      if (insertErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Already enrolled or request pending for this course' });
      }
      throw insertErr;
    }

    const [[student]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    const studentName = student?.full_name || 'A student';
    await createNotification({
      userId:  courseData.instructor_id,
      type:    'enrollment_request',
      title:   'New Enrollment Request',
      message: `${studentName} requested to join "${courseData.name}".`,
      link:    `/instructor/dashboard/courses/${courseData.id}?tab=students&filter=pending&focus=${req.user.id}`,
    });

    auditLog({
      courseId:  courseData.id,
      actorId:   req.user.id,
      actorRole: 'student',
      action:    'student_requested',
    });

    res.json({
      message:   'Enrollment request sent successfully. Waiting for instructor approval.',
      course_id: courseData.id,
      status:    'pending',
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to join course', details: e.message });
  }
});

// Request to join by course ID (§3.1 — alias that fixes the 404)
// Fix 3: requireActiveAccount added
// Fix 5: INSERT wrapped in try/catch for ER_DUP_ENTRY
// Fix 10: enrollLimiter added
router.post('/join/request/:courseId', authMiddleware, requireActiveAccount, enrollLimiter, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Access denied. Students only.' });
  }

  try {
    const [courses] = await pool.query(
      `SELECT c.*, u.full_name AS instructor_name
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       WHERE c.id = ? AND c.status = 'active'`,
      [req.params.courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or inactive' });
    }

    const courseData = courses[0];

    const [existing] = await pool.query(
      'SELECT status FROM course_enrollments WHERE course_id = ? AND student_id = ?',
      [courseData.id, req.user.id]
    );

    if (existing.length > 0) {
      const s = existing[0].status;
      if (s === 'pending')  return res.status(400).json({ error: 'You already have a pending enrollment request', status: s });
      if (s === 'accepted') return res.status(400).json({ error: 'You are already enrolled in this course', status: s });
      if (s === 'rejected') return res.status(400).json({ error: 'Your previous request was rejected. Use POST /reapply/:courseId if reapplication is open.', status: s });
    }

    // Fix 5: catch ER_DUP_ENTRY from the DB UNIQUE constraint (uq_course_student)
    try {
      await pool.query(
        'INSERT INTO course_enrollments (course_id, student_id, status) VALUES (?, ?, "pending")',
        [courseData.id, req.user.id]
      );
    } catch (insertErr) {
      if (insertErr.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ error: 'Already enrolled or request pending for this course' });
      }
      throw insertErr;
    }

    const [[student]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    const studentName = student?.full_name || 'A student';
    await createNotification({
      userId:  courseData.instructor_id,
      type:    'enrollment_request',
      title:   'New Enrollment Request',
      message: `${studentName} requested to join "${courseData.name}".`,
      link:    `/instructor/dashboard/courses/${courseData.id}?tab=students&filter=pending&focus=${req.user.id}`,
    });

    auditLog({
      courseId:  courseData.id,
      actorId:   req.user.id,
      actorRole: 'student',
      action:    'student_requested',
    });

    res.status(201).json({
      message:   'Enrollment request sent',
      course_id: courseData.id,
      status:    'pending',
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send enrollment request', details: e.message });
  }
});

// Leave a course (§3.2 — fixes the 404; rejected rows are NOT deleted)
// Fix 3: requireActiveAccount added
router.delete('/leave/:courseId', authMiddleware, requireActiveAccount, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Access denied. Students only.' });
  }

  try {
    const [enrollment] = await pool.query(
      `SELECT ce.status, c.name AS course_name, c.instructor_id
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       WHERE ce.course_id = ? AND ce.student_id = ?`,
      [req.params.courseId, req.user.id]
    );

    if (enrollment.length === 0) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    const { status, course_name, instructor_id } = enrollment[0];

    if (status === 'rejected') {
      return res.status(400).json({
        error:  'Cannot leave a rejected course. Use POST /reapply/:courseId to reapply, or contact the instructor.',
        status: 'rejected',
      });
    }

    await pool.query(
      'DELETE FROM course_enrollments WHERE course_id = ? AND student_id = ?',
      [req.params.courseId, req.user.id]
    );

    if (status === 'accepted') {
      const [[student]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
      const studentName = student?.full_name || 'A student';
      await createNotification({
        userId:  instructor_id,
        type:    'enrollment_left',
        title:   'Student Left Course',
        message: `${studentName} left "${course_name}".`,
        link:    `/instructor/dashboard/courses/${req.params.courseId}`,
      });
    }

    auditLog({
      courseId:  Number(req.params.courseId),
      actorId:   req.user.id,
      actorRole: 'student',
      action:    'student_left',
    });

    res.json({ message: 'Left course', course_id: Number(req.params.courseId) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to leave course', details: e.message });
  }
});

// Reapply to a rejected course by course ID (§3.3)
// Fix 3: requireActiveAccount added
// Fix 7: course query now requires status = 'active' — prevents reapplying to archived courses
// Fix 10: enrollLimiter added
router.post('/reapply/:courseId', authMiddleware, requireActiveAccount, enrollLimiter, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Access denied. Students only.' });
  }

  try {
    // Fix 7: added AND status = 'active' — reapplying to an archived course is meaningless
    const [courses] = await pool.query(
      'SELECT id, name, instructor_id, allow_reapply FROM courses WHERE id = ? AND status = ?',
      [req.params.courseId, 'active']
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or not accepting applications' });
    }

    const courseData = courses[0];

    if (!courseData.allow_reapply) {
      return res.status(403).json({ error: 'This course does not allow reapplication.' });
    }

    const [result] = await pool.query(
      `UPDATE course_enrollments
       SET status = 'pending', enrolled_at = NOW(), responded_at = NULL, rejection_reason = NULL
       WHERE course_id = ? AND student_id = ? AND status = 'rejected'`,
      [courseData.id, req.user.id]
    );

    if (result.affectedRows === 0) {
      const [existing] = await pool.query(
        'SELECT status FROM course_enrollments WHERE course_id = ? AND student_id = ?',
        [courseData.id, req.user.id]
      );
      if (existing.length === 0) {
        return res.status(400).json({ error: 'No prior enrollment found. Use POST /join/request/:courseId to apply.' });
      }
      const s = existing[0].status;
      if (s === 'pending')  return res.status(400).json({ error: 'You already have a pending request.', status: s });
      if (s === 'accepted') return res.status(400).json({ error: 'You are already enrolled.', status: s });
    }

    const [[student]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    const studentName = student?.full_name || 'A student';
    await createNotification({
      userId:  courseData.instructor_id,
      type:    'enrollment_request',
      title:   'Enrollment Reapplication',
      message: `${studentName} reapplied to "${courseData.name}".`,
      link:    `/instructor/dashboard/courses/${courseData.id}`,
    });

    auditLog({
      courseId:  courseData.id,
      actorId:   req.user.id,
      actorRole: 'student',
      action:    'student_reapplied',
    });

    res.json({ message: 'Reapplied successfully', course_id: courseData.id, status: 'pending' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reapply', details: e.message });
  }
});

// Get announcements for a course (§6.1 — student must be accepted; instructor must own)
// Fix 3: requireActiveAccount added
router.get('/:courseId/announcements', authMiddleware, requireActiveAccount, async (req, res) => {
  try {
    const courseId = req.params.courseId;

    const [courses] = await pool.query(
      'SELECT id, instructor_id FROM courses WHERE id = ?',
      [courseId]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const isOwner = courses[0].instructor_id === req.user.id;

    if (!isOwner) {
      const [enrollment] = await pool.query(
        "SELECT id FROM course_enrollments WHERE course_id = ? AND student_id = ? AND status = 'accepted'",
        [courseId, req.user.id]
      );
      if (enrollment.length === 0) {
        return res.status(403).json({ error: 'Access denied. You must be enrolled to view announcements.' });
      }
    }

    const [announcements] = await pool.query(
      `SELECT a.id, a.title, a.body, a.pinned, a.created_at, a.updated_at,
              u.full_name AS author_name
       FROM class_announcements a
       JOIN users u ON a.author_id = u.id
       WHERE a.course_id = ?
       ORDER BY a.pinned DESC, a.created_at DESC
       LIMIT 50`,
      [courseId]
    );

    res.json({ announcements });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch announcements', details: e.message });
  }
});

// Get accepted classmates for a course — student-accessible, read-only (§2.5)
// Fix 3: requireActiveAccount added
// [audit #7] Correlated subqueries replaced with derived-table LEFT JOIN.
//            Previous: 2 extra queries per enrolled student (O(n) extra SQL).
//            Now: one derived-table aggregate joined once — same pattern as /browse.
router.get('/:courseId/classmates', authMiddleware, requireActiveAccount, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      `SELECT ce.status, c.instructor_id
         FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
        WHERE c.id = ? AND (ce.student_id = ? OR c.instructor_id = ?)
        LIMIT 1`,
      [req.params.courseId, req.user.id, req.user.id]
    );
    if (!row || (row.status !== 'accepted' && row.instructor_id !== req.user.id)) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const [students] = await pool.query(
      `SELECT u.id, u.full_name, u.username, u.avatar_url, u.xp_points,
              att.best_score,
              att.avg_score,
              COALESCE(mp.modules_completed, 0) AS modules_completed,
              ?                                 AS modules_total,
              (u.id = ?)                        AS is_me
         FROM course_enrollments ce
         JOIN users u ON ce.student_id = u.id
         LEFT JOIN (
           SELECT user_id,
                  MAX(score) AS best_score,
                  AVG(score) AS avg_score
             FROM attempts
            WHERE course_id = ?
            GROUP BY user_id
         ) att ON att.user_id = u.id
         LEFT JOIN (
           SELECT user_id, COUNT(*) AS modules_completed
             FROM module_progress
            WHERE completed = 1
            GROUP BY user_id
         ) mp ON mp.user_id = u.id
        WHERE ce.course_id = ? AND ce.status = 'accepted'
        ORDER BY u.full_name ASC`,
      [TOTAL_MODULES, req.user.id, req.params.courseId, req.params.courseId]
    );
    res.json({ students });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch classmates', details: e.message });
  }
});

// Get course details with leaderboard (§5.4 — window-function rank replaces 6-nested query)
// Fix 3: requireActiveAccount added
router.get('/:courseId', authMiddleware, requireActiveAccount, async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT
        c.*,
        u.full_name AS instructor_name, u.email AS instructor_email,
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id AND status = 'accepted') AS student_count,
        (SELECT status  FROM course_enrollments WHERE course_id = c.id AND student_id = ?)       AS enrollment_status
       FROM courses c
       JOIN users u ON c.instructor_id = u.id
       WHERE c.id = ?`,
      [req.user.id, req.params.courseId]
    );

    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const courseData = courses[0];

    if (courseData.enrollment_status !== 'accepted' && courseData.instructor_id !== req.user.id) {
      return res.status(403).json({
        error:             'Access denied. You must be enrolled to view course details.',
        enrollment_status: courseData.enrollment_status,
      });
    }

    const [[myStats]] = await pool.query(
      `SELECT
        COUNT(*) AS total_attempts,
        COALESCE(AVG(score_percent), 0) AS avg_score,
        COALESCE(MAX(score_percent), 0) AS best_score,
        COALESCE(SUM(hints_used), 0) AS total_hints
       FROM sim_attempts
       WHERE user_id = ? AND completed = 1`,
      [req.user.id]
    );

    const [ranked] = await pool.query(
      `WITH ranked AS (
         SELECT
           u.id,
           u.full_name,
           COUNT(a.id)                        AS total_attempts,
           COALESCE(AVG(a.score_percent), 0)  AS avg_score,
           COALESCE(MAX(a.score_percent), 0)  AS best_score,
           RANK() OVER (
             ORDER BY COALESCE(MAX(a.score_percent), 0) DESC,
                      COALESCE(AVG(a.score_percent), 0) DESC
           ) AS rnk
         FROM course_enrollments ce
         JOIN users u ON ce.student_id = u.id
         LEFT JOIN sim_attempts a ON u.id = a.user_id AND a.completed = 1
         WHERE ce.course_id = ? AND ce.status = 'accepted'
         GROUP BY u.id, u.full_name
       )
       SELECT * FROM ranked`,
      [req.params.courseId]
    );

    const leaderboard = ranked
      .slice(0, 10)
      .map(s => ({ ...s, rank: s.rnk, is_me: s.id === req.user.id }));

    const myRankRow = ranked.find(s => s.id === req.user.id);
    const myRank    = myRankRow ? myRankRow.rnk : null;

    res.json({
      course: {
        ...courseData,
        my_stats:    { ...myStats, my_rank: myRank },
        leaderboard,
      },
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch course details', details: e.message });
  }
});

// ==================== INSTRUCTOR ROUTES ====================

// Get instructor's own courses
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.get('/instructor/my-courses', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      `SELECT
        c.*,
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id AND status = 'accepted') AS student_count,
        (SELECT COUNT(*) FROM course_enrollments WHERE course_id = c.id AND status = 'pending')  AS pending_count
       FROM courses c
       WHERE c.instructor_id = ?
       ORDER BY c.created_at DESC`,
      [req.user.id]
    );
    res.json({ courses });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch courses', details: e.message });
  }
});

// Get all students across all of the instructor's courses (§3.2 — aggregate view)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.get('/instructor/students/all', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const { status } = req.query;
    let query = `
      SELECT u.id, u.email, u.full_name, u.username, u.avatar_url,
             ce.status AS enrollment_status, ce.enrolled_at, ce.responded_at,
             c.id AS course_id, c.name AS course_name, c.code_name AS course_code_name,
             (SELECT COUNT(*) FROM attempts WHERE user_id = u.id AND course_id = c.id) AS total_attempts,
             COALESCE((SELECT AVG(score) FROM attempts WHERE user_id = u.id AND course_id = c.id), 0) AS avg_score,
             COALESCE((SELECT MAX(score) FROM attempts WHERE user_id = u.id AND course_id = c.id), 0) AS best_score
      FROM course_enrollments ce
      JOIN users   u ON ce.student_id = u.id
      JOIN courses c ON ce.course_id  = c.id
      WHERE c.instructor_id = ?`;
    const params = [req.user.id];
    if (status && status !== 'all') { query += ' AND ce.status = ?'; params.push(status); }
    query += ' ORDER BY ce.enrolled_at DESC';

    const [students] = await pool.query(query, params);
    res.json({ students });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch students', details: e.message });
  }
});

// Create new course
// Fix 8: input validation — name required and length-capped; description and code_name length-capped
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
// Fix 4: generateUniqueCode() removed — retry INSERT on ER_DUP_ENTRY instead of SELECT-loop
router.post('/instructor/create', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  const { name, description, code_name } = req.body;

  // Fix 8: validate name
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ error: 'Course name is required' });
  }
  if (name.trim().length > 255) {
    return res.status(400).json({ error: 'Course name must not exceed 255 characters' });
  }
  // Fix 8: validate description
  if (description !== undefined && description !== null && String(description).length > 2000) {
    return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
  }
  // Fix 8: validate code_name (schema column is VARCHAR(32))
  if (code_name !== undefined && code_name !== null && String(code_name).trim().length > 32) {
    return res.status(400).json({ error: 'Academic code must not exceed 32 characters' });
  }

  const trimmedName  = name.trim();
  const cleanCodeName = code_name ? String(code_name).trim().toUpperCase() : null;

  try {
    // Fix 4: retry INSERT with a fresh code on ER_DUP_ENTRY instead of SELECT-then-INSERT loop
    let insertResult = null;
    let course_code  = null;
    for (let i = 0; i < MAX_CODE_RETRIES; i++) {
      course_code = generateCourseCode();
      try {
        [insertResult] = await pool.query(
          'INSERT INTO courses (instructor_id, name, code_name, description, course_code) VALUES (?, ?, ?, ?, ?)',
          [req.user.id, trimmedName, cleanCodeName, description ? String(description).trim() : null, course_code]
        );
        break; // INSERT succeeded — exit retry loop
      } catch (insertErr) {
        if (insertErr.code === 'ER_DUP_ENTRY') continue; // course_code collision — try a new code
        throw insertErr; // unrelated DB error — propagate
      }
    }

    if (!insertResult) {
      return res.status(500).json({ error: 'Failed to generate a unique course code. Please try again.' });
    }

    const [[instructor]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [req.user.id]);
    const instructorName = instructor?.full_name || 'An instructor';
    const [admins] = await pool.query("SELECT id FROM users WHERE role = 'admin'");
    for (const { id } of admins) {
      await createNotification({
        userId:  id,
        type:    'course_created',
        title:   `New Course: "${trimmedName}"`,
        message: `${instructorName} created "${trimmedName}".`,
        link:    '/admin/dashboard',
      });
    }

    auditLog({
      courseId:  insertResult.insertId,
      actorId:   req.user.id,
      actorRole: 'instructor',
      action:    'course_created',
      metadata:  { name: trimmedName, course_code },
    });

    res.json({ message: 'Course created successfully', course_id: insertResult.insertId, course_code });
  } catch (e) {
    res.status(500).json({ error: 'Failed to create course', details: e.message });
  }
});

// Regenerate course code (audit-logged)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
// Fix 4: retry UPDATE on ER_DUP_ENTRY instead of SELECT-loop
router.post('/instructor/:courseId/regenerate-code', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    // Fix 4: retry UPDATE with a fresh code on ER_DUP_ENTRY
    let newCode = null;
    let success = false;
    for (let i = 0; i < MAX_CODE_RETRIES; i++) {
      newCode = generateCourseCode();
      try {
        await pool.query('UPDATE courses SET course_code = ? WHERE id = ?', [newCode, req.params.courseId]);
        success = true;
        break;
      } catch (updateErr) {
        if (updateErr.code === 'ER_DUP_ENTRY') continue;
        throw updateErr;
      }
    }

    if (!success) {
      return res.status(500).json({ error: 'Failed to generate a unique course code. Please try again.' });
    }

    auditLog({
      courseId:  Number(req.params.courseId),
      actorId:   req.user.id,
      actorRole: 'instructor',
      action:    'code_regenerated',
      metadata:  { new_code: newCode },
    });

    res.json({ message: 'Course code regenerated', course_code: newCode });
  } catch (e) {
    res.status(500).json({ error: 'Failed to regenerate course code', details: e.message });
  }
});

// Bulk accept pending enrollments (§4 — transactional rewrite, structured response)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.post('/instructor/:courseId/students/bulk-accept', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  const { studentIds } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'studentIds must be a non-empty array' });
  }

  try {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }
    const { id: courseId, name: courseName } = courses[0];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const placeholders = studentIds.map(() => '?').join(', ');
      const [rows] = await conn.query(
        `SELECT student_id, status
         FROM course_enrollments
         WHERE course_id = ? AND student_id IN (${placeholders})
         FOR UPDATE`,
        [courseId, ...studentIds]
      );

      const foundIds     = new Set(rows.map(r => r.student_id));
      const eligibleIds  = rows.filter(r => r.status === 'pending').map(r => r.student_id);
      const skipped      = studentIds
        .filter(id => !foundIds.has(Number(id)) || rows.find(r => r.student_id === Number(id))?.status !== 'pending')
        .map(id => {
          const row = rows.find(r => r.student_id === Number(id));
          return { student_id: id, reason: row ? `already_${row.status}` : 'not_found' };
        });

      if (eligibleIds.length > 0) {
        const ep = eligibleIds.map(() => '?').join(', ');
        await conn.query(
          `UPDATE course_enrollments
           SET status = 'accepted', responded_at = NOW()
           WHERE course_id = ? AND student_id IN (${ep}) AND status = 'pending'`,
          [courseId, ...eligibleIds]
        );
      }

      await conn.commit();

      if (eligibleIds.length > 0) {
        await createNotifications(
          eligibleIds.map(uid => ({
            userId:  uid,
            type:    'enrollment',
            title:   'Enrollment Accepted',
            message: `You've been accepted into "${courseName}".`,
            link:    `/student/dashboard/courses/${courseId}?focus=welcome`,
          }))
        );
        for (const uid of eligibleIds) {
          auditLog({ courseId, actorId: req.user.id, actorRole: 'instructor', action: 'student_accepted', targetUserId: uid });
        }
      }

      res.json({
        message:  `${eligibleIds.length} accepted, ${skipped.length} skipped`,
        accepted: eligibleIds,
        skipped,
      });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to bulk accept students', details: e.message });
  }
});

// Bulk reject pending enrollments (§4 — transactional rewrite, structured response)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.post('/instructor/:courseId/students/bulk-reject', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  const { studentIds, rejection_reason } = req.body;
  if (!Array.isArray(studentIds) || studentIds.length === 0) {
    return res.status(400).json({ error: 'studentIds must be a non-empty array' });
  }

  try {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }
    const { id: courseId, name: courseName } = courses[0];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();

      const placeholders = studentIds.map(() => '?').join(', ');
      const [rows] = await conn.query(
        `SELECT student_id, status
         FROM course_enrollments
         WHERE course_id = ? AND student_id IN (${placeholders})
         FOR UPDATE`,
        [courseId, ...studentIds]
      );

      const foundIds    = new Set(rows.map(r => r.student_id));
      const eligibleIds = rows.filter(r => r.status === 'pending').map(r => r.student_id);
      const skipped     = studentIds
        .filter(id => !foundIds.has(Number(id)) || rows.find(r => r.student_id === Number(id))?.status !== 'pending')
        .map(id => {
          const row = rows.find(r => r.student_id === Number(id));
          return { student_id: id, reason: row ? `already_${row.status}` : 'not_found' };
        });

      if (eligibleIds.length > 0) {
        const ep = eligibleIds.map(() => '?').join(', ');
        await conn.query(
          `UPDATE course_enrollments
           SET status = 'rejected', responded_at = NOW(), rejection_reason = ?
           WHERE course_id = ? AND student_id IN (${ep}) AND status = 'pending'`,
          [rejection_reason || null, courseId, ...eligibleIds]
        );
      }

      await conn.commit();

      if (eligibleIds.length > 0) {
        await createNotifications(
          eligibleIds.map(uid => ({
            userId:  uid,
            type:    'enrollment',
            title:   'Enrollment Update',
            message: `Your request to join "${courseName}" was not approved.`,
            link:    `/student/dashboard/courses?focus=rejected:${courseId}`,
          }))
        );
        for (const uid of eligibleIds) {
          auditLog({ courseId, actorId: req.user.id, actorRole: 'instructor', action: 'student_rejected', targetUserId: uid });
        }
      }

      res.json({
        message:  `${eligibleIds.length} rejected, ${skipped.length} skipped`,
        rejected: eligibleIds,
        skipped,
      });
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }
  } catch (e) {
    res.status(500).json({ error: 'Failed to bulk reject students', details: e.message });
  }
});

// Per-module quiz progress for a specific student (instructor view)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
// [audit #6] Added module_id range filter to SQL query — student-facing /progress
//            had this guard; the instructor view was missing it, allowing
//            out-of-range rows to appear in the grouped result.
router.get('/instructor/:courseId/students/:studentId/quiz-progress', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [enrollment] = await pool.query(
      `SELECT ce.id
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.id = ? AND c.instructor_id = ? AND ce.student_id = ?`,
      [req.params.courseId, req.user.id, req.params.studentId]
    );
    if (enrollment.length === 0) {
      return res.status(403).json({ error: 'Student is not enrolled in this course' });
    }

    const [rows] = await pool.query(
      `SELECT
         module_id,
         COUNT(*)                                            AS attempt_count,
         MAX(score)                                          AS best_score,
         ROUND(AVG(ROUND((score / total_questions) * 100))) AS avg_percentage,
         MAX(total_questions)                                AS total_questions,
         MAX(CASE WHEN passed = TRUE THEN 1 ELSE 0 END)     AS ever_passed
       FROM quiz_attempts
       WHERE user_id = ?
         AND module_id BETWEEN 1 AND ?
       GROUP BY module_id
       ORDER BY module_id ASC`,
      [req.params.studentId, TOTAL_MODULES]
    );

    const moduleMap = {};
    rows.forEach(r => { moduleMap[r.module_id] = r; });

    const progress = [1, 2, 3, 4, 5].map(id => {
      const data = moduleMap[id];
      if (!data) {
        return { module_id: id, attempt_count: 0, best_score: null, avg_percentage: null, total_questions: 10, ever_passed: false };
      }
      return {
        module_id:       data.module_id,
        attempt_count:   Number(data.attempt_count),
        best_score:      data.best_score,
        avg_percentage:  data.avg_percentage,
        total_questions: data.total_questions,
        ever_passed:     Boolean(data.ever_passed),
      };
    });

    res.json({ success: true, progress });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch quiz progress', details: e.message });
  }
});

// Get a student's module progress for instructor view (§2.4)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.get('/instructor/:courseId/students/:studentId/module-progress', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [enr] = await pool.query(
      `SELECT 1 FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
        WHERE c.id = ? AND c.instructor_id = ? AND ce.student_id = ?`,
      [req.params.courseId, req.user.id, req.params.studentId]
    );
    if (enr.length === 0) return res.status(403).json({ error: 'Student not in this course' });

    const [rows] = await pool.query(
      `SELECT module_id, completed, completed_at, updated_at AS last_accessed_at
         FROM module_progress
        WHERE user_id = ?`,
      [req.params.studentId]
    );
    const byModule = Object.fromEntries(rows.map(r => [r.module_id, r]));
    const progress = [1, 2, 3, 4, 5].map(id => byModule[id]
      ? { module_id: id, completed: !!byModule[id].completed, completed_at: byModule[id].completed_at, last_accessed_at: byModule[id].last_accessed_at }
      : { module_id: id, completed: false, completed_at: null, last_accessed_at: null });

    res.json({ success: true, progress });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch module progress', details: e.message }); }
});

// Get a student's simulation progress for instructor view (§2.4)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.get('/instructor/:courseId/students/:studentId/simulation-progress', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [enr] = await pool.query(
      `SELECT 1 FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
        WHERE c.id = ? AND c.instructor_id = ? AND ce.student_id = ?`,
      [req.params.courseId, req.user.id, req.params.studentId]
    );
    if (enr.length === 0) return res.status(403).json({ error: 'Student not in this course' });

    const [recent] = await pool.query(
      `SELECT id, score_percent AS score, hints_used, duration_seconds, completed, created_at
         FROM sim_attempts
        WHERE user_id = ? AND completed = 1 AND course_id = ?
        ORDER BY created_at DESC
        LIMIT 20`,
      [req.params.studentId, req.params.courseId]
    );
    const [[aggregate]] = await pool.query(
      `SELECT COUNT(*) AS total, COALESCE(AVG(score_percent), 0) AS avg_score,
              COALESCE(MAX(score_percent), 0) AS best_score, COALESCE(SUM(hints_used), 0) AS total_hints
         FROM sim_attempts WHERE user_id = ? AND completed = 1 AND course_id = ?`,
      [req.params.studentId, req.params.courseId]
    );

    res.json({ success: true, recent, aggregate });
  } catch (e) { res.status(500).json({ error: 'Failed to fetch simulation progress', details: e.message }); }
});

// Get students in a course
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.get('/instructor/:courseId/students', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    const { status } = req.query;
    let whereClause = 'WHERE ce.course_id = ?';
    // params order: att(courseId), mod(TOTAL_MODULES), qz(courseId), outer WHERE(courseId), [status]
    const params    = [req.params.courseId, TOTAL_MODULES, req.params.courseId, req.params.courseId];

    if (status && status !== 'all') {
      whereClause += ' AND ce.status = ?';
      params.push(status);
    }

    const [students] = await pool.query(
      `SELECT
         u.id, u.email, u.full_name,
         ce.status AS enrollment_status, ce.enrolled_at, ce.responded_at, ce.rejection_reason,
         COALESCE(att.total_attempts, 0)    AS total_attempts,
         COALESCE(att.avg_score,   0)       AS avg_score,
         COALESCE(att.best_score,  0)       AS best_score,
         COALESCE(mp.modules_completed, 0) AS modules_completed,
         qz.quiz_avg_score
       FROM course_enrollments ce
       JOIN users u ON ce.student_id = u.id
       LEFT JOIN (
         SELECT user_id,
                COUNT(*)            AS total_attempts,
                AVG(score_percent)  AS avg_score,
                MAX(score_percent)  AS best_score
         FROM sim_attempts
         WHERE completed = 1 AND course_id = ?
         GROUP BY user_id
       ) att ON att.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                COUNT(*) AS modules_completed
         FROM module_progress
         WHERE completed = TRUE
           AND module_id BETWEEN 1 AND ?
         GROUP BY user_id
       ) mp ON mp.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                ROUND(AVG((score / NULLIF(total_questions, 0)) * 100)) AS quiz_avg_score
         FROM quiz_attempts
         WHERE course_id = ?
         GROUP BY user_id
       ) qz ON qz.user_id = u.id
       ${whereClause}
       ORDER BY ce.enrolled_at DESC`,
      params
    );

    const enriched = students.map(s => ({ ...s, total_modules: TOTAL_MODULES }));
    res.json({ students: enriched });
  } catch (e) {
    console.error('[GET students] SQL error:', e.message, '\nSQL state:', e.sqlState, '\nSQL:', e.sql);
    res.status(500).json({ error: 'Failed to fetch students', details: e.message });
  }
});

// Accept a single student enrollment (audit-logged)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.post('/instructor/:courseId/students/:studentId/accept', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    const [result] = await pool.query(
      `UPDATE course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       SET ce.status = 'accepted', ce.responded_at = NOW()
       WHERE c.id = ? AND c.instructor_id = ? AND ce.student_id = ? AND ce.status = 'pending'`,
      [req.params.courseId, req.user.id, req.params.studentId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Enrollment request not found or already processed' });
    }

    await createNotification({
      userId:  Number(req.params.studentId),
      type:    'enrollment',
      title:   'Enrollment Accepted',
      message: `You've been accepted into "${courses[0].name}".`,
      link:    `/student/dashboard/courses/${req.params.courseId}?focus=welcome`,
    });

    auditLog({
      courseId:     Number(req.params.courseId),
      actorId:      req.user.id,
      actorRole:    'instructor',
      action:       'student_accepted',
      targetUserId: Number(req.params.studentId),
    });

    res.json({ message: 'Student enrollment accepted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to accept enrollment', details: e.message });
  }
});

// Reject a single student enrollment (persists rejection_reason + audit-logged)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.post('/instructor/:courseId/students/:studentId/reject', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  const { rejection_reason } = req.body;

  try {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    const [result] = await pool.query(
      `UPDATE course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       SET ce.status = 'rejected', ce.responded_at = NOW(), ce.rejection_reason = ?
       WHERE c.id = ? AND c.instructor_id = ? AND ce.student_id = ? AND ce.status = 'pending'`,
      [rejection_reason || null, req.params.courseId, req.user.id, req.params.studentId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Enrollment request not found or already processed' });
    }

    await createNotification({
      userId:  Number(req.params.studentId),
      type:    'enrollment',
      title:   'Enrollment Update',
      message: `Your request to join "${courses[0].name}" was not approved.`,
      link:    `/student/dashboard/courses?focus=rejected:${req.params.courseId}`,
    });

    auditLog({
      courseId:     Number(req.params.courseId),
      actorId:      req.user.id,
      actorRole:    'instructor',
      action:       'student_rejected',
      targetUserId: Number(req.params.studentId),
      metadata:     rejection_reason ? { rejection_reason } : null,
    });

    res.json({ message: 'Student enrollment rejected' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reject enrollment', details: e.message });
  }
});

// Remove a student from the course (notifies student + audit-logged)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.delete('/instructor/:courseId/students/:studentId', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    const [result] = await pool.query(
      `DELETE ce FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.id = ? AND c.instructor_id = ? AND ce.student_id = ?`,
      [req.params.courseId, req.user.id, req.params.studentId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Student enrollment not found' });
    }

    await createNotification({
      userId:  Number(req.params.studentId),
      type:    'removed_from_course',
      title:   'Removed from Course',
      message: `You were removed from "${courses[0].name}".`,
      link:    '/student/dashboard/courses',
    });

    auditLog({
      courseId:     Number(req.params.courseId),
      actorId:      req.user.id,
      actorRole:    'instructor',
      action:       'student_removed',
      targetUserId: Number(req.params.studentId),
    });

    res.json({ message: 'Student removed from course' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove student', details: e.message });
  }
});

// Update course (handles allow_reapply; notifies enrolled students on archive)
// Fix 8: input validation — name, description, code_name length-capped; name non-empty guard
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.put('/instructor/:courseId', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  const { name, description, status, allow_reapply, code_name } = req.body;

  // Fix 8: validate fields before touching the DB
  if (name !== undefined) {
    if (typeof name !== 'string' || name.trim().length === 0) {
      return res.status(400).json({ error: 'Course name must not be empty' });
    }
    if (name.trim().length > 255) {
      return res.status(400).json({ error: 'Course name must not exceed 255 characters' });
    }
  }
  if (description !== undefined && description !== null && String(description).length > 2000) {
    return res.status(400).json({ error: 'Description must not exceed 2000 characters' });
  }
  if (code_name !== undefined && code_name !== null && String(code_name).trim().length > 32) {
    return res.status(400).json({ error: 'Academic code must not exceed 32 characters' });
  }

  try {
    const [courses] = await pool.query(
      'SELECT * FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }
    const prevStatus = courses[0].status;

    const updates = [];
    const values  = [];

    if (name !== undefined)                                    { updates.push('name = ?');          values.push(name.trim()); }
    if (code_name !== undefined)                               { updates.push('code_name = ?');     values.push(code_name ? String(code_name).trim().toUpperCase() : null); }
    if (description !== undefined)                             { updates.push('description = ?');   values.push(description); }
    if (status && ['active', 'archived'].includes(status))    { updates.push('status = ?');        values.push(status); }
    if (allow_reapply !== undefined)                           { updates.push('allow_reapply = ?'); values.push(allow_reapply ? 1 : 0); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.courseId);
    await pool.query(`UPDATE courses SET ${updates.join(', ')} WHERE id = ?`, values);

    const isArchiving = status === 'archived' && prevStatus !== 'archived';
    if (isArchiving) {
      const courseName = name ? name.trim() : courses[0].name;
      const [enrollees] = await pool.query(
        "SELECT student_id FROM course_enrollments WHERE course_id = ? AND status = 'accepted'",
        [req.params.courseId]
      );
      if (enrollees.length > 0) {
        await createNotifications(
          enrollees.map(({ student_id }) => ({
            userId:  student_id,
            type:    'course_archived',
            title:   'Course Archived',
            message: `"${courseName}" was archived by the instructor.`,
            link:    '/student/dashboard/courses',
          }))
        );
      }
      auditLog({
        courseId:  Number(req.params.courseId),
        actorId:   req.user.id,
        actorRole: 'instructor',
        action:    'course_archived',
      });
    } else {
      auditLog({
        courseId:  Number(req.params.courseId),
        actorId:   req.user.id,
        actorRole: 'instructor',
        action:    'course_updated',
        metadata:  { fields: updates.map(u => u.split(' = ')[0]) },
      });
    }

    res.json({ message: 'Course updated successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update course', details: e.message });
  }
});

// Delete course (fetch enrolled students FIRST so notifications survive the CASCADE)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.delete('/instructor/:courseId', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }
    const { id: courseId, name: courseName } = courses[0];

    const [enrollees] = await pool.query(
      "SELECT student_id FROM course_enrollments WHERE course_id = ? AND status = 'accepted'",
      [courseId]
    );

    const [result] = await pool.query(
      'DELETE FROM courses WHERE id = ? AND instructor_id = ?',
      [courseId, req.user.id]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    if (enrollees.length > 0) {
      await createNotifications(
        enrollees.map(({ student_id }) => ({
          userId:  student_id,
          type:    'course_deleted',
          title:   'Course Deleted',
          message: `"${courseName}" was deleted by the instructor.`,
          link:    '/student/dashboard/courses',
        }))
      );
    }

    auditLog({
      courseId:  courseId,
      actorId:   req.user.id,
      actorRole: 'instructor',
      action:    'course_deleted',
      metadata:  { name: courseName },
    });

    res.json({ message: 'Course deleted successfully' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete course', details: e.message });
  }
});

// ── Announcements (§6) ────────────────────────────────────────────────────

// Post new announcement; batch-notifies all accepted enrollees
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.post('/instructor/:courseId/announcements', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  const { title, body, pinned = false } = req.body;

  if (!title || title.length < 1 || title.length > 255) {
    return res.status(400).json({ error: 'title is required (1–255 chars)' });
  }
  if (!body || body.length < 1 || body.length > 8000) {
    return res.status(400).json({ error: 'body is required (1–8000 chars)' });
  }

  try {
    const [courses] = await pool.query(
      'SELECT id, name FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }
    const { id: courseId, name: courseName } = courses[0];

    const [result] = await pool.query(
      'INSERT INTO class_announcements (course_id, author_id, title, body, pinned) VALUES (?, ?, ?, ?, ?)',
      [courseId, req.user.id, title, body, pinned ? 1 : 0]
    );

    const [enrollees] = await pool.query(
      "SELECT student_id FROM course_enrollments WHERE course_id = ? AND status = 'accepted'",
      [courseId]
    );
    if (enrollees.length > 0) {
      await createNotifications(
        enrollees.map(({ student_id }) => ({
          userId:  student_id,
          type:    'announcement',
          title:   `New announcement in "${courseName}"`,
          message: title,
          link:    `/student/dashboard/courses/${courseId}`,
        }))
      );
    }

    auditLog({
      courseId:  courseId,
      actorId:   req.user.id,
      actorRole: 'instructor',
      action:    'announcement_posted',
      metadata:  { announcement_id: result.insertId, title },
    });

    res.status(201).json({ message: 'Announcement posted', announcement_id: result.insertId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to post announcement', details: e.message });
  }
});

// Edit announcement (no re-notification on edit — avoids spam from typo fixes)
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.put('/instructor/:courseId/announcements/:announcementId', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  const { title, body, pinned } = req.body;

  try {
    const [courses] = await pool.query(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    const updates = [];
    const values  = [];

    if (title !== undefined) {
      if (title.length < 1 || title.length > 255) return res.status(400).json({ error: 'title must be 1–255 chars' });
      updates.push('title = ?'); values.push(title);
    }
    if (body !== undefined) {
      if (body.length < 1 || body.length > 8000) return res.status(400).json({ error: 'body must be 1–8000 chars' });
      updates.push('body = ?'); values.push(body);
    }
    if (pinned !== undefined) { updates.push('pinned = ?'); values.push(pinned ? 1 : 0); }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(req.params.announcementId, req.params.courseId);
    const [result] = await pool.query(
      `UPDATE class_announcements SET ${updates.join(', ')} WHERE id = ? AND course_id = ?`,
      values
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    auditLog({
      courseId:  Number(req.params.courseId),
      actorId:   req.user.id,
      actorRole: 'instructor',
      action:    'announcement_updated',
      metadata:  { announcement_id: Number(req.params.announcementId) },
    });

    res.json({ message: 'Announcement updated' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to update announcement', details: e.message });
  }
});

// Delete announcement
// Fix 9: instructorOnly replaces inline isInstructor
// Fix 3: requireActiveAccount added
router.delete('/instructor/:courseId/announcements/:announcementId', authMiddleware, requireActiveAccount, instructorOnly, async (req, res) => {
  try {
    const [courses] = await pool.query(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [req.params.courseId, req.user.id]
    );
    if (courses.length === 0) {
      return res.status(404).json({ error: 'Course not found or access denied' });
    }

    const [result] = await pool.query(
      'DELETE FROM class_announcements WHERE id = ? AND course_id = ?',
      [req.params.announcementId, req.params.courseId]
    );
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Announcement not found' });
    }

    auditLog({
      courseId:  Number(req.params.courseId),
      actorId:   req.user.id,
      actorRole: 'instructor',
      action:    'announcement_deleted',
      metadata:  { announcement_id: Number(req.params.announcementId) },
    });

    res.json({ message: 'Announcement deleted' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete announcement', details: e.message });
  }
});

module.exports = router;
