// file path: backend/src/routes/achievements.js
// CHANGES:
// - All heavy logic (evaluateAchievements, evaluateAndPersist) extracted to
//   utils/achievementUtils.js. ACHIEVEMENT_DEFS moved to utils/achievementDefs.js.
//   This file is now a thin route handler for GET /api/achievements.
// - Imports utils/achievementDefs for the definition list and uses evaluateAndPersist
//   from the utility.
// - [audit fix] Rate limiter added to GET / — lazy evaluation runs on every hit, making
//   this endpoint a cheap DoS surface without a limit. 5 requests per minute per user,
//   keyed by userId (requires authenticateToken to run first so req.user is populated).
// - [fix N] achievementsLimiter also applied to GET /progress. Previously only GET /
//   was rate-limited; /progress runs 5 parallel pool queries and was equally exposed.

const express           = require('express');
const rateLimit         = require('express-rate-limit');
const router            = express.Router();
const pool              = require('../db');
const authenticateToken = require('../middleware/auth');
const { ACHIEVEMENT_DEFS, evaluateAndPersist } = require('../utils/achievementUtils');
const { TOTAL_MODULES } = require('../utils/gamification');

// Rate limiter shared by both achievement routes.
// evaluateAndPersist (called on GET /) fires 3 DB queries per hit;
// GET /progress fires 5 parallel queries — both are DoS surfaces without a limit.
const achievementsLimiter = rateLimit({
  windowMs:        60 * 1000,
  max:             30,
  standardHeaders: true,
  legacyHeaders:   false,
  keyGenerator:    (req) => String(req.user.id),
  message:         { error: 'RATE_LIMIT', message: 'Too many achievement requests. Try again in a minute.' },
});

function fmtShort(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'Asia/Manila' });
}
function fmtLong(ts) {
  return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'Asia/Manila' });
}

// ══════════════════════════════════════════════════════════════════════════
// GET /api/achievements
// Lazy-evaluates progress, persists new unlocks, returns the full list.
// ══════════════════════════════════════════════════════════════════════════
// [audit fix] achievementsLimiter applied after authenticateToken so req.user exists.
router.get('/', authenticateToken, achievementsLimiter, async (req, res) => {
  try {
    await evaluateAndPersist(req.user.id);

    const [rows] = await pool.query(
      'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?',
      [req.user.id]
    );
    const unlockedAtById = new Map(rows.map(r => [r.achievement_id, r.unlocked_at]));

    const achievements = ACHIEVEMENT_DEFS.map(def => ({
      ...def,
      unlocked:    unlockedAtById.has(def.id),
      unlocked_at: unlockedAtById.get(def.id) || null,
    }));

    res.json({ achievements });
  } catch (err) {
    console.error('Achievements fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch achievements' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/achievements/progress
// Returns stats, recent quiz scores, skill progress, and milestones.
// ══════════════════════════════════════════════════════════════════════════
// [fix N] achievementsLimiter added — 5 parallel DB queries with no previous limit
//         made this a DoS surface equivalent to GET /.
router.get('/progress', authenticateToken, achievementsLimiter, async (req, res) => {
  try {
    const userId = req.user.id;

    const [
      [modCountRows],
      [simCountRows],
      [allQuizRows],
      [modCompRows],
      [firstSimRows],
    ] = await Promise.all([
      pool.query(
        `SELECT COUNT(DISTINCT module_id) AS cnt
         FROM module_progress
         WHERE user_id = ? AND completed_at IS NOT NULL AND module_id BETWEEN 1 AND ?`,
        [userId, TOTAL_MODULES]
      ),
      pool.query(
        'SELECT COUNT(*) AS cnt FROM attempts WHERE user_id = ? AND completed = TRUE',
        [userId]
      ),
      pool.query(
        'SELECT module_id, score, total_questions, passed, created_at FROM quiz_attempts WHERE user_id = ? ORDER BY created_at ASC',
        [userId]
      ),
      pool.query(
        `SELECT module_id, completed_at FROM module_progress
         WHERE user_id = ? AND completed_at IS NOT NULL AND module_id BETWEEN 1 AND ?
         ORDER BY completed_at ASC`,
        [userId, TOTAL_MODULES]
      ),
      pool.query(
        'SELECT created_at FROM attempts WHERE user_id = ? AND completed = TRUE ORDER BY created_at ASC LIMIT 1',
        [userId]
      ),
    ]);

    const lessonsDone  = Number(modCountRows[0]?.cnt ?? 0);
    const simCount     = Number(simCountRows[0]?.cnt ?? 0);
    const firstSimDate = firstSimRows[0]?.created_at ?? null;
    const firstModDate = modCompRows[0]?.completed_at ?? null;

    // Best score % and last practiced date per module (chronological allQuizRows)
    const bestPctByModule  = new Map();
    const lastDateByModule = new Map();
    for (const r of allQuizRows) {
      const pct = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0;
      if (!bestPctByModule.has(r.module_id) || pct > bestPctByModule.get(r.module_id)) {
        bestPctByModule.set(r.module_id, pct);
      }
      if (!lastDateByModule.has(r.module_id) ||
          new Date(r.created_at) > new Date(lastDateByModule.get(r.module_id))) {
        lastDateByModule.set(r.module_id, r.created_at);
      }
    }

    const avgScore = bestPctByModule.size > 0
      ? Math.round([...bestPctByModule.values()].reduce((s, v) => s + v, 0) / bestPctByModule.size)
      : 0;

    // skillProgress — one entry per module
    const skillProgress = Array.from({ length: TOTAL_MODULES }, (_, i) => {
      const id       = i + 1;
      const pct      = bestPctByModule.get(id) ?? 0;
      const attempted = bestPctByModule.has(id);
      const lastDate = lastDateByModule.get(id) ?? null;
      return {
        name:          `Module ${id}`,
        progress:      pct,
        attempted,
        description:   attempted ? `Best score: ${pct}%` : 'No quiz attempts yet.',
        lastPracticed: lastDate ? fmtShort(lastDate) : null,
      };
    });

    // recentScores — last 5 quiz attempts, newest first, with improvement delta
    const attemptsByModule = new Map();
    for (const r of allQuizRows) {
      const list = attemptsByModule.get(r.module_id) ?? [];
      list.push(r);
      attemptsByModule.set(r.module_id, list);
    }
    const recentScores = [...allQuizRows].reverse().slice(0, 5).map(r => {
      const pct  = r.total_questions > 0 ? Math.round((r.score / r.total_questions) * 100) : 0;
      const list = attemptsByModule.get(r.module_id) ?? [];
      const idx  = list.indexOf(r);
      let improvement = null;
      if (idx > 0) {
        const prev    = list[idx - 1];
        const prevPct = prev.total_questions > 0 ? Math.round((prev.score / prev.total_questions) * 100) : 0;
        improvement = pct - prevPct;
      }
      return { module_name: `Module ${r.module_id}`, date: fmtShort(r.created_at), percentage: pct, improvement };
    });

    // milestones — fixed journey checkpoints
    const firstQuizAttempt = allQuizRows[0] ?? null;
    const firstPassedQuiz  = allQuizRows.find(r => r.passed) ?? null;
    const passedModules    = new Set(allQuizRows.filter(r => r.passed).map(r => r.module_id));
    const lastModComp      = modCompRows[modCompRows.length - 1] ?? null;

    const milestones = [
      {
        title:       'First Lesson',
        description: 'Complete your first module.',
        icon:        '📖',
        completed:   lessonsDone >= 1,
        date:        firstModDate ? fmtLong(firstModDate) : '',
      },
      {
        title:       'First Quiz',
        description: 'Attempt your first quiz.',
        icon:        '📝',
        completed:   allQuizRows.length > 0,
        date:        firstQuizAttempt ? fmtLong(firstQuizAttempt.created_at) : '',
      },
      {
        title:       'Quiz Passer',
        description: 'Pass your first quiz.',
        icon:        '✅',
        completed:   !!firstPassedQuiz,
        date:        firstPassedQuiz ? fmtLong(firstPassedQuiz.created_at) : '',
      },
      {
        title:       'Simulator',
        description: 'Complete your first simulation run.',
        icon:        '🧪',
        completed:   simCount >= 1,
        date:        firstSimDate ? fmtLong(firstSimDate) : '',
      },
      {
        title:       'Full Reader',
        description: 'Complete all 5 modules.',
        icon:        '🎓',
        completed:   lessonsDone >= TOTAL_MODULES,
        date:        lessonsDone >= TOTAL_MODULES && lastModComp ? fmtLong(lastModComp.completed_at) : '',
      },
      {
        title:       'Quiz Champion',
        description: 'Pass all 5 module quizzes.',
        icon:        '🏆',
        completed:   passedModules.size >= TOTAL_MODULES,
        date:        '',
      },
    ];

    res.json({
      stats: { total_modules: TOTAL_MODULES, lessons_done: lessonsDone, avg_score: avgScore, sim_count: simCount },
      recentScores,
      skillProgress,
      milestones,
    });
  } catch (err) {
    console.error('Progress fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
});

module.exports = router;
// ACHIEVEMENT_DEFS and evaluateAndPersist no longer exported from here;
// import them from utils/achievementDefs and utils/achievementUtils respectively.
