// file path: backend/src/utils/gamification.js
// XP levels, streak logic, and learning/quiz constants.
//
// [change] Replaced fixed LEVEL_THRESHOLDS with a quadratic formula: XP required = 25 * (n-1) * n.
//          Levels are now infinite; no max level cap.
//          Extended RANK_NAMES to cover higher levels.
//          Removed LEVEL_THRESHOLDS export; rankFor handles arbitrary levels.
//
// [fix] Moved createNotification require from inline dynamic require to module-level import.
//       Inline dynamic require inside checkLevelUp obscured the dependency graph and
//       made the module untestable. No circular dependency risk — notifications.js does
//       not import gamification.js.
//
// [fix] checkLevelUp now fires one notification per level crossed instead of one for
//       the final level only. A jump from level 1 to level 3 now fires "Level 2 Reached"
//       and "Level 3 Reached" so no milestone is silently skipped.
//
// [fix L] checkLevelUp now fires all level-up notifications concurrently via Promise.all.
//         Previously the for...await loop chained N serial DB round-trips for a
//         multi-level XP jump. N notifications now fire in parallel.

'use strict';

// [fix] Module-level import — replaces the inline dynamic require inside checkLevelUp.
const { createNotification } = require('./notifications');

// ── XP / Level ──────────────────────────────────────────────────────────────

/**
 * Compute current level from total XP using the quadratic formula.
 * Level n requires 25 * (n-1) * n XP total.
 * n = floor( (1 + sqrt(1 + 4*XP/25)) / 2 )
 */
function computeLevel(totalPoints) {
  if (totalPoints < 50) return 1;
  const c = totalPoints / 25;
  return Math.floor((1 + Math.sqrt(1 + 4 * c)) / 2);
}

const RANK_NAMES = [
  'Novice', 'Apprentice', 'Practitioner', 'Skilled', 'Expert', 'Master',
  'Grandmaster', 'Legend', 'Mythic'
];

/**
 * Returns the rank name for a given level.
 * Falls back to "Level N" if the level exceeds the predefined names.
 */
function rankFor(level) {
  const idx = level - 1;
  return idx < RANK_NAMES.length ? RANK_NAMES[idx] : `Level ${level}`;
}

// ── Streak ───────────────────────────────────────────────────────────────────

function todayPHT() {
  const pht = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
  return pht.toISOString().slice(0, 10);
}

async function updateStreak(userId, db) {
  const today = todayPHT();

  const [[row]] = await db.query(
    'SELECT current_streak, last_active_date FROM users WHERE id = ?',
    [userId]
  );

  if (!row) return;

  const lastActive = row.last_active_date
    ? (row.last_active_date instanceof Date
        ? row.last_active_date.toISOString().slice(0, 10)
        : String(row.last_active_date).slice(0, 10))
    : null;

  if (lastActive === today) return;

  const yesterdayDate = new Date(new Date().getTime() + 8 * 60 * 60 * 1000);
  yesterdayDate.setUTCDate(yesterdayDate.getUTCDate() - 1);
  const yesterday = yesterdayDate.toISOString().slice(0, 10);

  const newStreak = lastActive === yesterday
    ? (row.current_streak ?? 0) + 1
    : 1;

  await db.query(
    'UPDATE users SET current_streak = ?, last_active_date = ? WHERE id = ?',
    [newStreak, today, userId]
  );
}

// ── Learning / Quiz constants ────────────────────────────────────────────────

const TOTAL_MODULES        = 5;
const PASS_THRESHOLD       = 0.7;
const QUESTIONS_PER_QUIZ   = 10;
const SECONDS_PER_QUESTION = 60;

const XP_PER_CORRECT       = 5;
const XP_PASS_BONUS        = 20;
const XP_PERFECT_BONUS     = 50;
const XP_RETAKE_MULTIPLIER = 0.5;

// [fix] One notification per level crossed; no milestone is silently skipped.
// [fix L] All notifications are fired concurrently via Promise.all instead of
//         a sequential for...await loop. A multi-level XP jump previously chained
//         N serial round-trips; now N notifications fire in parallel.
async function checkLevelUp(userId, oldXp, newXp) {
  const oldLevel = computeLevel(oldXp);
  const newLevel = computeLevel(newXp);
  if (newLevel <= oldLevel) return;

  // Build all notification promises, then await them together.
  const promises = [];
  for (let l = oldLevel + 1; l <= newLevel; l++) {
    promises.push(
      createNotification({
        userId,
        type:    'level_up',
        title:   `Level ${l} Reached`,
        message: `You leveled up to ${rankFor(l)}. Keep going!`,
        link:    '/student/dashboard/profile',
      })
    );
  }
  await Promise.all(promises);
}

module.exports = {
  // XP / Level (LEVEL_THRESHOLDS removed; levels are now infinite)
  computeLevel, rankFor, RANK_NAMES,
  // Streak
  updateStreak,
  // Learning constants
  TOTAL_MODULES, PASS_THRESHOLD, QUESTIONS_PER_QUIZ, SECONDS_PER_QUESTION,
  XP_PER_CORRECT, XP_PASS_BONUS, XP_PERFECT_BONUS, XP_RETAKE_MULTIPLIER,
  // Level-up helper
  checkLevelUp,
};
