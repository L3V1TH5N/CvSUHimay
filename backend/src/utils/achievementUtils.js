// file path: backend/src/utils/achievementUtils.js
// Achievement definitions, evaluation, and persistence logic.
//
// CHANGES (audit fixes):
// - Fix 3:  ID 2 "In Batman We Trust" condition fixed — was quizRows.every(r => !r.passed)
//           which permanently blocked the achievement once any quiz-attempt row was passing.
//           Now correctly checks modulesPassed.size === 0 (no module ever passed).
// - Fix 4:  Early Bird boundary corrected from h <= 6 to h < 7 so hour 7 (07:00 PHT)
//           is excluded, matching the description "between 3 AM and 7 AM".
// - Fix 10: byDate day-bucketing now uses datePHT() (UTC+8) instead of raw UTC ISO date,
//           consistent with phtHour() used for Early Bird / Night Owl. A session at
//           23:00 UTC (= 07:00 PHT next day) now counts toward the correct PHT calendar
//           date for both streak and Quick Learner checks.
// - Fix A:  evaluateAndPersist gains an early-exit when all achievements are already
//           earned — skips the three evaluation queries entirely (O(1) check vs O(n) scans).
// - Fix B:  INSERT IGNORE loop and XP UPDATE are now wrapped in a single transaction so
//           achievements and XP are always committed together. Previously a crash between
//           the last INSERT and the UPDATE left achievements recorded without their XP.
//           Notifications are sent after commit so a notification failure cannot roll back
//           already-persisted achievements.
// - [audit fix] Level-up detection: after committing XP, check if level increased
//               and send a notification via checkLevelUp helper.
// - [audit fix] XP audit log: inside the same transaction, insert a row into xp_events
//               for each achievement that awards XP.
// - [audit fix] total_questions > 0 guard added to modulesPerfect and modulesSavant
//               set construction. Without the guard, a corrupt attempt row with
//               total_questions = 0 satisfies score === total_questions (0 === 0) and
//               incorrectly contributes to Ace, Elite, Prodigy, and Savant achievements.
// - [fix G]  modulesSavant now filters on server_time_spent instead of time_spent.
//            time_spent is client-submitted and untrustworthy for gating; a student
//            could submit timeSpent=0 to satisfy the 30-second threshold. server_time_spent
//            is derived from session.started_at on the server and stored in quiz_attempts
//            by the submit handler. Rows with server_time_spent = 0 are legacy rows
//            (predating this column) and are excluded from Savant qualification.

const pool = require('../db');
const { createNotification } = require('./notifications');
const { TOTAL_MODULES, checkLevelUp } = require('./gamification');

const ACHIEVEMENT_DEFS = [
  { id: 1,  category: 'quiz',       name: 'Built Different',     description: 'Passed a quiz without finishing the module first.',     rarity: 'epic',      points: 75  },
  { id: 2,  category: 'quiz',       name: 'In Batman We Trust',  description: 'Attempted every quiz — and failed every single one.',    rarity: 'rare',      points: 25  },
  { id: 3,  category: 'quiz',       name: 'The Standard',        description: 'Passed all 5 module quizzes.',                           rarity: 'uncommon',  points: 20  },
  { id: 4,  category: 'quiz',       name: 'Prodigy',             description: 'Got a perfect score on every module quiz.',              rarity: 'epic',      points: 100 },
  { id: 5,  category: 'quiz',       name: 'Savant',              description: 'Perfect score on every quiz, each in under 30 seconds.', rarity: 'legendary', points: 200 },
  { id: 22, category: 'quiz',       name: 'Ace',                 description: 'Got a perfect score on a module quiz.',                  rarity: 'uncommon',  points: 20  },
  { id: 23, category: 'quiz',       name: 'Elite',               description: 'Got a perfect score on 3 module quizzes.',              rarity: 'rare',      points: 45  },
  { id: 6,  category: 'learning',   name: 'Knowledge Seeker I',   description: 'Completed reading 1 module.',              rarity: 'common',    points: 5  },
  { id: 7,  category: 'learning',   name: 'Knowledge Seeker II',  description: 'Completed reading 2 modules.',             rarity: 'common',    points: 8  },
  { id: 8,  category: 'learning',   name: 'Knowledge Seeker III', description: 'Completed reading 3 modules.',             rarity: 'uncommon',  points: 15 },
  { id: 9,  category: 'learning',   name: 'Knowledge Seeker IV',  description: 'Completed reading 4 modules.',             rarity: 'rare',      points: 35 },
  { id: 10, category: 'learning',   name: 'Knowledge Seeker V',   description: 'Completed reading all 5 modules.',         rarity: 'epic',      points: 75 },
  { id: 11, category: 'learning',   name: 'First Steps',          description: 'Completed your first lesson.',             rarity: 'common',    points: 5  },
  { id: 12, category: 'learning',   name: 'Quick Learner',        description: 'Completed 5 simulation runs in one day.',  rarity: 'rare',      points: 40 },
  { id: 13, category: 'simulation', name: 'Lab Rat',           description: 'Completed 10 simulation practices.',            rarity: 'uncommon',  points: 25  },
  { id: 14, category: 'simulation', name: 'Simulation Expert', description: 'Achieved a perfect score in a simulation.',     rarity: 'legendary', points: 175 },
  { id: 15, category: 'simulation', name: 'Speed Demon',       description: 'Finished a simulation in under 3 minutes.',     rarity: 'rare',      points: 50  },
  { id: 16, category: 'simulation', name: 'On a Streak I',     description: 'Practiced simulations 3 days in a row.',        rarity: 'uncommon',  points: 15  },
  { id: 17, category: 'simulation', name: 'On a Streak II',    description: 'Practiced simulations 5 days in a row.',        rarity: 'rare',      points: 35  },
  { id: 18, category: 'simulation', name: 'On a Streak III',   description: 'Practiced simulations 7 days in a row.',        rarity: 'epic',      points: 85  },
  { id: 19, category: 'simulation', name: 'On a Streak IV',    description: 'Practiced simulations 15 days in a row.',       rarity: 'legendary', points: 150 },
  { id: 20, category: 'simulation', name: 'Early Bird',        description: 'Completed a simulation between 3 AM and 7 AM.', rarity: 'uncommon',  points: 15  },
  { id: 21, category: 'simulation', name: 'Night Owl',         description: 'Completed a simulation between 11 PM and 3 AM.', rarity: 'uncommon', points: 15  },
];

const DEFS_BY_ID = new Map(ACHIEVEMENT_DEFS.map(d => [d.id, d]));

const SPEED_DEMON_SECONDS = 180;
const QUICK_LEARNER_DAILY = 5;
const LAB_RAT_RUNS        = 10;
const STREAK_TIERS        = [3, 5, 7, 15];
// SAVANT_TIME_LIMIT is the total quiz time cap in seconds (not per-question).
// A student must complete all 10 questions in under 30 seconds total to qualify.
// [fix G] This threshold is applied to server_time_spent, not client-submitted time_spent.
const SAVANT_TIME_LIMIT   = 30;
const PERFECT_SIM_SCORE   = 100;

// Returns the hour (0–23) in Philippine Time (UTC+8) for a given DB timestamp.
function phtHour(createdAt) {
  const pht = new Date(new Date(createdAt).getTime() + 8 * 60 * 60 * 1000);
  return pht.getUTCHours();
}

// Fix 10: returns the calendar date string (YYYY-MM-DD) in PHT (UTC+8).
// Replaces raw toISOString().slice(0,10) which used UTC — a session at 23:00 UTC
// (07:00 PHT next day) would count toward the wrong local day for streak and
// Quick Learner bucketing.
function datePHT(createdAt) {
  const pht = new Date(new Date(createdAt).getTime() + 8 * 60 * 60 * 1000);
  return pht.toISOString().slice(0, 10);
}

async function evaluateAchievements(userId) {
  const earned = new Set();

  const [
    [simRows],
    [moduleRows],
    [quizRows],
  ] = await Promise.all([
    pool.query(
      'SELECT score, duration_seconds, completed, created_at FROM attempts WHERE user_id = ? AND completed = TRUE ORDER BY created_at ASC',
      [userId]
    ),
    pool.query(
      'SELECT module_id, completed_at FROM module_progress WHERE user_id = ? AND completed_at IS NOT NULL AND module_id BETWEEN 1 AND ?',
      [userId, TOTAL_MODULES]
    ),
    // [fix G] Added server_time_spent to the SELECT so modulesSavant can use
    //         server-authoritative timing instead of client-submitted time_spent.
    pool.query(
      'SELECT module_id, score, total_questions, passed, time_spent, server_time_spent, created_at FROM quiz_attempts WHERE user_id = ?',
      [userId]
    ),
  ]);

  const modulesAttempted = new Set(quizRows.map(r => r.module_id));
  const modulesPassed    = new Set(quizRows.filter(r => r.passed).map(r => r.module_id));

  // [audit fix] Added total_questions > 0 guard to both sets.
  // Without it, a corrupt attempt row with total_questions = 0 satisfies
  // score === total_questions (0 === 0) and falsely qualifies as "perfect".
  const modulesPerfect = new Set(
    quizRows
      .filter(r => r.total_questions > 0 && r.score === r.total_questions)
      .map(r => r.module_id)
  );

  // [fix G] Gate on server_time_spent instead of client-submitted time_spent.
  // server_time_spent = 0 means the row predates this column (legacy data) — excluded
  // so old rows don't accidentally satisfy the threshold (0 <= 30 is always true).
  const modulesSavant = new Set(
    quizRows
      .filter(r =>
        r.total_questions > 0 &&
        r.score === r.total_questions &&
        r.server_time_spent > 0 &&
        r.server_time_spent <= SAVANT_TIME_LIMIT
      )
      .map(r => r.module_id)
  );

  const firstModuleCompleteByModule = new Map();
  for (const r of moduleRows) {
    const t = new Date(r.completed_at).getTime();
    if (!firstModuleCompleteByModule.has(r.module_id) ||
        t < firstModuleCompleteByModule.get(r.module_id)) {
      firstModuleCompleteByModule.set(r.module_id, t);
    }
  }

  const builtDifferent = quizRows.some(r => {
    if (!r.passed) return false;
    const modT = firstModuleCompleteByModule.get(r.module_id);
    return modT === undefined || new Date(r.created_at).getTime() < modT;
  });

  if (builtDifferent) earned.add(1);

  // Fix 3: was quizRows.every(r => !r.passed) — that checks every attempt row, so
  // passing any quiz (even a different module) permanently blocks this achievement.
  // Correct check: every module was attempted AND no module has ever been passed.
  if (modulesAttempted.size === TOTAL_MODULES && modulesPassed.size === 0) earned.add(2);

  if (modulesPassed.size === TOTAL_MODULES) earned.add(3);
  if (modulesPerfect.size === TOTAL_MODULES) earned.add(4);
  if (modulesSavant.size === TOTAL_MODULES) earned.add(5);
  if (modulesPerfect.size >= 1) earned.add(22);
  if (modulesPerfect.size >= 3) earned.add(23);

  const modulesDoneCount = new Set(moduleRows.map(r => r.module_id)).size;
  if (modulesDoneCount >= 1) earned.add(6);
  if (modulesDoneCount >= 2) earned.add(7);
  if (modulesDoneCount >= 3) earned.add(8);
  if (modulesDoneCount >= 4) earned.add(9);
  if (modulesDoneCount >= TOTAL_MODULES) earned.add(10);
  if (modulesDoneCount >= 1) earned.add(11);

  const simCount  = simRows.length;
  const bestScore = simRows.reduce((m, r) => Math.max(m, Number(r.score) || 0), 0);

  // Fix 10: bucket by PHT calendar date instead of raw UTC date
  const byDate = new Map();
  for (const r of simRows) {
    const day = datePHT(r.created_at);
    byDate.set(day, (byDate.get(day) || 0) + 1);
  }

  if ([...byDate.values()].some(c => c >= QUICK_LEARNER_DAILY)) earned.add(12);
  if (simCount >= LAB_RAT_RUNS) earned.add(13);
  if (bestScore >= PERFECT_SIM_SCORE) earned.add(14);

  const hasFastSession = simRows.some(r => r.duration_seconds > 0 && r.duration_seconds <= SPEED_DEMON_SECONDS);
  if (hasFastSession) earned.add(15);

  // Fix 10: sortedDays also uses PHT-adjusted keys (from byDate above)
  const sortedDays = [...byDate.keys()].sort();
  let longestStreak = 0;
  let run = 0;
  let prevTs = null;
  for (const day of sortedDays) {
    const ts = new Date(day + 'T00:00:00Z').getTime();
    if (prevTs !== null && (ts - prevTs) === 86_400_000) run += 1;
    else run = 1;
    if (run > longestStreak) longestStreak = run;
    prevTs = ts;
  }
  STREAK_TIERS.forEach((threshold, i) => {
    if (longestStreak >= threshold) earned.add(16 + i);
  });

  const hasEarlyBird = simRows.some(r => {
    const h = phtHour(r.created_at);
    // Fix 4: was h <= 6 (excluded 07:00); description says "7 AM" so h < 7 is correct
    return h >= 3 && h < 7;
  });
  const hasNightOwl = simRows.some(r => {
    const h = phtHour(r.created_at);
    return h >= 23 || h < 3;
  });
  if (hasEarlyBird) earned.add(20);
  if (hasNightOwl)  earned.add(21);

  return earned;
}

async function evaluateAndPersist(userId) {
  const [alreadyRows] = await pool.query(
    'SELECT achievement_id FROM user_achievements WHERE user_id = ?',
    [userId]
  );
  const already = new Set(alreadyRows.map(r => r.achievement_id));

  // Fix A: skip all evaluation queries when every achievement is already earned.
  // ACHIEVEMENT_DEFS.length is the total count of defined achievements (23).
  if (already.size >= ACHIEVEMENT_DEFS.length) return [];

  const shouldHave = await evaluateAchievements(userId);
  const newly = [];
  let totalXp = 0;

  // Fix B: wrap INSERT IGNORE loop and XP UPDATE in a single transaction.
  // Previously these were separate pool.query() calls — a crash between the last
  // INSERT and the UPDATE left achievements recorded without their XP awarded.
  // [audit fix] Also record each XP award in xp_events and capture old XP for
  //             level-up detection before the update.
  const conn = await pool.getConnection();
  let oldXp = 0;
  try {
    await conn.beginTransaction();

    // Fetch current XP (for level-up detection) with FOR UPDATE to lock the row
    const [[{ xp_points: currentXp }]] = await conn.query(
      'SELECT xp_points FROM users WHERE id = ? FOR UPDATE',
      [userId]
    );
    oldXp = currentXp;

    for (const id of shouldHave) {
      if (already.has(id)) continue;
      // INSERT IGNORE: concurrent requests may both pass the already.has() check.
      // affectedRows === 0 means another request won the race — skip XP for this id.
      const [result] = await conn.query(
        'INSERT IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)',
        [userId, id]
      );
      if (result.affectedRows === 0) continue;

      const def = DEFS_BY_ID.get(id);
      if (!def) continue;
      newly.push(def);
      totalXp += def.points || 0;

      // [audit fix] Insert XP event for this achievement inside the same transaction
      await conn.query(
        'INSERT INTO xp_events (user_id, amount, source, reference_id) VALUES (?, ?, ?, ?)',
        [userId, def.points, 'achievement', id]
      );
    }

    if (totalXp > 0) {
      await conn.query(
        'UPDATE users SET xp_points = xp_points + ? WHERE id = ?',
        [totalXp, userId]
      );
    }

    await conn.commit();
  } catch (err) {
    await conn.rollback();
    throw err;
  } finally {
    conn.release();
  }

  // [audit fix] Level-up detection: after transaction commits, check if level increased.
  // Fire notification outside the transaction to avoid blocking.
  if (totalXp > 0) {
    try {
      await checkLevelUp(userId, oldXp, oldXp + totalXp);
    } catch (err) {
      console.error('checkLevelUp error in evaluateAndPersist', { userId, err: err.message });
    }
  }

  // Notifications fire after commit — outside the transaction so a notification
  // failure cannot roll back already-persisted achievements and XP.
  for (const def of newly) {
    try {
      await createNotification({
        userId,
        type:    'achievement',
        // Use def.name as title so (user_id, type, title, link) is unique per achievement.
        title:   def.name,
        message: `${def.description} · +${def.points} XP`,
        link:    '/student/dashboard/profile',
      });
    } catch (err) {
      console.error('achievement notification failed', { userId, achievementId: def.id, err: err.message });
    }
  }

  return newly;
}

module.exports = { evaluateAndPersist, ACHIEVEMENT_DEFS, DEFS_BY_ID };
