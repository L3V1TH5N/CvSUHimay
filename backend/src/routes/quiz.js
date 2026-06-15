// file path: backend/src/routes/quiz.js
//
// All quiz-related API endpoints.
// The backend is source of truth for questions, scoring, XP, and achievements.
// Clients NEVER submit scores — they submit answers; the server computes everything.
//
// Changes:
//   [fix #1]  POST /check no longer returns correct answer — isCorrect only.
//   [fix #2]  isFirstPass check moved inside transaction with FOR UPDATE lock.
//   [fix #3]  courseId resolved server-side; removed from accepted client body.
//   [fix #5]  evaluateAndPersist wrapped in try/catch; notifications fire-and-forget.
//   [fix #6]  GET /progress gains module_id range filter.
//   [fix #7]  perQuestionTimeMs validated.
//   [fix #8]  timeSpent upper bound tightened to QUESTIONS_PER_QUIZ * SECONDS_PER_QUESTION + 60.
//   [fix #9]  POST /check rate-limited with quizLimiter.
//   [fix #10] Dual rate limiter replaced with single user-keyed quizLimiter.
//   [fix #11] Imports shared studentOnly middleware.
//   [fix #12] GET /all-attempts supports pagination via ?page and ?limit.
//   [fix #13] GET /questions fires-and-forgets a DELETE of expired quiz_sessions rows
//             to prevent unbounded table growth.
//   [fix #14] POST /check now returns `correct` (the server-shuffled correct letter)
//             so the frontend can highlight the correct tile after the user locks in.
//             Revealing the correct answer after the pick is locked is safe — it is
//             also exposed in the /submit review payload.
//   [fix #15] POST /submit deletes the quiz_sessions row inside the transaction after
//             the attempt is committed. Prevents resubmission on the same session.
//   [fix #16] Perfect-score instructor notifications use Promise.all instead of a
//             sequential await loop so N instructors do not chain N round-trips.
//   [fix #17] updateStreak removed from quiz submit. current_streak is now
//             simulation-only so it stays consistent with achievement streak IDs 16–19.
//   [fix #18] questionsLimiter added to GET /questions (5 fetches per 15 min per user).
//             Without a limiter this was the only quiz endpoint with no rate limit;
//             combined with the missing UNIQUE KEY it could grow quiz_sessions unboundedly.
//   [fix #19] All quiz_sessions SELECT queries use ORDER BY id DESC LIMIT 1 to resolve
//             the correct (most-recent) session row deterministically regardless of whether
//             the retroactive UNIQUE index migration has run yet.
//   [fix #20] POST /check now enforces a server-side one-shot answer lock via
//             answered_indices. Each questionIndex may only be checked once per session.
//             Prevents option-probing (cycling A→B→C→D on /check to learn the answer
//             before /submit locks it in).
//   [fix #21] questionsLimiter widened to per-module, per-user with 10 requests/15 min.
//             Previously it was global per user (5 req/15 min for all modules combined),
//             which trapped legitimate students after a few retakes.
//   [audit fix] Replaced inline level-up check with shared checkLevelUp helper.
//   [audit fix] Insert XP event into xp_events inside the transaction for audit trail.
//   [audit fix] Zero XP for any attempt after the first pass (prevents farming).
//   [audit fix] createNotification import changed from './notifications' (routes/notifications.js)
//               to '../utils/notifications' (the canonical source). Both files exported
//               createNotification but diverging implementations risk silent drift.
//   [audit fix] Removed fire-and-forget quiz_sessions cleanup from GET /questions hot path.
//               Concurrent question fetches caused multiple simultaneous DELETE queries on
//               the same index, creating unnecessary write contention. Cleanup moved to a
//               scheduled interval in server.js (every 5 minutes).
//
// Security fixes (audit round 2):
//   [fix A]   POST /check wraps the answered_indices read-check-update in a transaction
//             with FOR UPDATE on the session row. Previously, two concurrent /check
//             requests for the same questionIndex both passed answered.includes() before
//             either UPDATE fired, breaking the one-shot lock.
//   [fix B+C] CHECK_OPTIONS excludes null. A null pick previously allowed a free answer
//             peek: server returns correct:X regardless of picked value, so a student
//             could send picked=null to learn the answer without committing a real guess.
//             VALID_OPTIONS (with null for "skipped") is still used for /submit only.
//   [fix E]   GET /questions generates a random session_token, stores it, and returns
//             it to the client. POST /submit validates the token against the stored
//             session — prevents scoring against a session that was silently replaced
//             by a concurrent /questions call between the check and submit phases.
//             FRONTEND CONTRACT: the client MUST echo session_token (from GET /questions
//             response) in the POST /submit body. Submits against new sessions without
//             a matching token are rejected with SESSION_TOKEN_MISMATCH.
//   [fix F]   The transaction in POST /submit now locks the user row (SELECT FOR UPDATE)
//             as the FIRST step. This serializes concurrent first submissions: the second
//             transaction blocks on the user row lock until the first commits, then finds
//             the first's quiz_attempt row and correctly computes isFirstPass=false.
//             Previously, FOR UPDATE on quiz_attempts found no rows on the first attempt,
//             locking nothing — both concurrent transactions awarded first-pass XP.
//   [fix G]   Server-derived time (session.started_at → submit timestamp) is stored as
//             server_time_spent in quiz_attempts. The Savant achievement now gates on
//             this field instead of the client-submitted timeSpent, preventing a student
//             from sending timeSpent=0 to satisfy the 30-second threshold.
//             Client timeSpent is still stored as-is for analytics.

const express           = require('express');
const rateLimit         = require('express-rate-limit');
const crypto            = require('crypto'); // [fix E] session token generation
const router            = express.Router();
const pool              = require('../db');
const authenticateToken = require('../middleware/auth');
// [audit fix] Canonical createNotification source is utils/notifications.js.
const { createNotification }  = require('../utils/notifications');
const { evaluateAndPersist } = require('../utils/achievementUtils');
const {
  computeLevel, rankFor,
  TOTAL_MODULES, PASS_THRESHOLD, QUESTIONS_PER_QUIZ, SECONDS_PER_QUESTION,
  checkLevelUp,
} = require('../utils/gamification');
const {
  getQuestionsForModule,
  computeScore,
  computeMaxStreak,
  computeXpEarned,
} = require('../utils/quizBank');

// ── Rate limiters ────────────────────────────────────────────────────────────

const submitLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => String(req.user.id),
  message:         { error: 'RATE_LIMIT', message: 'Too many submissions. Try again in a few minutes.' },
});

const checkLimiter = rateLimit({
  windowMs:        10 * 60 * 1000,
  max:             60,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => String(req.user.id),
  message:         { error: 'RATE_LIMIT', message: 'Too many check requests. Try again in a few minutes.' },
});

const questionsLimiter = rateLimit({
  windowMs:        15 * 60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => `${req.user.id}:${req.params.moduleId}`,
  message:         { error: 'RATE_LIMIT', message: 'Too many question fetches for this module. Please wait a few minutes before retrying.' },
});

// ── Validation helpers ────────────────────────────────────────────────────────

// [fix B+C] Two distinct option sets:
//   VALID_OPTIONS  — used in /submit where null means "skipped" (legitimate).
//   CHECK_OPTIONS  — used in /check; null is excluded because the server echoes
//                   the correct answer on every pick, so a null pick would reveal
//                   the answer for free without the student committing a real guess.
const VALID_OPTIONS = new Set(['A', 'B', 'C', 'D', null]); // submit: null = skipped
const CHECK_OPTIONS = new Set(['A', 'B', 'C', 'D']);        // check: no null

const MAX_TIME_SPENT = QUESTIONS_PER_QUIZ * SECONDS_PER_QUESTION + 60;

function validateModuleId(raw) {
  const n = Number(raw);
  return Number.isInteger(n) && n >= 1 && n <= TOTAL_MODULES ? n : null;
}

function validateAnswers(answers) {
  if (!Array.isArray(answers)) return false;
  if (answers.length !== QUESTIONS_PER_QUIZ) return false;
  return answers.every(a => VALID_OPTIONS.has(a));
}

function validatePerQuestionTimeMs(arr) {
  if (arr === undefined || arr === null) return true;
  if (!Array.isArray(arr) || arr.length !== QUESTIONS_PER_QUIZ) return false;
  return arr.every(t => Number.isInteger(t) && t >= 0 && t <= SECONDS_PER_QUESTION * 1000);
}

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/quiz/modules/:moduleId/questions
// ══════════════════════════════════════════════════════════════════════════════
// [audit fix] Removed fire-and-forget quiz_sessions cleanup from this handler.
// It has been moved to a setInterval in server.js to avoid write lock contention
// on the expires_at index when many users fetch questions simultaneously.
router.get('/modules/:moduleId/questions', authenticateToken, questionsLimiter, async (req, res) => {
  const moduleId = validateModuleId(req.params.moduleId);
  if (!moduleId) return res.status(400).json({ error: 'INVALID_MODULE_ID' });

  try {
    const { questions, questionIds } = getQuestionsForModule(moduleId, { includeAnswers: true });
    const expiresAt = new Date(Date.now() + QUESTIONS_PER_QUIZ * SECONDS_PER_QUESTION * 1000 + 60_000);

    // [fix E] Generate a fresh random token for this session.
    // Stored alongside the shuffled data; echoed back to the client.
    // When the client submits, it must include this token. If /questions is
    // called again (resetting shuffled_data), the token rotates — any in-flight
    // submit with the old token is rejected with SESSION_TOKEN_MISMATCH.
    const sessionToken = crypto.randomBytes(16).toString('hex'); // 32-char hex

    await pool.query(
      `INSERT INTO quiz_sessions (user_id, module_id, question_ids, shuffled_data, session_token, expires_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         question_ids     = VALUES(question_ids),
         shuffled_data    = VALUES(shuffled_data),
         session_token    = VALUES(session_token),
         answered_indices = '[]',
         started_at       = NOW(),
         expires_at       = VALUES(expires_at)`,
      [
        req.user.id,
        moduleId,
        JSON.stringify(questionIds),
        JSON.stringify(questions),
        sessionToken,
        expiresAt,
      ]
    );

    const clientQuestions = questions.map(({ correct_answer, explanation, _optionMap, ...rest }) => rest);
    // [fix E] Return session_token so the client can include it in POST /submit.
    res.json({ questions: clientQuestions, session_token: sessionToken });
  } catch (err) {
    console.error('quiz questions error', { route: 'GET /questions', userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'QUIZ_QUESTIONS_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/quiz/modules/:moduleId/check
// ══════════════════════════════════════════════════════════════════════════════
router.post('/modules/:moduleId/check', authenticateToken, checkLimiter, async (req, res) => {
  const moduleId = validateModuleId(req.params.moduleId);
  if (!moduleId) return res.status(400).json({ error: 'INVALID_MODULE_ID' });

  const { questionIndex, picked } = req.body;
  if (!Number.isInteger(questionIndex) || questionIndex < 0 || questionIndex >= QUESTIONS_PER_QUIZ) {
    return res.status(400).json({ error: 'INVALID_QUESTION_INDEX' });
  }
  // [fix B+C] CHECK_OPTIONS rejects null. null would let a student call /check with
  // picked=null to receive correct:X without committing a real guess, then submit
  // that correct answer — effectively probing without penalty.
  if (!CHECK_OPTIONS.has(picked)) {
    return res.status(400).json({ error: 'INVALID_OPTION' });
  }

  // [fix A] The answered_indices read-check-update must be atomic. Without a
  // transaction + FOR UPDATE, two concurrent /check calls for the same questionIndex
  // both pass the answered.includes() check before either UPDATE fires, so both
  // receive the correct answer — the one-shot lock is bypassed.
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    const [[session]] = await conn.query(
      `SELECT id, shuffled_data, answered_indices, expires_at
       FROM quiz_sessions
       WHERE user_id = ? AND module_id = ?
       ORDER BY id DESC LIMIT 1
       FOR UPDATE`,
      [req.user.id, moduleId]
    );

    if (!session || new Date(session.expires_at) < new Date()) {
      await conn.rollback();
      return res.status(400).json({ error: 'SESSION_EXPIRED' });
    }

    const answered = Array.isArray(session.answered_indices)
      ? session.answered_indices
      : (session.answered_indices ? JSON.parse(session.answered_indices) : []);

    if (answered.includes(questionIndex)) {
      await conn.rollback();
      return res.status(409).json({ error: 'ALREADY_ANSWERED' });
    }

    // Parse the result BEFORE committing so an invalid index can still roll back
    // the answered_indices update (avoids marking an unanswerable question as answered).
    const shuffled = JSON.parse(session.shuffled_data);
    const q = shuffled[questionIndex];
    if (!q) {
      await conn.rollback();
      return res.status(400).json({ error: 'INVALID_QUESTION_INDEX' });
    }

    const newAnswered = [...answered, questionIndex];
    await conn.query(
      `UPDATE quiz_sessions SET answered_indices = ? WHERE id = ?`,
      [JSON.stringify(newAnswered), session.id]
    );

    await conn.commit();

    return res.json({
      questionIndex,
      isCorrect: picked === q.correct_answer,
      correct:   q.correct_answer,
    });
  } catch (err) {
    await conn.rollback();
    console.error('quiz check error', { route: 'POST /check', userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'QUIZ_CHECK_FAILED' });
  } finally {
    conn.release();
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// POST /api/quiz/modules/:moduleId/submit
// ══════════════════════════════════════════════════════════════════════════════
router.post('/modules/:moduleId/submit', authenticateToken, submitLimiter, async (req, res) => {
  const moduleId = validateModuleId(req.params.moduleId);
  if (!moduleId) return res.status(400).json({ error: 'INVALID_MODULE_ID' });

  // [fix E] session_token must be echoed back from the GET /questions response.
  const { answers, timeSpent, perQuestionTimeMs, session_token } = req.body;

  if (!validateAnswers(answers)) {
    return res.status(400).json({
      error:   'QUIZ_VALIDATION',
      message: `answers must be an array of exactly ${QUESTIONS_PER_QUIZ} elements, each 'A'|'B'|'C'|'D'|null`,
    });
  }

  if (typeof timeSpent !== 'number' || timeSpent < 0 || timeSpent > MAX_TIME_SPENT) {
    return res.status(400).json({
      error:   'QUIZ_VALIDATION',
      message: `timeSpent must be 0–${MAX_TIME_SPENT} seconds`,
    });
  }

  if (!validatePerQuestionTimeMs(perQuestionTimeMs)) {
    return res.status(400).json({
      error:   'QUIZ_VALIDATION',
      message: `perQuestionTimeMs must be an array of ${QUESTIONS_PER_QUIZ} integers, each 0–${SECONDS_PER_QUESTION * 1000}`,
    });
  }

  const userId = req.user.id;

  try {
    // ── 1. Load shuffled session ──────────────────────────────────────────────
    // [fix E] Also select started_at (for server-side timing) and session_token.
    const [[session]] = await pool.query(
      `SELECT question_ids, shuffled_data, expires_at, started_at, session_token
       FROM quiz_sessions
       WHERE user_id = ? AND module_id = ?
       ORDER BY id DESC LIMIT 1`,
      [userId, moduleId]
    );
    if (!session || new Date(session.expires_at) < new Date()) {
      return res.status(400).json({ error: 'SESSION_EXPIRED', message: 'Quiz session expired. Reload the quiz.' });
    }

    // [fix E] Validate the session token when the session has one.
    // Sessions created before this fix was deployed have session_token = NULL;
    // those are accepted without validation so in-flight sessions are not broken
    // at deployment time. Once all active sessions have rotated (within one session
    // TTL after deployment), every live session will have a token and this always runs.
    if (session.session_token !== null && session_token !== session.session_token) {
      return res.status(400).json({
        error:   'SESSION_TOKEN_MISMATCH',
        message: 'Quiz session token mismatch. Reload the quiz.',
      });
    }

    const questionIds       = JSON.parse(session.question_ids);
    const shuffledQuestions = JSON.parse(session.shuffled_data);

    // [fix G] Compute server-derived time from session.started_at before the session
    // is deleted inside the transaction. Client-submitted timeSpent is kept for
    // analytics only — server_time_spent is the authoritative field used by the
    // Savant achievement gate so a student cannot farm it with timeSpent=0.
    const serverTimeSpent = Math.min(
      Math.max(0, Math.round((Date.now() - new Date(session.started_at).getTime()) / 1000)),
      MAX_TIME_SPENT
    );

    // ── 2. Compute score server-side ─────────────────────────────────────────
    const { score, perQuestion } = computeScore(moduleId, answers, questionIds, shuffledQuestions);
    const totalQuestions  = QUESTIONS_PER_QUIZ;
    const passed          = score >= totalQuestions * PASS_THRESHOLD;
    const isPerfect       = score === totalQuestions;
    const maxStreak       = computeMaxStreak(perQuestion);
    const completedInTime = timeSpent <= totalQuestions * SECONDS_PER_QUESTION;
    const percentage      = Math.round((score / totalQuestions) * 100);

    // ── 3. All DB writes inside a transaction ─────────────────────────────────
    const conn = await pool.getConnection();
    let attemptId, newXp, isFirstPass, xpEarned, resolvedCourseId, oldXp;
    try {
      await conn.beginTransaction();

      // [fix F] Lock the user row FIRST as the serialization point.
      // Two concurrent first-attempt submits race here: one blocks until the
      // other commits. When it unblocks, the committed quiz_attempt row is
      // visible — the isFirstPass SELECT below correctly sees priorPass and
      // returns false, preventing a double first-pass XP award.
      // This SELECT also captures oldXp, replacing the duplicate SELECT that
      // previously appeared lower in the transaction.
      const [[{ xp_points: oldXpVal }]] = await conn.query(
        'SELECT xp_points FROM users WHERE id = ? FOR UPDATE',
        [userId]
      );
      oldXp = oldXpVal;

      // Resolve courseId from student's most recent accepted enrollment.
      const [[enrollment]] = await conn.query(
        `SELECT course_id FROM course_enrollments
         WHERE student_id = ? AND status = 'accepted'
         ORDER BY enrolled_at DESC LIMIT 1`,
        [userId]
      );
      resolvedCourseId = enrollment?.course_id ?? null;

      // isFirstPass check — no FOR UPDATE needed: user row lock above serializes
      // concurrent submits for the same user, so this SELECT sees a stable view.
      const [[priorPass]] = await conn.query(
        `SELECT 1 FROM quiz_attempts
         WHERE user_id = ? AND module_id = ? AND passed = TRUE
         LIMIT 1`,
        [userId, moduleId]
      );
      isFirstPass = passed && !priorPass;

      // Retakes after first pass earn halved XP (isFirstPass=false → 0.5× multiplier).
      // Full zero-cap removed — students should still earn XP for correct answers on retakes.
      xpEarned = computeXpEarned({ score, passed, isPerfect, isFirstPass });

      // Insert attempt row — includes server_time_spent for authoritative timing.
      const [ins] = await conn.query(
        `INSERT INTO quiz_attempts
           (user_id, module_id, course_id, score, total_questions, passed,
            time_spent, server_time_spent, max_streak, completed_in_time, xp_earned, is_first_pass)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          userId, moduleId, resolvedCourseId, score, totalQuestions, passed ? 1 : 0,
          timeSpent, serverTimeSpent, maxStreak, completedInTime ? 1 : 0, xpEarned, isFirstPass ? 1 : 0,
        ]
      );
      attemptId = ins.insertId;

      // Insert per-question answer log
      const answerRows = perQuestion.map((q, i) => [
        attemptId, i, q.questionId,
        q.pickedOption, q.correctOption,
        q.isCorrect ? 1 : 0,
        perQuestionTimeMs?.[i] ?? 0,
      ]);
      await conn.query(
        `INSERT INTO quiz_attempt_answers
           (attempt_id, question_index, question_id, picked_option, correct_option, is_correct, time_spent_ms)
         VALUES ?`,
        [answerRows]
      );

      // [fix F] User row is already locked; update XP directly without a re-SELECT.
      await conn.query('UPDATE users SET xp_points = xp_points + ? WHERE id = ?', [xpEarned, userId]);
      newXp = oldXp + xpEarned;

      // [audit fix] Insert XP event into xp_events only when XP > 0
      if (xpEarned > 0) {
        await conn.query(
          'INSERT INTO xp_events (user_id, amount, source, reference_id) VALUES (?, ?, ?, ?)',
          [userId, xpEarned, 'quiz', attemptId]
        );
      }

      await conn.query(
        'DELETE FROM quiz_sessions WHERE user_id = ? AND module_id = ?',
        [userId, moduleId]
      );

      await conn.commit();
    } catch (txErr) {
      await conn.rollback();
      throw txErr;
    } finally {
      conn.release();
    }

    // ── 4. Achievement evaluation ─────────────────────────────────────────────
    let newlyUnlocked = [];
    try {
      newlyUnlocked = await evaluateAndPersist(userId);
    } catch (achErr) {
      console.error('achievement eval error', { userId, err: achErr?.message });
    }

    // ── 5. Level-up notification using shared helper ─────────────────────────
    try {
      await checkLevelUp(userId, oldXp, newXp);
    } catch (lvlErr) {
      console.error('level-up notification error', { userId, err: lvlErr?.message });
    }

    // ── 6. Perfect-score instructor notifications ─────────────────────────────
    if (isPerfect) {
      ;(async () => {
        try {
          const [[userRow]] = await pool.query('SELECT full_name FROM users WHERE id = ?', [userId]);
          const studentName = userRow?.full_name || 'A student';
          const [instructors] = await pool.query(
            `SELECT DISTINCT c.instructor_id
             FROM courses c
             JOIN course_enrollments ce ON ce.course_id = c.id
             WHERE ce.student_id = ? AND ce.status = 'accepted'`,
            [userId]
          );
          await Promise.all(
            instructors.map(({ instructor_id }) =>
              createNotification({
                userId:  instructor_id,
                type:    'student_progress',
                title:   'Perfect Quiz Score',
                message: `${studentName} scored ${totalQuestions}/${totalQuestions} on Module ${moduleId}.`,
                link:    '/instructor/dashboard',
              })
            )
          );
        } catch (err) {
          console.error('perfect score notification error', { userId, err: err?.message });
        }
      })();
    }

    // ── 7. Respond ────────────────────────────────────────────────────────────
    res.json({
      success:      true,
      attemptId,
      score,
      totalQuestions,
      percentage,
      passed,
      isPerfect,
      maxStreak,
      completedInTime,
      xpEarned,
      newXpTotal:   newXp,
      newlyUnlocked,
      review: perQuestion.map((q, i) => ({
        index:       i,
        questionId:  q.questionId,
        question:    q.question,
        optionA:     q.optionA,
        optionB:     q.optionB,
        optionC:     q.optionC,
        optionD:     q.optionD,
        picked:      q.pickedOption,
        correct:     q.correctOption,
        isCorrect:   q.isCorrect,
        explanation: q.explanation,
      })),
    });
  } catch (err) {
    console.error('quiz submit error', { route: 'POST /submit', userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'QUIZ_SUBMIT_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/quiz/progress
// ══════════════════════════════════════════════════════════════════════════════
router.get('/progress', authenticateToken, async (req, res) => {
  try {
    const [progress] = await pool.query(
      `SELECT
         module_id,
         MAX(score)                                          AS best_score,
         ROUND(AVG(ROUND((score / total_questions) * 100))) AS avg_percentage,
         COUNT(*)                                            AS attempt_count,
         MAX(created_at)                                     AS last_attempt
       FROM quiz_attempts
       WHERE user_id = ?
         AND module_id BETWEEN 1 AND ?
       GROUP BY module_id
       ORDER BY module_id ASC`,
      [req.user.id, TOTAL_MODULES]
    );
    res.json(progress);
  } catch (err) {
    console.error('quiz progress error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'QUIZ_PROGRESS_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/quiz/modules/:id/attempts
// ══════════════════════════════════════════════════════════════════════════════
router.get('/modules/:id/attempts', authenticateToken, async (req, res) => {
  const moduleId = validateModuleId(req.params.id);
  if (!moduleId) return res.status(400).json({ error: 'INVALID_MODULE_ID' });

  try {
    const [attempts] = await pool.query(
      `SELECT
         id, score, total_questions, passed, time_spent, max_streak,
         completed_in_time, xp_earned, is_first_pass, created_at,
         ROUND((score / total_questions) * 100) AS percentage
       FROM quiz_attempts
       WHERE user_id = ? AND module_id = ?
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.user.id, moduleId]
    );
    res.json({ success: true, attempts });
  } catch (err) {
    console.error('quiz attempts error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'QUIZ_ATTEMPTS_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/quiz/attempts/:id
// ══════════════════════════════════════════════════════════════════════════════
router.get('/attempts/:id', authenticateToken, async (req, res) => {
  const attemptId = Number(req.params.id);
  if (!Number.isInteger(attemptId) || attemptId < 1) {
    return res.status(400).json({ error: 'INVALID_ATTEMPT_ID' });
  }

  try {
    const [[attempt]] = await pool.query(
      `SELECT qa.id, qa.user_id, qa.module_id, qa.course_id,
              qa.score, qa.total_questions, qa.passed, qa.time_spent,
              qa.max_streak, qa.completed_in_time, qa.xp_earned, qa.created_at
       FROM quiz_attempts qa WHERE qa.id = ?`,
      [attemptId]
    );
    if (!attempt) return res.status(404).json({ error: 'ATTEMPT_NOT_FOUND' });

    const isOwner      = attempt.user_id === req.user.id;
    const isAdmin      = req.user.role === 'admin';
    let   isInstructor = false;

    if (!isOwner && !isAdmin && req.user.role === 'instructor' && attempt.course_id) {
      const [[course]] = await pool.query(
        'SELECT instructor_id FROM courses WHERE id = ?', [attempt.course_id]
      );
      isInstructor = course?.instructor_id === req.user.id;
    }

    if (!isOwner && !isAdmin && !isInstructor) {
      return res.status(403).json({ error: 'FORBIDDEN' });
    }

    const [answers] = await pool.query(
      `SELECT question_index, question_id, picked_option, correct_option, is_correct, time_spent_ms
       FROM quiz_attempt_answers WHERE attempt_id = ? ORDER BY question_index ASC`,
      [attemptId]
    );

    res.json({ success: true, attempt, answers });
  } catch (err) {
    console.error('quiz attempt detail error', { err: err.message });
    res.status(500).json({ error: 'QUIZ_ATTEMPT_DETAIL_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
// GET /api/quiz/all-attempts  (admin or instructor only)
// ══════════════════════════════════════════════════════════════════════════════
router.get('/all-attempts', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin' && req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'FORBIDDEN' });
  }

  const page   = Math.max(1, parseInt(req.query.page,  10) || 1);
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit, 10) || 20));
  const offset = (page - 1) * limit;

  try {
    let query, countQuery, params, countParams;

    if (req.user.role === 'admin') {
      countQuery  = `SELECT COUNT(*) AS total FROM quiz_attempts`;
      countParams = [];
      query = `
        SELECT qa.id, qa.module_id, qa.score, qa.total_questions, qa.passed,
               qa.time_spent, qa.xp_earned, qa.created_at,
               ROUND((qa.score / qa.total_questions) * 100) AS percentage,
               u.full_name, u.email,
               c.name AS course_name
        FROM quiz_attempts qa
        JOIN users u ON u.id = qa.user_id
        LEFT JOIN courses c ON c.id = qa.course_id
        ORDER BY qa.created_at DESC
        LIMIT ? OFFSET ?`;
      params = [limit, offset];
    } else {
      countQuery = `
        SELECT COUNT(*) AS total
        FROM quiz_attempts qa
        JOIN courses c ON c.id = qa.course_id
        WHERE c.instructor_id = ?`;
      countParams = [req.user.id];
      query = `
        SELECT qa.id, qa.module_id, qa.score, qa.total_questions, qa.passed,
               qa.time_spent, qa.xp_earned, qa.created_at,
               ROUND((qa.score / qa.total_questions) * 100) AS percentage,
               u.full_name, u.email,
               c.name AS course_name
        FROM quiz_attempts qa
        JOIN users u ON u.id = qa.user_id
        JOIN courses c ON c.id = qa.course_id
        WHERE c.instructor_id = ?
        ORDER BY qa.created_at DESC
        LIMIT ? OFFSET ?`;
      params = [req.user.id, limit, offset];
    }

    const [[{ total }]] = await pool.query(countQuery, countParams);
    const [attempts]    = await pool.query(query, params);

    res.json({
      success:    true,
      attempts,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error('quiz all-attempts error', { err: err.message });
    res.status(500).json({ error: 'QUIZ_ALL_ATTEMPTS_FAILED' });
  }
});

module.exports = router;
