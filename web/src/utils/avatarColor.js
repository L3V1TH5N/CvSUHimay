// file path: web/src/utils/avatarColor.js

/**
 * Generates a deterministic pastel color from a user ID.
 * Uses a simple hash function to select from a predefined palette
 * that mimics Google Classroom's soft, accessible colors.
 *
 * @param {number|string} userId - The user's unique identifier
 * @returns {string} CSS background color (e.g., '#e8f0fe')
 */
export const getAvatarColor = (userId) => {
  // Palette of 12 soft, distinguishable colors (Google Classroom style)
  const palette = [
    '#e8f0fe', // soft blue
    '#e6f4ea', // soft green
    '#fef7e0', // soft yellow
    '#fce8e6', // soft red
    '#e8e0f5', // soft purple
    '#f3e5f5', // lavender
    '#e0f7fa', // cyan
    '#fff3e0', // peach
    '#fbe9e7', // coral
    '#e0f2f1', // teal
    '#f1f8e9', // lime
    '#fce4ec', // pink
  ];

  if (!userId) return palette[0];

  // Simple hash: sum char codes and modulo palette length
  const str = String(userId);
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash) + str.charCodeAt(i);
    hash |= 0; // Convert to 32-bit integer
  }
  const index = Math.abs(hash) % palette.length;
  return palette[index];
};