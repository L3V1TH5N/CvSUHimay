// file path: backend/src/routes/simulation.js

'use strict';

const express   = require('express');
const pool      = require('../db');
const rateLimit = require('express-rate-limit');
// [Fix: mastery N+1] computeMasteryScore removed — mastery is now computed inline
// with an incremental running-average approach that requires no full-history fetch.
const { computeStepScore, computeSessionScore } = require('../utils/simScoring');

const router = express.Router();

const authMiddleware           = require('../middleware/auth');
const { requireActiveAccount } = require('../middleware/auth');
const instructorOnly           = require('../middleware/instructorOnly');

const BONE_MAX = { rib: 26, dorsal: 87, ventral: 48, lateral: 42 };

const STRUGGLING_THRESHOLD = 60;

const WEIGHTS = { 1: 8, 2: 5, 3: 0, 4: 8, 5: 8, 6: 10, 7: 18, 8: 15, 9: 15, 10: 5, 11: 8 };

// [Fix: events cap] Maximum events accepted per session save. Unbounded events arrays
// produced unbounded single-query INSERT payloads and could exhaust max_allowed_packet.
const MAX_EVENTS = 2000;

const analyticsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  keyGenerator: (req) => `user:${req.user?.id ?? 'unknown'}`,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many analytics requests. Please wait a moment before retrying.' },
});

// ── Shared analytics query builder ────────────────────────────────────────────
async function buildAnalyticsPayload(filter) {
  const isCourse = filter.type === 'course';
  const since     = filter.since || null;

  const whereFilter = isCourse
    ? 'sa.course_id = ?'
    : `sa.user_id IN (
         SELECT ce.student_id FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE c.instructor_id = ? AND ce.status = 'accepted'
       )`;

  const sinceClause = since ? 'AND sa.created_at >= ?' : '';
  const bp          = [filter.id];           // base param (courseId or instructorId)
  const sp          = since ? [since] : [];  // since param
  const qp          = [...bp, ...sp];        // base + since, used by most queries

  // Subquery returning enrolled student IDs — used for tables that don't join via sim_attempts
  const enrolledUsersSubq = isCourse
    ? `SELECT ce.student_id FROM course_enrollments ce WHERE ce.course_id = ? AND ce.status = 'accepted'`
    : `SELECT ce.student_id FROM course_enrollments ce JOIN courses c ON ce.course_id = c.id WHERE c.instructor_id = ? AND ce.status = 'accepted'`;

  const [
    [[summary]],
    [avgTimePerStep],
    [stepDifficulty],
    [errorHeatmap],
    [strugglingStudents],
    [cohortProgress],
    [scoreDistribution],
    [[boneCompletion]],
    [toolUsage],
    // ── Phase 2 additions ─────────────────────────────────
    [stepMastery],
    [sessionDurationTrend],
    [[repeatBuckets]],
    [[engagementDistribution]],
  ] = await Promise.all([

    pool.query(
      `SELECT
         COUNT(DISTINCT sa.user_id)                         AS student_count,
         COUNT(*)                                           AS total_sessions,
         ROUND(AVG(sa.score_percent))                       AS avg_score,
         ROUND(SUM(sa.passed) / NULLIF(COUNT(*), 0) * 100) AS pass_rate,
         ROUND(AVG(sa.hints_used), 1)                       AS hint_usage_avg
       FROM sim_attempts sa
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}`,
      qp
    ),

    pool.query(
      `SELECT ssr.step_id, MAX(ssr.step_key) AS step_key,
              ROUND(AVG(ssr.time_spent_seconds)) AS avg_seconds
       FROM sim_step_results ssr
       JOIN sim_attempts sa ON ssr.sim_attempt_id = sa.id
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       GROUP BY ssr.step_id ORDER BY ssr.step_id`,
      qp
    ),

    pool.query(
      `SELECT ssr.step_id, MAX(ssr.step_key) AS step_key,
              ROUND(AVG(ssr.error_count), 2)     AS avg_errors,
              ROUND(AVG(ssr.accuracy_factor), 3) AS avg_accuracy
       FROM sim_step_results ssr
       JOIN sim_attempts sa ON ssr.sim_attempt_id = sa.id
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       GROUP BY ssr.step_id ORDER BY avg_errors DESC`,
      qp
    ),

    pool.query(
      `SELECT sel.step_id, sel.error_class, COUNT(*) AS count
       FROM sim_error_log sel
       JOIN sim_attempts sa ON sel.sim_attempt_id = sa.id
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       GROUP BY sel.step_id, sel.error_class ORDER BY sel.step_id`,
      qp
    ),

    // [Fix: pagination signal] LIMIT 51 instead of 50 so we can detect truncation.
    // Response slices to 50 and sets struggling_students_has_more when row 51 exists.
    // [Fix C] Removed spurious JOIN course_enrollments: the extra join required ce.status = 'accepted'
    // for the specific course the attempt is tagged to, making struggling_students a strict subset of
    // the other 6 queries and producing inconsistent student counts on the dashboard.
    pool.query(
      `SELECT u.id, u.full_name,
              ROUND(AVG(sa.score_percent)) AS avg_score,
              COUNT(*) AS total_attempts
       FROM sim_attempts sa
       JOIN users u ON sa.user_id = u.id
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       GROUP BY sa.user_id, u.full_name
       HAVING avg_score < ${STRUGGLING_THRESHOLD}
       ORDER BY avg_score ASC
       LIMIT 51`,
      qp
    ),

    // [Fix: cohort dedup] Instructor-scoped variant uses ROW_NUMBER() to deduplicate
    // per (user_id, attempt_number). Without this, a student enrolled in 2 of the
    // instructor's courses contributes 2 rows to "Session 1" — inflating student_count
    // and skewing the average. Course-scoped variant is unaffected (attempt_numbers
    // are unique per user per course) so it keeps the simpler query.
    isCourse
      ? pool.query(
          `SELECT sa.attempt_number,
                  ROUND(AVG(sa.score_percent)) AS avg_score,
                  ROUND(AVG(sa.hints_used), 1) AS avg_hints,
                  COUNT(*) AS student_count
           FROM sim_attempts sa
           WHERE sa.course_id = ? AND sa.completed = 1 ${sinceClause}
           GROUP BY sa.attempt_number ORDER BY sa.attempt_number
           LIMIT 31`,
          qp
        )
      : pool.query(
          `SELECT attempt_number,
                  ROUND(AVG(score_percent)) AS avg_score,
                  ROUND(AVG(hints_used), 1) AS avg_hints,
                  COUNT(*) AS student_count
           FROM (
             SELECT sa.user_id, sa.attempt_number, sa.score_percent, sa.hints_used,
                    ROW_NUMBER() OVER (PARTITION BY sa.user_id, sa.attempt_number ORDER BY sa.created_at DESC) AS rn
             FROM sim_attempts sa
             WHERE sa.user_id IN (
               SELECT ce.student_id FROM course_enrollments ce
               JOIN courses c ON ce.course_id = c.id
               WHERE c.instructor_id = ? AND ce.status = 'accepted'
             ) AND sa.completed = 1 ${sinceClause}
           ) deduped
           WHERE deduped.rn = 1
           GROUP BY attempt_number ORDER BY attempt_number
           LIMIT 31`,
          qp
        ),

    pool.query(
      `SELECT LEAST(FLOOR(sa.score_percent / 10) * 10, 90) AS bucket_min,
              COUNT(*) AS count
       FROM sim_attempts sa
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       GROUP BY bucket_min ORDER BY bucket_min`,
      qp
    ),

    // Bone completion: class-average extraction rate per bone group
    pool.query(
      `SELECT
         ROUND(AVG(sbc.dorsal  / 87 * 100)) AS dorsal_pct,
         ROUND(AVG(sbc.ventral / 48 * 100)) AS ventral_pct,
         ROUND(AVG(sbc.lateral / 42 * 100)) AS lateral_pct
       FROM sim_bone_counts sbc
       JOIN sim_attempts sa ON sbc.sim_attempt_id = sa.id
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}`,
      qp
    ),

    // Tool usage: aggregate selection + wrong-trigger counts per step per tool
    pool.query(
      `SELECT stu.step_id,
              MAX(ssr.step_key)                                            AS step_key,
              stu.tool_name,
              SUM(stu.selection_count)                                     AS total_uses,
              SUM(stu.wrong_tool_triggers)                                 AS total_wrong,
              ROUND(
                SUM(stu.wrong_tool_triggers) /
                NULLIF(SUM(stu.selection_count), 0) * 100
              )                                                            AS wrong_rate_pct
       FROM sim_tool_usage stu
       JOIN sim_attempts sa  ON stu.sim_attempt_id = sa.id
       LEFT JOIN sim_step_results ssr ON ssr.sim_attempt_id = sa.id AND ssr.step_id = stu.step_id
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       GROUP BY stu.step_id, stu.tool_name
       ORDER BY wrong_rate_pct DESC, total_wrong DESC`,
      qp
    ),

    // Step mastery per step (lifetime, no since filter)
    pool.query(
      `SELECT sm.step_id,
              ROUND(AVG(sm.mastery_score), 1)  AS avg_mastery,
              ROUND(AVG(sm.avg_accuracy), 1)   AS avg_accuracy,
              ROUND(MAX(sm.best_accuracy), 1)  AS best_accuracy,
              SUM(sm.attempts_count)           AS total_attempts
       FROM sim_mastery sm
       WHERE sm.user_id IN (${enrolledUsersSubq})
       GROUP BY sm.step_id
       ORDER BY sm.step_id`,
      bp
    ),

    // Avg session duration per attempt number across the class
    pool.query(
      `SELECT sa.attempt_number,
              ROUND(AVG(sa.duration_seconds)) AS avg_duration,
              COUNT(DISTINCT sa.user_id)      AS student_count
       FROM sim_attempts sa
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       GROUP BY sa.attempt_number
       ORDER BY sa.attempt_number
       LIMIT 20`,
      qp
    ),

    // Repeat learner buckets: 1 session / 2-3 / 4+
    pool.query(
      `SELECT
         SUM(CASE WHEN cnt = 1 THEN 1 ELSE 0 END)                     AS one,
         SUM(CASE WHEN cnt BETWEEN 2 AND 3 THEN 1 ELSE 0 END)         AS few,
         SUM(CASE WHEN cnt >= 4 THEN 1 ELSE 0 END)                    AS many
       FROM (
         SELECT sa.user_id, COUNT(*) AS cnt
         FROM sim_attempts sa
         WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
         GROUP BY sa.user_id
       ) sub`,
      qp
    ),

    // Engagement distribution: last sim session recency buckets (not filtered by since)
    pool.query(
      `SELECT
         SUM(CASE WHEN last_attempt >= DATE_SUB(NOW(), INTERVAL 14 DAY) THEN 1 ELSE 0 END)  AS active,
         SUM(CASE WHEN last_attempt >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                   AND last_attempt  < DATE_SUB(NOW(), INTERVAL 14 DAY) THEN 1 ELSE 0 END)  AS moderate,
         SUM(CASE WHEN last_attempt IS NOT NULL
                   AND last_attempt  < DATE_SUB(NOW(), INTERVAL 30 DAY) THEN 1 ELSE 0 END)  AS inactive,
         SUM(CASE WHEN last_attempt IS NULL THEN 1 ELSE 0 END)                               AS none
       FROM (
         SELECT eu.student_id, MAX(sa.created_at) AS last_attempt
         FROM (${enrolledUsersSubq}) eu
         LEFT JOIN sim_attempts sa ON sa.user_id = eu.student_id AND sa.completed = 1
         GROUP BY eu.student_id
       ) sub`,
      bp
    ),
  ]);

  return {
    ...summary,
    avg_time_per_step:            avgTimePerStep,
    step_difficulty:              stepDifficulty,
    error_heatmap:                errorHeatmap,
    // Slice to display limit; has_more tells the client data was truncated
    struggling_students:          strugglingStudents.slice(0, 50),
    struggling_students_has_more: strugglingStudents.length > 50,
    cohort_progress:              cohortProgress.slice(0, 30),
    cohort_progress_has_more:     cohortProgress.length > 30,
    score_distribution:           scoreDistribution,
    bone_completion:              boneCompletion || null,
    tool_usage:                   toolUsage,
    // Phase 2
    step_mastery:                 stepMastery,
    session_duration_trend:       sessionDurationTrend,
    repeat_learner_buckets:       repeatBuckets  || { one: 0, few: 0, many: 0 },
    engagement_distribution:      engagementDistribution || { active: 0, moderate: 0, inactive: 0, none: 0 },
  };
}

// ── POST /api/sim/sessions ────────────────────────────────────────────────────
router.post('/sessions', authMiddleware, requireActiveAccount, async (req, res) => {
  const userId = req.user.id;
  const {
    attempt_id,
    step_results         = [],
    events               = [],
    bone_counts          = { dorsal: 0, ventral: 0, lateral: 0 },
    wash_quality_percent = 0,
    duration_seconds     = 0,
    hints_used           = 0,
    completed            = false,
  } = req.body;

  if (!Number.isInteger(attempt_id) || attempt_id < 1)
    return res.status(400).json({ error: 'attempt_id must be a positive integer' });

  if (!Array.isArray(step_results) || step_results.length === 0 || step_results.length > 11)
    return res.status(400).json({ error: 'step_results must be an array of 1–11 items' });

  if (!Number.isInteger(wash_quality_percent) || wash_quality_percent < 0 || wash_quality_percent > 100)
    return res.status(400).json({ error: 'wash_quality_percent must be 0–100' });

  // [Fix: events cap] Reject oversized events arrays before entering the transaction.
  // Without this, a client sending 50 000 events produces a single INSERT that can
  // exceed max_allowed_packet and time out inside the transaction.
  if (!Array.isArray(events))
    return res.status(400).json({ error: 'events must be an array' });
  if (events.length > MAX_EVENTS)
    return res.status(400).json({ error: `events array exceeds maximum of ${MAX_EVENTS} items` });

  for (const sr of step_results) {
    if (!Number.isInteger(sr.step_id) || sr.step_id < 1 || sr.step_id > 11)
      return res.status(400).json({ error: `Invalid step_id: ${sr.step_id}` });
  }

  const safeBones = {
    rib:     Math.min(Number(bone_counts.rib)     || 0, BONE_MAX.rib),
    dorsal:  Math.min(Number(bone_counts.dorsal)  || 0, BONE_MAX.dorsal),
    ventral: Math.min(Number(bone_counts.ventral) || 0, BONE_MAX.ventral),
    lateral: Math.min(Number(bone_counts.lateral) || 0, BONE_MAX.lateral),
  };

  const conn = await pool.getConnection();
  try {
    const [[attempt]] = await conn.query(
      'SELECT id, course_id FROM attempts WHERE id = ? AND user_id = ?',
      [attempt_id, userId]
    );
    if (!attempt) { conn.release(); return res.status(403).json({ error: 'Attempt not found or access denied' }); }
    // null course_id is allowed — students without an accepted enrollment can still practice.
    // Their sessions are saved but won't appear in instructor analytics (filtered by enrollment).

    const [[existing]] = await conn.query(
      'SELECT id FROM sim_attempts WHERE attempt_id = ?',
      [attempt_id]
    );
    if (existing) { conn.release(); return res.status(409).json({ error: 'Session detail already saved for this attempt' }); }

    const computedSteps = step_results.map(sr => {
      const { earnedScore, accuracyFactor, efficiencyFactor, qualityFactor, correctActions } =
        computeStepScore(sr, safeBones);
      return {
        step_id:           sr.step_id,
        step_key:          sr.step_key ?? '',
        earnedScore,
        accuracyFactor,
        efficiencyFactor,
        qualityFactor,
        correctActions,
        error_count:        sr.error_count        ?? 0,
        time_spent_seconds: sr.time_spent_seconds ?? 0,
        completed:          sr.completed ? 1 : 0,
        errors:             Array.isArray(sr.errors)     ? sr.errors     : [],
        tool_usage:         Array.isArray(sr.tool_usage) ? sr.tool_usage : [],
        hint_level:         sr.hint_level ?? 0,
      };
    });

    const { rawScore, scorePercent, grade, passed } = computeSessionScore(computedSteps);
    const totalErrors    = computedSteps.reduce((s, r) => s + r.error_count, 0);
    const stepsCompleted = computedSteps.filter(r => r.completed).length;
    const bonesTotal     = safeBones.dorsal + safeBones.ventral + safeBones.lateral;

    await conn.beginTransaction();

    // [Fix A] Count per-user per-course so attempt_number is scoped to the course.
    // Global counting made attempt_number semantically invalid for per-course cohort
    // progress: student A's attempt #3 in Course X and student B's #3 in Course Y
    // were averaged together as if they were the same session number.
    const [[{ cnt: prevCount }]] = await conn.query(
      'SELECT COUNT(*) AS cnt FROM sim_attempts WHERE user_id = ? AND course_id <=> ?',
      [userId, attempt.course_id]
    );
    const attemptNumber = Number(prevCount) + 1;

    const [saResult] = await conn.query(
      `INSERT INTO sim_attempts
         (attempt_id, user_id, course_id, attempt_number, raw_score, score_percent,
          passed, completed, duration_seconds, total_errors, hints_used,
          steps_completed, wash_quality_percent, bones_total, scoring_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'v2')`,
      [
        attempt_id, userId, attempt.course_id, attemptNumber, rawScore, scorePercent,
        passed ? 1 : 0, completed ? 1 : 0, duration_seconds, totalErrors,
        hints_used, stepsCompleted, wash_quality_percent, bonesTotal,
      ]
    );
    const simAttemptId = saResult.insertId;

    // [Fix: batch insert] sim_step_results — replaced sequential per-step INSERTs with
    // a single batch INSERT. Eliminates up to 11 round trips inside the transaction.
    const stepRows = computedSteps.map(s => [
      simAttemptId, s.step_id, s.step_key, WEIGHTS[s.step_id] ?? 0,
      s.earnedScore, s.accuracyFactor, s.efficiencyFactor, s.qualityFactor,
      s.error_count, s.correctActions, s.time_spent_seconds, s.completed,
      s.hint_level,
    ]);
    await conn.query(
      `INSERT INTO sim_step_results
         (sim_attempt_id, step_id, step_key, score_weight, earned_score,
          accuracy_factor, efficiency_factor, quality_factor,
          error_count, correct_actions, time_spent_seconds, completed, hint_level)
       VALUES ?`,
      [stepRows]
    );

    // [Fix: batch insert] sim_error_log — collect all error rows across all steps,
    // then insert in one query instead of one INSERT per error per step.
    const errorRows = [];
    for (const s of computedSteps) {
      for (const e of s.errors) {
        if (!e.class) continue;
        const severity = e.class === 'missed_bone'    ? 'critical'
                       : e.class === 'wrong_cut_path' ? 'major' : 'minor';
        errorRows.push([
          simAttemptId, s.step_id, e.class, severity,
          e.tool_active ?? null, e.client_timestamp ?? Date.now(),
        ]);
      }
    }
    if (errorRows.length > 0) {
      await conn.query(
        `INSERT INTO sim_error_log
           (sim_attempt_id, step_id, error_class, severity, tool_active, client_timestamp)
         VALUES ?`,
        [errorRows]
      );
    }

    await conn.query(
      `INSERT INTO sim_bone_counts
         (sim_attempt_id, rib, dorsal, ventral, lateral)
       VALUES (?, ?, ?, ?, ?)`,
      [simAttemptId, safeBones.rib, safeBones.dorsal, safeBones.ventral, safeBones.lateral]
    );

    // [Fix: batch insert] sim_tool_usage — collect all tool rows across all steps,
    // then issue one batch INSERT … ON DUPLICATE KEY UPDATE instead of one per tool per step.
    const toolRows = [];
    for (const s of computedSteps) {
      for (const t of s.tool_usage) {
        if (!t.tool_name) continue;
        toolRows.push([
          simAttemptId, s.step_id, t.tool_name,
          t.selection_count     ?? 0,
          t.active_seconds      ?? 0,
          t.wrong_tool_triggers ?? 0,
        ]);
      }
    }
    if (toolRows.length > 0) {
      await conn.query(
        `INSERT INTO sim_tool_usage
           (sim_attempt_id, step_id, tool_name, selection_count, active_seconds, wrong_tool_triggers)
         VALUES ?
         ON DUPLICATE KEY UPDATE
           selection_count     = selection_count + VALUES(selection_count),
           active_seconds      = active_seconds + VALUES(active_seconds),
           wrong_tool_triggers = wrong_tool_triggers + VALUES(wrong_tool_triggers)`,
        [toolRows]
      );
    }

    if (events.length > 0) {
      const eventRows = events.map(e => [
        simAttemptId,
        e.step_id      ?? 0,
        e.event_type   ?? 'unknown',
        e.payload          ? JSON.stringify(e.payload)         : null,
        e.geometric_trace  ? JSON.stringify(e.geometric_trace) : null,
        e.client_timestamp ?? Date.now(),
      ]);
      await conn.query(
        `INSERT INTO sim_event_log
           (sim_attempt_id, step_id, event_type, payload, geometric_trace, client_timestamp)
         VALUES ?`,
        [eventRows]
      );
    }

    await conn.commit();

    // ── Update mastery (outside transaction — failure is non-fatal) ───────────
    // [Fix D] Previous approach: SELECT row → compute in JS → UPSERT.
    // Two concurrent saves for the same user both read the same row, compute
    // attemptsCount = prevCount + 1 from the same prevCount, and clobber each other.
    // Fix: single atomic UPSERT with all arithmetic inside SQL — no prior SELECT needed.
    // Formula: currentAccuracy * 0.6 + newAllTimeAvg * 0.4
    //   (replaces recentAvg(last 3) * 0.6 + allTimeAvg * 0.4 — loses the recency window
    //    but eliminates the read-compute-write race entirely)
    try {
      for (const s of computedSteps) {
        if (!s.completed) continue;
        const initialMastery = Math.round(s.accuracyFactor * 100 * 100) / 100;
        await pool.query(
          `INSERT INTO sim_mastery
             (user_id, step_id, mastery_score, attempts_count, best_accuracy, avg_accuracy, avg_time_seconds)
           VALUES (?, ?, ?, 1, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             attempts_count   = attempts_count + 1,
             avg_accuracy     = (avg_accuracy * attempts_count + VALUES(avg_accuracy)) / (attempts_count + 1),
             best_accuracy    = GREATEST(best_accuracy, VALUES(best_accuracy)),
             avg_time_seconds = ROUND((avg_time_seconds * attempts_count + VALUES(avg_time_seconds)) / (attempts_count + 1)),
             mastery_score    = ROUND(
               (VALUES(avg_accuracy) * 0.6
                + (avg_accuracy * attempts_count + VALUES(avg_accuracy)) / (attempts_count + 1) * 0.4
               ) * 100, 2
             )`,
          [userId, s.step_id, initialMastery, s.accuracyFactor, s.accuracyFactor, s.time_spent_seconds]
        );
      }
    } catch (masteryErr) {
      console.error('[sim] mastery update error:', masteryErr?.message);
    }

    const stepScores = {};
    for (const s of computedSteps) {
      stepScores[s.step_id] = {
        earned:     s.earnedScore,
        weight:     WEIGHTS[s.step_id] ?? 0,
        accuracy:   s.accuracyFactor,
        efficiency: s.efficiencyFactor,
        quality:    s.qualityFactor,
      };
    }

    res.json({
      sim_attempt_id: simAttemptId,
      score_percent:  scorePercent,
      grade,
      passed,
      raw_score:      rawScore,
      step_scores:    stepScores,
    });

  } catch (err) {
    await conn.rollback().catch(() => {});

    // [Fix: ER_DUP_ENTRY ambiguity] A MySQL 1062 duplicate-key error inside the
    // transaction means either:
    //   (a) attempt_id race: two concurrent requests for the same attempt_id both
    //       passed the pre-check before either committed.
    //   (b) (user_id, attempt_number) race: two concurrent saves counted the same
    //       prevCount and tried to insert the same attempt_number.
    // Both are safe to surface as 409 (not 500) — the request is not a server error.
    // The previous code fell through to the 500 handler for both cases.
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ error: 'Concurrent submission conflict. Please retry.' });
    }

    console.error('[sim] session save error:', err?.message);
    res.status(500).json({
      error: 'Failed to save simulation session',
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
  } finally {
    conn.release();
  }
});

// ── GET /api/sim/sessions ─────────────────────────────────────────────────────
router.get('/sessions', authMiddleware, requireActiveAccount, async (req, res) => {
  const limit  = Math.min(parseInt(req.query.limit)  || 10, 50);
  const offset = parseInt(req.query.offset) || 0;

  try {
    const [rows] = await pool.query(
      `SELECT id AS sim_attempt_id, attempt_number, score_percent, grade,
              passed, completed, duration_seconds, steps_completed,
              total_errors, hints_used, bones_total, created_at
       FROM sim_attempts
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [req.user.id, limit, offset]
    );
    const [[{ total }]] = await pool.query(
      'SELECT COUNT(*) AS total FROM sim_attempts WHERE user_id = ?',
      [req.user.id]
    );
    res.json({ sessions: rows, total: Number(total), limit, offset });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch sessions',
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
  }
});

// ── GET /api/sim/sessions/:id ─────────────────────────────────────────────────
router.get('/sessions/:id', authMiddleware, requireActiveAccount, async (req, res) => {
  const simAttemptId = parseInt(req.params.id);
  if (!Number.isInteger(simAttemptId) || simAttemptId < 1)
    return res.status(400).json({ error: 'Invalid session id' });

  try {
    const [[session]] = await pool.query(
      'SELECT * FROM sim_attempts WHERE id = ?',
      [simAttemptId]
    );
    if (!session) return res.status(404).json({ error: 'Session not found' });

    if (req.user.role === 'student' && session.user_id !== req.user.id)
      return res.status(403).json({ error: 'Access denied' });

    if (req.user.role === 'instructor') {
      const [[enroll]] = await pool.query(
        `SELECT ce.id FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE c.instructor_id = ? AND ce.student_id = ? AND ce.status = 'accepted'`,
        [req.user.id, session.user_id]
      );
      if (!enroll) return res.status(403).json({ error: 'Access denied' });
    }

    const [stepResults] = await pool.query(
      'SELECT * FROM sim_step_results WHERE sim_attempt_id = ? ORDER BY step_id',
      [simAttemptId]
    );
    const [errors] = await pool.query(
      'SELECT * FROM sim_error_log WHERE sim_attempt_id = ? ORDER BY client_timestamp',
      [simAttemptId]
    );
    const [[boneCounts]] = await pool.query(
      'SELECT * FROM sim_bone_counts WHERE sim_attempt_id = ?',
      [simAttemptId]
    );
    const [toolUsage] = await pool.query(
      'SELECT * FROM sim_tool_usage WHERE sim_attempt_id = ? ORDER BY step_id',
      [simAttemptId]
    );

    res.json({ session, step_results: stepResults, errors, bone_counts: boneCounts ?? null, tool_usage: toolUsage });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch session detail',
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
  }
});

// ── GET /api/sim/analytics/me ─────────────────────────────────────────────────
router.get('/analytics/me', authMiddleware, requireActiveAccount, async (req, res) => {
  const userId = req.user.id;
  try {
    const [[summary]] = await pool.query(
      `SELECT
         COUNT(*)                               AS attempts_count,
         MAX(score_percent)                     AS best_score,
         ROUND(AVG(score_percent))              AS avg_score,
         ROUND(SUM(passed) / COUNT(*) * 100)   AS pass_rate
       FROM sim_attempts WHERE user_id = ? AND completed = 1`,
      [userId]
    );

    const [stepAnalytics] = await pool.query(
      `SELECT
         ssr.step_id,
         MAX(ssr.step_key)                       AS step_key,
         ROUND(AVG(ssr.accuracy_factor), 3)      AS avg_accuracy,
         ROUND(AVG(ssr.time_spent_seconds))       AS avg_time_seconds,
         ROUND(AVG(ssr.error_count), 1)           AS avg_errors,
         MAX(sm.mastery_score)                    AS mastery_score
       FROM sim_step_results ssr
       JOIN sim_attempts sa ON ssr.sim_attempt_id = sa.id
       LEFT JOIN sim_mastery sm ON sm.user_id = sa.user_id AND sm.step_id = ssr.step_id
       WHERE sa.user_id = ? AND sa.completed = 1
       GROUP BY ssr.step_id
       ORDER BY ssr.step_id`,
      [userId]
    );

    const [errorBreakdown] = await pool.query(
      `SELECT sel.error_class, COUNT(*) AS count
       FROM sim_error_log sel
       JOIN sim_attempts sa ON sel.sim_attempt_id = sa.id
       WHERE sa.user_id = ? AND sa.completed = 1
       GROUP BY sel.error_class`,
      [userId]
    );

    const [[boneCompletion]] = await pool.query(
      `SELECT
         ROUND(AVG(dorsal  / 87 * 100)) AS dorsal_pct,
         ROUND(AVG(ventral / 48 * 100)) AS ventral_pct,
         ROUND(AVG(lateral / 42 * 100)) AS lateral_pct
       FROM sim_bone_counts sbc
       JOIN sim_attempts sa ON sbc.sim_attempt_id = sa.id
       WHERE sa.user_id = ? AND sa.completed = 1`,
      [userId]
    );

    const [recentSessions] = await pool.query(
      `SELECT id AS sim_attempt_id, attempt_number, score_percent, grade,
              passed, completed, duration_seconds, created_at
       FROM sim_attempts WHERE user_id = ? AND completed = 1
       ORDER BY created_at DESC LIMIT 5`,
      [userId]
    );

    res.json({ ...summary, step_analytics: stepAnalytics, error_breakdown: errorBreakdown, bone_completion_avg: boneCompletion, recent_sessions: recentSessions });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch analytics',
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
  }
});

// ── GET /api/sim/analytics/course/:courseId ───────────────────────────────────
router.get('/analytics/course/:courseId', authMiddleware, instructorOnly, analyticsLimiter, async (req, res) => {
  const courseId = parseInt(req.params.courseId);
  if (!Number.isInteger(courseId) || courseId < 1)
    return res.status(400).json({ error: 'Invalid course_id' });

  try {
    const [[course]] = await pool.query(
      'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
      [courseId, req.user.id]
    );
    if (!course) return res.status(403).json({ error: 'Course not found or access denied' });

    const since = req.query.since || null;
    const payload = await buildAnalyticsPayload({ type: 'course', id: courseId, since });
    res.json(payload);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch course analytics',
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
  }
});

// ── GET /api/sim/analytics/instructor ────────────────────────────────────────
router.get('/analytics/instructor', authMiddleware, instructorOnly, analyticsLimiter, async (req, res) => {
  try {
    const since = req.query.since || null;
    const payload = await buildAnalyticsPayload({ type: 'instructor', id: req.user.id, since });
    res.json(payload);
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch instructor analytics',
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
  }
});

// ── GET /api/sim/analytics/learning-curve ─────────────────────────────────────
// Returns per-student attempt sequences for individual learning curve charts.
router.get('/analytics/learning-curve', authMiddleware, instructorOnly, analyticsLimiter, async (req, res) => {
  const courseId = req.query.courseId ? parseInt(req.query.courseId) : null;
  if (courseId !== null && (!Number.isInteger(courseId) || courseId < 1))
    return res.status(400).json({ error: 'Invalid course_id' });

  try {
    if (courseId) {
      const [[course]] = await pool.query(
        'SELECT id FROM courses WHERE id = ? AND instructor_id = ?',
        [courseId, req.user.id]
      );
      if (!course) return res.status(403).json({ error: 'Course not found or access denied' });
    }

    const courseJoin  = '';
    const whereFilter = courseId
      ? 'sa.course_id = ?'
      : `sa.user_id IN (
           SELECT ce.student_id FROM course_enrollments ce
           JOIN courses c ON ce.course_id = c.id
           WHERE c.instructor_id = ? AND ce.status = 'accepted'
         )`;

    const since = req.query.since || null;
    const sinceClause = since ? 'AND sa.created_at >= ?' : '';
    const sinceParam  = since ? [since] : [];

    const [rows] = await pool.query(
      `SELECT sa.user_id, u.full_name, sa.attempt_number, sa.score_percent
       FROM sim_attempts sa
       JOIN users u ON sa.user_id = u.id
       ${courseJoin}
       WHERE ${whereFilter} AND sa.completed = 1 ${sinceClause}
       ORDER BY sa.user_id, sa.attempt_number
       LIMIT 2001`,
      [courseId ?? req.user.id, ...sinceParam]
    );

    // [Fix G] LIMIT 2001: detect truncation without an extra COUNT query.
    const hasMore = rows.length > 2000;
    if (hasMore) rows.length = 2000;

    // Group attempts by student
    const studentMap = {};
    for (const row of rows) {
      if (!studentMap[row.user_id]) {
        studentMap[row.user_id] = { user_id: row.user_id, full_name: row.full_name, attempts: [] };
      }
      studentMap[row.user_id].attempts.push({
        attempt_number: row.attempt_number,
        score: row.score_percent,
      });
    }

    res.json({ success: true, students: Object.values(studentMap), has_more: hasMore });
  } catch (err) {
    res.status(500).json({
      error: 'Failed to fetch learning curve data',
      ...(process.env.NODE_ENV !== 'production' && { details: err.message }),
    });
  }
});

module.exports = router;