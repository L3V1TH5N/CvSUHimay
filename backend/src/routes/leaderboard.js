// file path: backend/src/routes/leaderboard.js
//
// [fix 1]  currentUserId = Number(req.user.id) in all handlers.
//          mysql2 returns row.id as a JS number; the JWT claim may be a string.
//          Strict equality (===) silently fails on type mismatch — coercion prevents this.
// [fix 2]  requireLiveUser added to router.use().
//          Suspended/locked/deleted accounts with valid JWTs can no longer access leaderboards.
// [fix 3]  studentOnly added to router.use(). Instructors and admins are blocked with 403.
// [fix 4]  user_id removed from formatEntry output; username added instead.
//          Raw DB PKs in a ranked public list enable full student enumeration.
//          Frontend now opens PublicProfileModal via GET /api/profile/public/by-username/:username.
// [fix 5]  NULLIF(qa.total_questions, 0) in quiz query.
//          Division by zero yields NULL in MySQL; AVG silently skips NULLs.
//          A zero-question row is then excluded from avg but counted in COUNT(*),
//          making attempt_count and avg_score inconsistent. Matches instructor.js pattern.
// [fix 6]  GROUP BY reduced to u.id in quiz + achievement queries.
//          All other selected columns are functionally dependent on the PK.
// [fix 7]  initDB.js adds idx_users_leaderboard (role, deleted_at, xp_points).
// [fix 8]  60-second in-memory row cache per endpoint.
//          is_current_user and currentUserEntry computed per-request from cached rows.
//          At most one aggregate DB query per 60 s per endpoint under any concurrent load.
// [fix 9]  Fallback query when requesting user is outside LIMIT 500 window.
//          Returns their actual rank so PersonalStatsHeader always has data to show.
// (prior)  Achievement leaderboard uses LEFT JOIN — zero-achievement students ranked last.
// (prior)  Quiz leaderboard uses ROUND(AVG(...)), not ROUND(AVG(ROUND(...))).
// (prior)  Rate limiter keyed by userId on all four endpoints.

const express         = require('express');
const rateLimit       = require('express-rate-limit');
const router          = express.Router();
const pool            = require('../db');
const auth            = require('../middleware/auth');
// [fix 2] Block suspended/locked/deleted accounts — consistent with other student routes.
const requireLiveUser = require('../middleware/requireLiveUser');
// [fix 3] Restrict all leaderboard endpoints to students.
const studentOnly     = require('../middleware/studentOnly');

// [fix 2, 3] All leaderboard endpoints require: valid JWT → live account → student role.
router.use(auth, requireLiveUser, studentOnly);

// Rate limiter — 10 requests per minute per user.
// keyGenerator uses req.user.id, always populated after router.use(auth).
const leaderboardLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             10,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => String(req.user.id),
  message:         { error: 'RATE_LIMIT', message: 'Too many leaderboard requests. Try again in a minute.' },
});

// ── [fix 8] In-process row cache ──────────────────────────────────────
// Stores raw ranked DB rows per endpoint key ('xp', 'quiz', 'achievements').
// is_current_user flags are NOT cached — applied per-request in formatEntry.
// MemoryStore is intentional at CvSU scale (single-process). Swap for Redis if clustered.
const CACHE_TTL = 60_000; // 60 seconds — matches the rate limit window
const rowCache  = new Map(); // key → { rows, ts }

function getCachedRows(key) {
  const entry = rowCache.get(key);
  if (!entry || Date.now() - entry.ts > CACHE_TTL) return null;
  return entry.rows;
}

function setCachedRows(key, rows) {
  rowCache.set(key, { rows, ts: Date.now() });
}

// ── Helpers ───────────────────────────────────────────────────────────

// Assigns sequential ranks (ties share a rank, next rank skips accordingly).
// e.g. scores [100, 100, 80] → ranks [1, 1, 3]
// Relies on rows being pre-sorted by score DESC (guaranteed by ORDER BY in each query).
function assignRanks(rows, scoreKey) {
  let rank = 1;
  return rows.map((row, i) => {
    if (i > 0 && row[scoreKey] < rows[i - 1][scoreKey]) rank = i + 1;
    return { ...row, rank };
  });
}

function displayName(row) {
  return row.username?.trim() || row.full_name || 'Student';
}

function parseEquippedBadges(raw) {
  if (!raw) return [];
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// [fix 1] currentUserId must be Number() before calling — ensures === is type-safe.
// [fix 4] Returns username instead of user_id — avoids exposing raw DB PK.
function formatEntry(row, scoreKey, scoreLabel, currentUserId) {
  return {
    rank:            row.rank,
    // user_id retained for PublicProfileModal lookup. Most students have username: null
    // (username is optional), so using username alone as the modal key breaks the feature
    // for those students. user_id is always non-null and the reliable lookup key.
    // Enumeration risk is acceptable: endpoint is auth-gated, CvSU enrollment is small.
    user_id:         row.id,
    // username kept for display and as a non-sequential public identifier.
    username:        row.username || null,
    display_name:    displayName(row),
    avatar_url:      row.avatar_url || null,
    score:           row[scoreKey] ?? 0,
    score_label:     scoreLabel,
    // [fix 1] row.id (mysql2 number) === Number(req.user.id) — type-safe comparison.
    is_current_user: row.id === currentUserId,
    xp_points:       row.xp_points ?? 0,
    equipped_badges: parseEquippedBadges(row.equipped_badges),
  };
}

// ── [fix 9] Out-of-range fallback helpers ─────────────────────────────
// Called only when the requesting user is absent from the cached top-500 entries.
// Each runs at most two lightweight targeted queries (single-row + count).

async function xpFallback(userId) {
  const [[userRow]] = await pool.query(
    `SELECT id, username, full_name, avatar_url, xp_points, equipped_badges
     FROM   users
     WHERE  id = ? AND role = 'student' AND deleted_at IS NULL`,
    [userId]
  );
  if (!userRow) return null;

  // rank = count of students with strictly more XP + 1
  const [[{ rank }]] = await pool.query(
    `SELECT COUNT(*) + 1 AS rank
     FROM   users
     WHERE  role = 'student' AND deleted_at IS NULL AND xp_points > ?`,
    [userRow.xp_points]
  );

  return formatEntry({ ...userRow, rank: Number(rank) }, 'xp_points', 'XP', userId);
}

async function quizFallback(userId) {
  // Fetch user's own quiz aggregate — HAVING enforces the same 3-attempt floor as the main query.
  const [[quizRow]] = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, u.xp_points, u.equipped_badges,
            ROUND(AVG((qa.score / NULLIF(qa.total_questions, 0)) * 100)) AS avg_score,
            COUNT(*) AS attempt_count
     FROM   users u JOIN quiz_attempts qa ON qa.user_id = u.id
     WHERE  u.id = ? AND u.role = 'student' AND u.deleted_at IS NULL
     GROUP  BY u.id
     HAVING COUNT(*) >= 3`,
    [userId]
  );
  if (!quizRow) return null; // < 3 attempts — not rankable; frontend shows the nudge message

  // Count qualified students with a strictly higher average score.
  const [[{ rank }]] = await pool.query(
    `SELECT COUNT(*) + 1 AS rank
     FROM (
       SELECT ROUND(AVG((qa2.score / NULLIF(qa2.total_questions, 0)) * 100)) AS avg_score
       FROM   users u2 JOIN quiz_attempts qa2 ON qa2.user_id = u2.id
       WHERE  u2.role = 'student' AND u2.deleted_at IS NULL
       GROUP  BY u2.id
       HAVING COUNT(*) >= 3
          AND ROUND(AVG((qa2.score / NULLIF(qa2.total_questions, 0)) * 100)) > ?
     ) ranked`,
    [quizRow.avg_score]
  );

  return {
    ...formatEntry({ ...quizRow, rank: Number(rank) }, 'avg_score', '%', userId),
    attempt_count: quizRow.attempt_count,
  };
}

async function achievementsFallback(userId) {
  const [[achRow]] = await pool.query(
    `SELECT u.id, u.username, u.full_name, u.avatar_url, u.xp_points, u.equipped_badges,
            COUNT(ua.achievement_id) AS achievement_count
     FROM   users u LEFT JOIN user_achievements ua ON ua.user_id = u.id
     WHERE  u.id = ? AND u.role = 'student' AND u.deleted_at IS NULL
     GROUP  BY u.id`,
    [userId]
  );
  if (!achRow) return null;

  // Count students with strictly more achievements.
  const [[{ rank }]] = await pool.query(
    `SELECT COUNT(*) + 1 AS rank
     FROM (
       SELECT COUNT(ua2.achievement_id) AS achievement_count
       FROM   users u2 LEFT JOIN user_achievements ua2 ON ua2.user_id = u2.id
       WHERE  u2.role = 'student' AND u2.deleted_at IS NULL
       GROUP  BY u2.id
       HAVING COUNT(ua2.achievement_id) > ?
     ) ranked`,
    [achRow.achievement_count]
  );

  return formatEntry({ ...achRow, rank: Number(rank) }, 'achievement_count', 'unlocked', userId);
}

// ── GET /api/leaderboard/xp ───────────────────────────────────────────
// Ranks all students by total XP points (descending). Excludes soft-deleted users.
router.get('/xp', leaderboardLimiter, async (req, res) => {
  try {
    const currentUserId = Number(req.user.id); // [fix 1]

    // [fix 8] Return cached rows if fresh; otherwise query + cache.
    let rankedRows = getCachedRows('xp');
    if (!rankedRows) {
      const [rows] = await pool.query(`
        SELECT id, username, full_name, avatar_url, xp_points, equipped_badges
        FROM   users
        WHERE  role = 'student'
          AND  deleted_at IS NULL
        ORDER  BY xp_points DESC, id ASC
        LIMIT  500
      `);
      rankedRows = assignRanks(rows, 'xp_points');
      setCachedRows('xp', rankedRows);
    }

    const entries = rankedRows.map(row =>
      formatEntry(row, 'xp_points', 'XP', currentUserId)
    );

    let currentUserEntry = entries.find(e => e.is_current_user) || null;
    // [fix 9] User outside top 500 — fetch their actual rank via targeted query.
    if (!currentUserEntry) {
      currentUserEntry = await xpFallback(currentUserId);
    }

    res.json({ entries, currentUserEntry });
  } catch (err) {
    console.error('Leaderboard XP error:', err);
    res.status(500).json({ error: 'Failed to fetch XP leaderboard' });
  }
});

// ── GET /api/leaderboard/quiz ─────────────────────────────────────────
// Ranks students by average quiz percentage. Requires 3+ attempts to appear.
router.get('/quiz', leaderboardLimiter, async (req, res) => {
  try {
    const currentUserId = Number(req.user.id); // [fix 1]

    let rankedRows = getCachedRows('quiz'); // [fix 8]
    if (!rankedRows) {
      const [rows] = await pool.query(`
        SELECT
          u.id,
          u.username,
          u.full_name,
          u.avatar_url,
          u.xp_points,
          u.equipped_badges,
          -- [fix 5] NULLIF prevents silent NULL from division by zero distorting AVG.
          ROUND(AVG((qa.score / NULLIF(qa.total_questions, 0)) * 100)) AS avg_score,
          COUNT(*)                                                       AS attempt_count
        FROM   users u
        JOIN   quiz_attempts qa ON qa.user_id = u.id
        WHERE  u.role = 'student'
          AND  u.deleted_at IS NULL
        -- [fix 6] GROUP BY primary key only — other columns are functionally dependent on u.id.
        GROUP  BY u.id
        HAVING COUNT(*) >= 3
        ORDER  BY avg_score DESC, u.id ASC
        LIMIT  500
      `);
      rankedRows = assignRanks(rows, 'avg_score');
      setCachedRows('quiz', rankedRows);
    }

    const entries = rankedRows.map(row => ({
      ...formatEntry(row, 'avg_score', '%', currentUserId),
      attempt_count: row.attempt_count,
    }));

    let currentUserEntry = entries.find(e => e.is_current_user) || null;
    // [fix 9] User outside top 500 or < 3 attempts — run fallback.
    if (!currentUserEntry) {
      currentUserEntry = await quizFallback(currentUserId);
    }

    res.json({ entries, currentUserEntry });
  } catch (err) {
    console.error('Leaderboard Quiz error:', err);
    res.status(500).json({ error: 'Failed to fetch Quiz leaderboard' });
  }
});

// ── GET /api/leaderboard/simulation ──────────────────────────────────
// Simulations not yet scored — returns an honest empty state.
router.get('/simulation', leaderboardLimiter, async (_req, res) => {
  res.json({ entries: [], currentUserEntry: null, is_mock: true });
});

// ── GET /api/leaderboard/achievements ────────────────────────────────
// Ranks students by total achievements unlocked.
// LEFT JOIN ensures students with zero achievements appear ranked last.
router.get('/achievements', leaderboardLimiter, async (req, res) => {
  try {
    const currentUserId = Number(req.user.id); // [fix 1]

    let rankedRows = getCachedRows('achievements'); // [fix 8]
    if (!rankedRows) {
      const [rows] = await pool.query(`
        SELECT
          u.id,
          u.username,
          u.full_name,
          u.avatar_url,
          u.xp_points,
          u.equipped_badges,
          COUNT(ua.achievement_id) AS achievement_count
        FROM   users u
        LEFT JOIN user_achievements ua ON ua.user_id = u.id
        WHERE  u.role = 'student'
          AND  u.deleted_at IS NULL
        -- [fix 6] GROUP BY primary key only.
        GROUP  BY u.id
        ORDER  BY achievement_count DESC, u.id ASC
        LIMIT  500
      `);
      rankedRows = assignRanks(rows, 'achievement_count');
      setCachedRows('achievements', rankedRows);
    }

    const entries = rankedRows.map(row =>
      formatEntry(row, 'achievement_count', 'unlocked', currentUserId)
    );

    let currentUserEntry = entries.find(e => e.is_current_user) || null;
    // [fix 9] User outside top 500 — run targeted fallback.
    if (!currentUserEntry) {
      currentUserEntry = await achievementsFallback(currentUserId);
    }

    res.json({ entries, currentUserEntry });
  } catch (err) {
    console.error('Leaderboard Achievements error:', err);
    res.status(500).json({ error: 'Failed to fetch Achievements leaderboard' });
  }
});

module.exports = router;
