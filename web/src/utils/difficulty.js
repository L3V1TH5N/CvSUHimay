// Shared difficulty label, color, and dot styling for modules and cards.
// Replaces duplicate helpers in Modules.jsx and ModuleReader.jsx.

const DIFFICULTY_CONFIG = {
  beginner:     { label: 'Beginner',     style: 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/25', dot: 'bg-emerald-500' },
  intermediate: { label: 'Intermediate', style: 'bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-500/25',   dot: 'bg-amber-500' },
  advanced:     { label: 'Advanced',     style: 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400 border-rose-200 dark:border-rose-500/25',         dot: 'bg-rose-500' },
};

/**
 * Returns the Tailwind classes for a difficulty badge.
 * @param {string} difficulty - 'beginner' | 'intermediate' | 'advanced'
 * @returns {string} CSS classes
 */
export function getDifficultyColor(difficulty) {
  return (DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.beginner).style;
}

/**
 * Returns the dot color class for a difficulty level.
 * @param {string} difficulty
 * @returns {string}
 */
export function getDifficultyDot(difficulty) {
  return (DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.beginner).dot;
}

/**
 * Returns the complete difficulty config object (label, style, dot).
 * @param {string} difficulty
 * @returns {{ label: string, style: string, dot: string }}
 */
export function getDifficultyConfig(difficulty) {
  return DIFFICULTY_CONFIG[difficulty] ?? DIFFICULTY_CONFIG.beginner;
}