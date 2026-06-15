// file path: backend/src/routes/instructor.js
//
// This file handles cross-course instructor aggregations, rules management,
// and dashboard stats. Per-course enrollment mutations live in routes/courses.js.

const express   = require('express');
const pool      = require('../db');
const authMiddleware = require('../middleware/auth');
const { TOTAL_MODULES } = require('../utils/gamification');
const router = express.Router();

const instructorOnly   = require('../middleware/instructorOnly');
const instructorOrAdmin = require('../middleware/instructorOrAdmin');
const { getQuestionText } = require('../utils/quizBank');

// ==================== STUDENT MANAGEMENT (cross-course) ====================

router.get('/students', authMiddleware, instructorOnly, async (req, res) => {
  try {
    const { status } = req.query;
    const courseId = req.query.courseId ? Number(req.query.courseId) : null;
    const limit    = Math.min(parseInt(req.query.limit)  || 200, 500);
    const offset   = Math.max(parseInt(req.query.offset) || 0,   0);

    const since       = req.query.since || null;
    const sinceClause = since ? 'AND created_at >= ?' : '';
    const sinceParam  = since ? [since] : [];

    let statusClause = '';
    let courseClause = '';

    // simScopeParam: courseId when filtering a specific course, enrollment-based otherwise.
    // Enrollment-based scope handles legacy NULL course_id rows in sim_attempts.
    const simCourseClause = courseId
      ? 'AND course_id = ?'
      : `AND user_id IN (
           SELECT ce.student_id FROM course_enrollments ce
           JOIN courses c ON ce.course_id = c.id
           WHERE c.instructor_id = ? AND ce.status = 'accepted'
         )`;
    const simParams   = [courseId ?? req.user.id];
    const outerParams = [req.user.id];

    // [Fix E] Default to 'accepted' — pending/rejected students require explicit ?status=.
    const effectiveStatus = status || 'accepted';
    if (effectiveStatus !== 'all') {
      statusClause = 'AND ce.status = ?';
      outerParams.push(effectiveStatus);
    }
    if (courseId) {
      courseClause = 'AND c.id = ?';
      outerParams.push(courseId);
    }

    // [Fix L] Total count for pagination signal (uses same WHERE as main query).
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(DISTINCT u.id) AS total
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       JOIN users u   ON ce.student_id = u.id
       WHERE c.instructor_id = ? ${statusClause} ${courseClause}`,
      outerParams
    );

    const [students] = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.full_name,
        u.created_at,
        sp.experience_level,
        u.bio,
        ce.status          AS enrollment_status,
        ce.enrolled_at     AS requested_at,
        ce.responded_at,
        c.id               AS course_id,
        c.name             AS course_name,
        c.course_code,
        COALESCE(att.total_attempts, 0) AS total_attempts,
        att.avg_score,
        att.best_score,
        att.last_active,
        (SELECT COUNT(*) FROM user_achievements ua WHERE ua.user_id = u.id)                      AS achievement_count,
        (SELECT COUNT(*) FROM module_progress   mp WHERE mp.user_id = u.id AND mp.completed = 1)  AS modules_completed
       FROM course_enrollments ce
       JOIN courses c   ON ce.course_id  = c.id
       JOIN users u     ON ce.student_id = u.id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN (
         SELECT user_id,
                COUNT(*)             AS total_attempts,
                AVG(score_percent)   AS avg_score,
                MAX(score_percent)   AS best_score,
                MAX(created_at)      AS last_active
         FROM sim_attempts
         WHERE completed = 1 ${simCourseClause} ${sinceClause}
         GROUP BY user_id
       ) att ON att.user_id = u.id
       WHERE c.instructor_id = ? ${statusClause} ${courseClause}
       ORDER BY ce.enrolled_at DESC
       LIMIT ? OFFSET ?`,
      [...simParams, ...sinceParam, ...outerParams, limit, offset]
    );

    const enrichedStudents = students.map(student => ({
      ...student,
      avg_score:        student.avg_score  ? Math.round(student.avg_score)  : 0,
      best_score:       student.best_score || 0,
      performance:      getPerformanceLevel(student.avg_score),
      streak:           0,
      completedLessons: student.total_attempts || 0,
    }));

    res.json({ students: enrichedStudents, total: Number(total), limit, offset });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to fetch students',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

router.get('/students/pending', authMiddleware, instructorOnly, async (req, res) => {
  try {
    const [requests] = await pool.query(
      `SELECT
        u.id,
        u.email,
        u.full_name,
        u.created_at,
        sp.experience_level,
        u.bio,
        ce.enrolled_at AS requested_at,
        c.id           AS course_id,
        c.name         AS course_name,
        c.course_code
       FROM course_enrollments ce
       JOIN courses c  ON ce.course_id  = c.id
       JOIN users u    ON ce.student_id = u.id
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE c.instructor_id = ? AND ce.status = 'pending'
       ORDER BY ce.enrolled_at DESC`,
      [req.user.id]
    );
    res.json({ requests });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to fetch pending requests',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

router.get('/students/:studentId', authMiddleware, instructorOnly, async (req, res) => {
  try {
    const [enrollment] = await pool.query(
      `SELECT ce.*, c.name AS course_name, c.course_code
       FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.instructor_id = ? AND ce.student_id = ?
       LIMIT 1`,
      [req.user.id, req.params.studentId]
    );

    if (enrollment.length === 0) {
      return res.status(403).json({ error: 'This student is not enrolled in any of your courses' });
    }

    const [students] = await pool.query(
      `SELECT
        u.id, u.email, u.full_name, u.created_at, u.bio, u.avatar_url,
        sp.experience_level
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = ?`,
      [req.params.studentId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const [attempts] = await pool.query(
      `SELECT id, score_percent AS score, hints_used, completed, created_at,
              TIMESTAMPDIFF(SECOND, created_at, NOW()) AS time_ago_seconds
       FROM sim_attempts
       WHERE user_id = ? AND completed = 1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.params.studentId]
    );

    const [stats] = await pool.query(
      `SELECT
        COUNT(*)             AS total_attempts,
        AVG(score_percent)   AS avg_score,
        MAX(score_percent)   AS best_score,
        MIN(score_percent)   AS lowest_score,
        SUM(hints_used)      AS total_hints_used
       FROM sim_attempts
       WHERE user_id = ? AND completed = 1`,
      [req.params.studentId]
    );

    res.json({
      student: {
        ...students[0],
        enrollment_status: enrollment[0].status,
        enrolled_at:       enrollment[0].responded_at || enrollment[0].enrolled_at,
        course: {
          id:   enrollment[0].course_id,
          name: enrollment[0].course_name,
          code: enrollment[0].course_code,
        },
        statistics: {
          total_attempts:   stats[0].total_attempts || 0,
          avg_score:        stats[0].avg_score  ? Math.round(stats[0].avg_score) : 0,
          best_score:       stats[0].best_score  || 0,
          lowest_score:     stats[0].lowest_score || 0,
          total_hints_used: stats[0].total_hints_used || 0,
          performance:      getPerformanceLevel(stats[0].avg_score),
        },
        recent_attempts: attempts.map(a => ({
          ...a,
          time_ago: formatTimeAgo(a.time_ago_seconds),
        })),
      },
    });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to fetch student details',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

// GET /api/instructor/students/:studentId/sim-analytics?courseId=…
router.get('/students/:studentId/sim-analytics', authMiddleware, instructorOnly, async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || studentId < 1)
    return res.status(400).json({ error: 'INVALID_STUDENT_ID' });

  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  if (courseId !== null && (!Number.isInteger(courseId) || courseId < 1))
    return res.status(400).json({ error: 'INVALID_COURSE_ID' });

  try {
    // Verify the instructor teaches at least one course this student is enrolled in
    const [[enrollment]] = await pool.query(
      `SELECT ce.id FROM course_enrollments ce
       JOIN courses c ON ce.course_id = c.id
       WHERE c.instructor_id = ? AND ce.student_id = ?
       ${courseId ? 'AND ce.course_id = ?' : ''}
       LIMIT 1`,
      courseId ? [req.user.id, studentId, courseId] : [req.user.id, studentId]
    );
    if (!enrollment) return res.status(403).json({ error: 'ACCESS_DENIED' });

    const courseFilter = courseId ? 'AND sa.course_id = ?' : '';
    const baseParams   = courseId ? [studentId, courseId] : [studentId];

    const [scoreTrendRows, errorRows, stepRows, moduleRows] = await Promise.all([
      pool.query(
        `SELECT attempt_number, score_percent, hints_used, duration_seconds,
                DATE_FORMAT(created_at, '%Y-%m-%d') AS date
         FROM sim_attempts sa
         WHERE sa.user_id = ? AND sa.completed = 1 ${courseFilter}
         ORDER BY attempt_number ASC`,
        baseParams
      ),
      pool.query(
        `SELECT sel.error_class, COUNT(*) AS total
         FROM sim_error_log sel
         JOIN sim_attempts sa ON sel.sim_attempt_id = sa.id
         WHERE sa.user_id = ? AND sa.completed = 1 ${courseFilter}
         GROUP BY sel.error_class`,
        baseParams
      ),
      pool.query(
        `SELECT ssr.step_key,
                ROUND(AVG(ssr.accuracy_factor) * 100)  AS avg_accuracy_pct,
                ROUND(AVG(ssr.error_count), 1)          AS avg_errors,
                ROUND(AVG(ssr.time_spent_seconds))      AS avg_time_seconds
         FROM sim_step_results ssr
         JOIN sim_attempts sa ON ssr.sim_attempt_id = sa.id
         WHERE sa.user_id = ? AND sa.completed = 1 ${courseFilter}
         GROUP BY ssr.step_key
         ORDER BY ssr.step_key`,
        baseParams
      ),
      // Module completion status for this student
      pool.query(
        `SELECT module_id, completed, completed_at
         FROM module_progress
         WHERE user_id = ?
         ORDER BY module_id`,
        [studentId]
      ),
    ]);

    const error_totals = { wrong_cut_path: 0, excess_flesh_damage: 0, missed_bone: 0 };
    errorRows[0].forEach(r => {
      if (r.error_class in error_totals) error_totals[r.error_class] = Number(r.total);
    });

    res.json({
      score_trend:       scoreTrendRows[0],
      error_totals,
      step_performance:  stepRows[0],
      module_completion: moduleRows[0],
    });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to fetch student sim analytics',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

// ==================== RULES MANAGEMENT ====================

router.get('/rules', authMiddleware, instructorOnly, async (req, res) => {
  try {
    const [rules] = await pool.query(
      `SELECT r.*, u.full_name AS creator_name
       FROM rules r
       LEFT JOIN users u ON r.created_by = u.id
       ORDER BY r.step`
    );
    res.json({ rules });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to fetch rules',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

router.post('/rules', authMiddleware, instructorOnly, async (req, res) => {
  const { step, instruction, correct_action } = req.body;

  if (!step || !instruction || !correct_action) {
    return res.status(400).json({ error: 'Step, instruction, and correct_action are required' });
  }

  try {
    const [result] = await pool.query(
      'INSERT INTO rules (step, instruction, correct_action, created_by) VALUES (?, ?, ?, ?)',
      [step, instruction, correct_action, req.user.id]
    );
    res.json({ message: 'Rule created successfully', ruleId: result.insertId });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to create rule',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

router.put('/rules/:ruleId', authMiddleware, instructorOnly, async (req, res) => {
  const { step, instruction, correct_action } = req.body;

  try {
    const updates = [];
    const values  = [];

    if (step !== undefined) { updates.push('step = ?');           values.push(step); }
    if (instruction)        { updates.push('instruction = ?');    values.push(instruction); }
    if (correct_action)     { updates.push('correct_action = ?'); values.push(correct_action); }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(req.params.ruleId, req.user.id);
    const [result] = await pool.query(
      `UPDATE rules SET ${updates.join(', ')} WHERE id = ? AND created_by = ?`,
      values
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ message: 'Rule updated successfully' });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to update rule',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

router.delete('/rules/:ruleId', authMiddleware, instructorOnly, async (req, res) => {
  try {
    const [result] = await pool.query(
      'DELETE FROM rules WHERE id = ? AND created_by = ?',
      [req.params.ruleId, req.user.id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Rule not found' });
    }

    res.json({ message: 'Rule deleted successfully' });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to delete rule',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

// ==================== DASHBOARD STATISTICS ====================

router.get('/dashboard/stats', authMiddleware, instructorOnly, async (req, res) => {
  try {
    const uid = req.user.id;
    // Subquery used repeatedly to scope to this instructor's accepted students
    const studentScope = `sa.user_id IN (
      SELECT ce.student_id FROM course_enrollments ce
      JOIN courses c ON ce.course_id = c.id
      WHERE c.instructor_id = ? AND ce.status = 'accepted'
    )`;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      .toISOString().slice(0, 10); // YYYY-MM-DD

    const [
      [studentCount],
      [pendingCount],
      [totalAttempts],
      [avgScore],
      [needAttention],
      [courseCount],
      [activeThisWeek],
      [quizPassRate],
      topPerformers,
      weeklyActivity,
      quizByModule,
      stepErrors,
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT ce.student_id) AS count
         FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE c.instructor_id = ? AND ce.status = 'accepted'`,
        [uid]
      ),
      pool.query(
        `SELECT COUNT(*) AS count
         FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE c.instructor_id = ? AND ce.status = 'pending'`,
        [uid]
      ),
      pool.query(
        `SELECT COUNT(*) AS count FROM sim_attempts sa
         WHERE sa.completed = 1 AND ${studentScope}`,
        [uid]
      ),
      pool.query(
        `SELECT AVG(sa.score_percent) AS avg_score FROM sim_attempts sa
         WHERE sa.completed = 1 AND ${studentScope}`,
        [uid]
      ),
      pool.query(
        `SELECT COUNT(DISTINCT sub.student_id) AS count FROM (
           SELECT sa.user_id AS student_id FROM sim_attempts sa
           WHERE sa.completed = 1 AND ${studentScope}
           GROUP BY sa.user_id HAVING AVG(sa.score_percent) < 60
         ) sub`,
        [uid]
      ),
      // Total active courses for this instructor
      pool.query(
        `SELECT COUNT(*) AS count FROM courses
         WHERE instructor_id = ? AND status = 'active'`,
        [uid]
      ),
      // Students who completed a sim in the last 7 days
      pool.query(
        `SELECT COUNT(DISTINCT sa.user_id) AS count FROM sim_attempts sa
         WHERE sa.completed = 1 AND sa.created_at >= ? AND ${studentScope}`,
        [sevenDaysAgo, uid]
      ),
      // Overall quiz pass rate across all students
      pool.query(
        `SELECT ROUND(SUM(qa.passed) / NULLIF(COUNT(*), 0) * 100) AS pass_rate
         FROM quiz_attempts qa
         WHERE qa.user_id IN (
           SELECT ce.student_id FROM course_enrollments ce
           JOIN courses c ON ce.course_id = c.id
           WHERE c.instructor_id = ? AND ce.status = 'accepted'
         )`,
        [uid]
      ),
      // Top 3 performers by average sim score
      pool.query(
        `SELECT u.full_name,
                ROUND(AVG(sa.score_percent)) AS avg_score,
                COUNT(sa.id)                 AS total_attempts
         FROM sim_attempts sa
         JOIN users u ON sa.user_id = u.id
         WHERE sa.completed = 1 AND ${studentScope}
         GROUP BY sa.user_id
         ORDER BY avg_score DESC
         LIMIT 3`,
        [uid]
      ),
      // Sim attempt counts per day for the last 7 days
      pool.query(
        `SELECT DATE(sa.created_at) AS day, COUNT(*) AS count
         FROM sim_attempts sa
         WHERE sa.completed = 1 AND sa.created_at >= ? AND ${studentScope}
         GROUP BY DATE(sa.created_at)
         ORDER BY day ASC`,
        [sevenDaysAgo, uid]
      ),
      // Per-module quiz pass rate and avg score
      pool.query(
        `SELECT qa.module_id,
                ROUND(SUM(qa.passed) / NULLIF(COUNT(*), 0) * 100) AS pass_rate_pct,
                ROUND(AVG(qa.score / NULLIF(qa.total_questions, 0) * 100))  AS avg_score_pct,
                COUNT(*) AS total_attempts
         FROM quiz_attempts qa
         WHERE qa.user_id IN (
           SELECT ce.student_id FROM course_enrollments ce
           JOIN courses c ON ce.course_id = c.id
           WHERE c.instructor_id = ? AND ce.status = 'accepted'
         )
         GROUP BY qa.module_id
         ORDER BY qa.module_id ASC`,
        [uid]
      ),
      // Top FSM steps by total error count (most difficult steps first)
      pool.query(
        `SELECT ssr.step_key, SUM(ssr.error_count) AS total_errors
         FROM sim_step_results ssr
         JOIN sim_attempts sa ON ssr.sim_attempt_id = sa.id
         WHERE sa.completed = 1 AND ${studentScope}
         GROUP BY ssr.step_key
         ORDER BY total_errors DESC
         LIMIT 6`,
        [uid]
      ),
    ]);

    res.json({
      stats: {
        total_students:          studentCount[0].count,
        pending_requests:        pendingCount[0].count,
        total_attempts:          totalAttempts[0].count,
        average_score:           avgScore[0].avg_score ? Math.round(avgScore[0].avg_score) : 0,
        students_need_attention: needAttention[0].count,
        total_courses:           courseCount[0].count,
        active_this_week:        activeThisWeek[0].count,
        quiz_pass_rate:          quizPassRate[0].pass_rate || 0,
        top_performers:          topPerformers[0],
        weekly_sim_activity:     weeklyActivity[0],
        quiz_by_module:          quizByModule[0],
        step_errors:             stepErrors[0],
      },
    });
  } catch (e) {
    res.status(500).json({
      error: 'Failed to fetch statistics',
      ...(process.env.NODE_ENV !== 'production' && { details: e.message }),
    });
  }
});

// GET /api/instructor/dashboard/announcements — last 5 announcements across instructor's courses
router.get('/dashboard/announcements', authMiddleware, instructorOnly, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT ca.id, ca.title, ca.body, ca.created_at,
              c.name      AS course_name,
              u.full_name AS author_name
       FROM class_announcements ca
       JOIN courses c ON ca.course_id = c.id
       JOIN users   u ON ca.author_id  = u.id
       WHERE c.instructor_id = ?
       ORDER BY ca.created_at DESC
       LIMIT 5`,
      [req.user.id]
    );
    res.json({ announcements: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch announcements' });
  }
});

// GET /api/instructor/dashboard/step-students?step=stepKey — students with errors on one FSM step
router.get('/dashboard/step-students', authMiddleware, instructorOnly, async (req, res) => {
  const { step } = req.query;
  if (!step) return res.status(400).json({ error: 'step parameter required' });

  try {
    const [students] = await pool.query(
      `SELECT u.id, u.full_name,
              SUM(ssr.error_count)   AS total_errors,
              COUNT(DISTINCT sa.id)  AS attempts
       FROM sim_step_results ssr
       JOIN sim_attempts sa ON ssr.sim_attempt_id = sa.id
       JOIN users u         ON sa.user_id          = u.id
       WHERE ssr.step_key  = ?
         AND sa.completed  = 1
         AND sa.user_id IN (
           SELECT ce.student_id FROM course_enrollments ce
           JOIN courses c ON ce.course_id = c.id
           WHERE c.instructor_id = ? AND ce.status = 'accepted'
         )
       GROUP BY u.id, u.full_name
       HAVING total_errors > 0
       ORDER BY total_errors DESC
       LIMIT 20`,
      [step, req.user.id]
    );
    res.json({ students });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch step students' });
  }
});

// ==================== QUIZ ANALYTICS ====================

async function assertCourseAccess(userId, role, courseId) {
  if (role === 'admin') {
    if (courseId) {
      console.warn(
        '[audit] admin id=%d accessed analytics for course id=%d at %s',
        userId, courseId, new Date().toISOString()
      );
    }
    return true;
  }
  if (role !== 'instructor') return false;
  if (!courseId) return true;
  const [[row]] = await pool.query(
    'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
    [courseId, userId]
  );
  return !!row;
}

// GET /api/instructor/quiz/overview?courseId=…
router.get('/quiz/overview', authMiddleware, instructorOrAdmin, async (req, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  if (courseId !== null && (!Number.isInteger(courseId) || courseId < 1)) {
    return res.status(400).json({ error: 'INVALID_COURSE_ID' });
  }

  if (!(await assertCourseAccess(req.user.id, req.user.role, courseId))) {
    return res.status(403).json({ error: 'COURSE_ACCESS_DENIED' });
  }

  try {
    let studentScope, scopeParams, enrolledCountQuery, enrolledCountParams, mpScope, mpParams;

    if (courseId) {
      studentScope       = `qa.user_id IN (SELECT ce.student_id FROM course_enrollments ce WHERE ce.course_id = ? AND ce.status = 'accepted')`;
      scopeParams        = [courseId];
      enrolledCountQuery = `SELECT COUNT(DISTINCT ce.student_id) AS enrolled_count FROM course_enrollments ce WHERE ce.course_id = ? AND ce.status = 'accepted'`;
      enrolledCountParams = [courseId];
      mpScope            = `mp.user_id IN (SELECT ce.student_id FROM course_enrollments ce WHERE ce.course_id = ? AND ce.status = 'accepted')`;
      mpParams           = [courseId];
    } else if (req.user.role === 'instructor') {
      studentScope       = `qa.user_id IN (SELECT ce.student_id FROM course_enrollments ce JOIN courses c2 ON c2.id = ce.course_id WHERE c2.instructor_id = ? AND ce.status = 'accepted')`;
      scopeParams        = [req.user.id];
      enrolledCountQuery = `SELECT COUNT(DISTINCT ce.student_id) AS enrolled_count FROM course_enrollments ce JOIN courses c2 ON c2.id = ce.course_id WHERE c2.instructor_id = ? AND ce.status = 'accepted'`;
      enrolledCountParams = [req.user.id];
      mpScope            = `mp.user_id IN (SELECT ce.student_id FROM course_enrollments ce JOIN courses c2 ON c2.id = ce.course_id WHERE c2.instructor_id = ? AND ce.status = 'accepted')`;
      mpParams           = [req.user.id];
    } else {
      studentScope       = '1=1';
      scopeParams        = [];
      enrolledCountQuery = `SELECT COUNT(DISTINCT u.id) AS enrolled_count FROM users u WHERE u.role = 'student'`;
      enrolledCountParams = [];
      mpScope            = '1=1';
      mpParams           = [];
    }

    const since       = req.query.since || null;
    const sinceClause = since ? 'AND qa.created_at >= ?' : '';
    const sinceParam  = since ? [since] : [];

    const [[{ enrolled_count }]] = await pool.query(enrolledCountQuery, enrolledCountParams);

    const [[rows], [moduleCompletionRows]] = await Promise.all([
      pool.query(
        `SELECT
           qa.module_id,
           COUNT(*)                                                        AS total_attempts,
           COUNT(DISTINCT qa.user_id)                                      AS distinct_students,
           ROUND(AVG(qa.score / NULLIF(qa.total_questions, 0) * 100))     AS avg_score_pct,
           ROUND(SUM(qa.passed) / COUNT(*) * 100)                         AS pass_rate_pct,
           ROUND(AVG(qa.time_spent))                                       AS avg_time_seconds,
           MAX(qa.score)                                                   AS top_score,
           ROUND(AVG(qa.is_first_pass) * 100)                             AS first_pass_rate_pct,
           ROUND(AVG(qa.max_streak), 1)                                   AS avg_max_streak
         FROM quiz_attempts qa
         WHERE ${studentScope} ${sinceClause}
         GROUP BY qa.module_id
         ORDER BY qa.module_id ASC`,
        [...scopeParams, ...sinceParam]
      ),
      pool.query(
        `SELECT mp.module_id,
                ROUND(COUNT(CASE WHEN mp.completed = 1 THEN 1 END) * 100.0 / NULLIF(?, 0)) AS module_completion_pct
         FROM module_progress mp
         WHERE ${mpScope}
         GROUP BY mp.module_id`,
        [enrolled_count, ...mpParams]
      ),
    ]);

    const completionMap = {};
    moduleCompletionRows.forEach(r => { completionMap[r.module_id] = r.module_completion_pct || 0; });

    const overview = rows.map(r => ({
      ...r,
      coverage_rate_pct:     enrolled_count > 0 ? Math.round((r.distinct_students / enrolled_count) * 100) : 0,
      module_completion_pct: completionMap[r.module_id] ?? 0,
    }));

    res.json({ success: true, overview });
  } catch (err) {
    console.error('instructor quiz overview error', { err: err.message });
    res.status(500).json({ error: 'Failed to load quiz overview' });
  }
});

// GET /api/instructor/quiz/students/:studentId/attempts?courseId=…
router.get('/quiz/students/:studentId/attempts', authMiddleware, instructorOrAdmin, async (req, res) => {
  const studentId = Number(req.params.studentId);
  if (!Number.isInteger(studentId) || studentId < 1) {
    return res.status(400).json({ error: 'INVALID_STUDENT_ID' });
  }

  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  if (courseId !== null && (!Number.isInteger(courseId) || courseId < 1)) {
    return res.status(400).json({ error: 'INVALID_COURSE_ID' });
  }

  if (!(await assertCourseAccess(req.user.id, req.user.role, courseId))) {
    return res.status(403).json({ error: 'COURSE_ACCESS_DENIED' });
  }

  try {
    let query, params;
    if (courseId) {
      const [[enrollment]] = await pool.query(
        `SELECT id FROM course_enrollments WHERE course_id = ? AND student_id = ? AND status = 'accepted'`,
        [courseId, studentId]
      );
      if (!enrollment) return res.status(403).json({ error: 'STUDENT_NOT_IN_COURSE' });

      query = `
        SELECT qa.id, qa.module_id, qa.score, qa.total_questions, qa.passed,
               qa.time_spent, qa.max_streak, qa.xp_earned, qa.is_first_pass, qa.created_at,
               ROUND((qa.score / NULLIF(qa.total_questions, 0)) * 100) AS percentage
        FROM quiz_attempts qa
        WHERE qa.user_id = ? AND qa.course_id = ?
        ORDER BY qa.created_at DESC`;
      params = [studentId, courseId];
    } else {
      if (req.user.role === 'instructor') {
        const [[enrollment]] = await pool.query(
          `SELECT ce.id FROM course_enrollments ce
           JOIN courses c ON ce.course_id = c.id
           WHERE c.instructor_id = ? AND ce.student_id = ? AND ce.status = 'accepted'
           LIMIT 1`,
          [req.user.id, studentId]
        );
        if (!enrollment) return res.status(403).json({ error: 'STUDENT_NOT_IN_YOUR_COURSES' });
      }

      // [Fix: cross-course data leak] Previously returned ALL quiz attempts for the
      // student regardless of which instructor taught the course, as long as the
      // student was enrolled in any of the requesting instructor's courses.
      // Now restricts to: (a) legacy null-course rows and (b) attempts belonging
      // to courses this instructor teaches AND the student is enrolled in.
      query = `
        SELECT qa.id, qa.module_id, qa.score, qa.total_questions, qa.passed,
               qa.time_spent, qa.max_streak, qa.xp_earned, qa.is_first_pass, qa.created_at,
               ROUND((qa.score / NULLIF(qa.total_questions, 0)) * 100) AS percentage,
               c.name AS course_name
        FROM quiz_attempts qa
        LEFT JOIN courses c ON c.id = qa.course_id
        WHERE qa.user_id = ?
          AND (
            qa.course_id IS NULL
            OR qa.course_id IN (
              SELECT ce2.course_id
              FROM course_enrollments ce2
              JOIN courses c2 ON c2.id = ce2.course_id
              WHERE c2.instructor_id = ? AND ce2.student_id = ? AND ce2.status = 'accepted'
            )
          )
        ORDER BY qa.created_at DESC`;
      params = [studentId, req.user.id, studentId];
    }

    const [attempts] = await pool.query(query, params);
    res.json({ success: true, attempts });
  } catch (err) {
    console.error('instructor student attempts error', { err: err.message });
    res.status(500).json({ error: 'Failed to load student quiz attempts' });
  }
});

// GET /api/instructor/quiz/hardest-questions?courseId=…&moduleId=…
router.get('/quiz/hardest-questions', authMiddleware, instructorOrAdmin, async (req, res) => {
  const courseId = req.query.courseId ? Number(req.query.courseId) : null;
  if (courseId !== null && (!Number.isInteger(courseId) || courseId < 1)) {
    return res.status(400).json({ error: 'INVALID_COURSE_ID' });
  }

  const moduleId = req.query.moduleId ? Number(req.query.moduleId) : null;
  if (moduleId !== null && (!Number.isInteger(moduleId) || moduleId < 1)) {
    return res.status(400).json({ error: 'INVALID_MODULE_ID' });
  }

  const since = req.query.since || null;

  if (!(await assertCourseAccess(req.user.id, req.user.role, courseId))) {
    return res.status(403).json({ error: 'COURSE_ACCESS_DENIED' });
  }
  if (moduleId !== null && moduleId > TOTAL_MODULES) {
    return res.status(400).json({ error: 'INVALID_MODULE_ID' });
  }

  try {
    const conditions = ['1=1'];
    const params     = [];

    if (courseId) {
      conditions.push('qa.user_id IN (SELECT ce.student_id FROM course_enrollments ce WHERE ce.course_id = ? AND ce.status = \'accepted\')');
      params.push(courseId);
    } else if (req.user.role === 'instructor') {
      conditions.push('qa.user_id IN (SELECT ce.student_id FROM course_enrollments ce JOIN courses c2 ON c2.id = ce.course_id WHERE c2.instructor_id = ? AND ce.status = \'accepted\')');
      params.push(req.user.id);
    }
    if (moduleId) {
      conditions.push('qa.module_id = ?');
      params.push(moduleId);
    }
    if (since) {
      conditions.push('qa.created_at >= ?');
      params.push(since);
    }

    const where = conditions.join(' AND ');

    // [Fix H] miss_rate_pct denominator uses SUM(answered) — not COUNT(*) — so timeouts
    // don't dilute the miss rate. A question where 50% timed out and 50% answered wrong
    // now correctly shows 100% miss rate (wrong / answered), not 50% (wrong / total).
    const query = `
      SELECT
        aaa.question_id,
        qa.module_id,
        COUNT(*)                                                                          AS total_answers,
        SUM(CASE WHEN aaa.is_correct = 0 AND aaa.picked_option IS NOT NULL THEN 1 ELSE 0 END) AS wrong_answers,
        SUM(CASE WHEN aaa.picked_option IS NULL THEN 1 ELSE 0 END)                        AS timeouts,
        ROUND(
          SUM(CASE WHEN aaa.is_correct = 0 AND aaa.picked_option IS NOT NULL THEN 1 ELSE 0 END)
          / NULLIF(SUM(CASE WHEN aaa.picked_option IS NOT NULL THEN 1 ELSE 0 END), 0) * 100
        ) AS miss_rate_pct,
        ROUND(AVG(aaa.time_spent_ms)) AS avg_time_ms
      FROM quiz_attempt_answers aaa
      JOIN quiz_attempts qa ON qa.id = aaa.attempt_id
      WHERE ${where}
      GROUP BY aaa.question_id, qa.module_id
      ORDER BY miss_rate_pct DESC, total_answers DESC
      LIMIT 20`;

    const [rows] = await pool.query(query, params);
    const questions = rows.map(q => ({
      ...q,
      question_text: getQuestionText(q.module_id, q.question_id),
    }));
    res.json({ success: true, questions });
  } catch (err) {
    console.error('hardest questions error', { err: err.message });
    res.status(500).json({ error: 'Failed to load hardest questions' });
  }
});

// GET /api/instructor/quiz/learning-curve?courseId=…&studentId=…
router.get('/quiz/learning-curve', authMiddleware, instructorOrAdmin, async (req, res) => {
  const courseId  = req.query.courseId  ? Number(req.query.courseId)  : null;
  if (courseId !== null && (!Number.isInteger(courseId) || courseId < 1)) {
    return res.status(400).json({ error: 'INVALID_COURSE_ID' });
  }

  const studentId = req.query.studentId ? Number(req.query.studentId) : null;
  if (!studentId || !Number.isInteger(studentId) || studentId < 1) {
    return res.status(400).json({ error: 'studentId required' });
  }

  if (!(await assertCourseAccess(req.user.id, req.user.role, courseId))) {
    return res.status(403).json({ error: 'COURSE_ACCESS_DENIED' });
  }

  try {
    // Verify instructor-student relationship when no courseId is scoping the request.
    // Without this, any instructor knowing a student's ID can fetch their full quiz history.
    if (!courseId && req.user.role === 'instructor') {
      const [[enrollment]] = await pool.query(
        `SELECT ce.id FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE c.instructor_id = ? AND ce.student_id = ? AND ce.status = 'accepted'
         LIMIT 1`,
        [req.user.id, studentId]
      );
      if (!enrollment) return res.status(403).json({ error: 'STUDENT_NOT_IN_YOUR_COURSES' });
    }

    // [Fix: courseId ownership check didn't scope the query] Previously the query
    // filtered only by user_id, so passing a courseId you own + any studentId returned
    // that student's full quiz history across all courses. Now the query is scoped by
    // courseId when provided.
    const curveWhere  = courseId ? 'qa.user_id = ? AND qa.course_id = ?' : 'qa.user_id = ?';
    const curveParams = courseId ? [studentId, courseId] : [studentId];

    const [rows] = await pool.query(
      `SELECT qa.module_id,
              ROW_NUMBER() OVER (PARTITION BY qa.module_id ORDER BY qa.created_at ASC) AS attempt_number,
              ROUND((qa.score / NULLIF(qa.total_questions, 0)) * 100) AS score_pct,
              qa.time_spent,
              qa.passed,
              qa.created_at
       FROM quiz_attempts qa
       WHERE ${curveWhere}
       ORDER BY qa.module_id, qa.created_at ASC`,
      curveParams
    );
    res.json({ success: true, curve: rows });
  } catch (err) {
    console.error('learning curve error', { err: err.message });
    res.status(500).json({ error: 'Failed to load learning curve data' });
  }
});

// ==================== HELPER FUNCTIONS ====================

function getPerformanceLevel(avgScore) {
  if (!avgScore || avgScore === 0) return 'needs-attention';
  if (avgScore >= 90) return 'excellent';
  if (avgScore >= 75) return 'good';
  if (avgScore >= 60) return 'satisfactory';
  return 'needs-attention';
}

function formatTimeAgo(seconds) {
  if (seconds < 60)    return 'just now';
  if (seconds < 3600)  return `${Math.floor(seconds / 60)} minutes ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
  return `${Math.floor(seconds / 86400)} days ago`;
}

module.exports = router;