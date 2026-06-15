// file path: web/src/utils/format.js

/**
 * "January 1, 2024" — used for join dates, birthdays (display)
 */
export const formatDateLong = (dateString) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric", month: "long", day: "numeric",
    });
  } catch { return null; }
};

/**
 * "Jan 1, 2024" — used for achievement unlock dates, quiz attempt dates
 */
export const formatDateShort = (dateString) => {
  if (!dateString) return null;
  try {
    return new Date(dateString).toLocaleDateString("en-US", {
      month: "short", day: "numeric", year: "numeric",
    });
  } catch { return null; }
};

/**
 * "2024-01-01" — used for <input type="date"> value binding
 */
export const formatDateInput = (dateString) => {
  if (!dateString) return "";
  try { return new Date(dateString).toISOString().split("T")[0]; }
  catch { return ""; }
};