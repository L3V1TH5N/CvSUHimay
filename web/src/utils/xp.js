// file path: web/src/utils/xp.js
//
// [change] Level now computed via quadratic formula — infinite progression.
//          Removed LEVEL_THRESHOLDS array and isMaxLevel field.
//          rankAccent extended to treat level ≥ 6 as legendary.

const RANK_NAMES = [
  'Novice', 'Apprentice', 'Practitioner', 'Skilled', 'Expert', 'Master',
  'Grandmaster', 'Legend', 'Mythic'
];

export const computeXP = (totalPoints) => {
  // Quadratic formula: XP for level n = 25 * (n-1) * n
  let level = 1;
  const c = totalPoints / 25;
  if (totalPoints >= 50) {
    level = Math.floor((1 + Math.sqrt(1 + 4 * c)) / 2);
  }

  const currentThreshold = level <= 1 ? 0 : 25 * (level - 1) * level;
  const nextThreshold    = 25 * level * (level + 1);
  const xpIntoLevel      = totalPoints - currentThreshold;
  const xpNeeded         = nextThreshold - currentThreshold;
  const progress         = Math.min(xpIntoLevel / xpNeeded, 1);

  const rankIdx = Math.min(level - 1, RANK_NAMES.length - 1);
  const nextIdx = Math.min(level,     RANK_NAMES.length - 1);

  return {
    level,
    rank:        RANK_NAMES[rankIdx] ?? `Level ${level}`,
    nextRank:    RANK_NAMES[nextIdx] ?? `Level ${level + 1}`,
    totalPoints,
    xpIntoLevel,
    xpNeeded,
    progress,
    // No isMaxLevel — levels are infinite.
  };
};

// Pure helper: returns the rank name for a given XP total.
export const rankFor = (xp) => {
  let level = 1;
  const c = (xp ?? 0) / 25;
  if ((xp ?? 0) >= 50) {
    level = Math.floor((1 + Math.sqrt(1 + 4 * c)) / 2);
  }
  const idx = level - 1;
  return idx < RANK_NAMES.length ? RANK_NAMES[idx] : `Level ${level}`;
};

// Maps a level to the rarity-tier token for visual accent.
// Levels 1-5 same as before; level 6+ → legendary, level 10+ → mythic (custom).
export const rankAccent = (level) => {
  if (level >= 10) return { tier: "legendary", token: "var(--color-rarity-legendary)" }; // could add "mythic" tier if desired
  if (level >= 6)  return { tier: "legendary", token: "var(--color-rarity-legendary)" };
  const map = {
    1: { tier: "common",    token: "var(--color-rarity-common)"    },
    2: { tier: "uncommon",  token: "var(--color-rarity-uncommon)"  },
    3: { tier: "rare",      token: "var(--color-rarity-rare)"      },
    4: { tier: "epic",      token: "var(--color-rarity-epic)"      },
    5: { tier: "epic",      token: "var(--color-rarity-epic)"      },
  };
  return map[level] || map[1];
};