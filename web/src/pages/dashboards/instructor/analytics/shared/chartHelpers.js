export const getCSSVar = (name, fallback = "") =>
  typeof window !== "undefined"
    ? getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback
    : fallback;

export const fmtSeconds = (s) => {
  if (s === null || s === undefined) return "—";
  const m = Math.floor(s / 60);
  const sec = Math.round(s % 60);
  return `${m}:${String(sec).padStart(2, "0")}`;
};

export const fmtLastActive = (dateStr) => {
  if (!dateStr) return "Never";
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return "Never";
  const diff = Math.floor((Date.now() - date) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff < 7)  return `${diff}d ago`;
  if (diff < 30) return `${Math.floor(diff / 7)}w ago`;
  return `${Math.floor(diff / 30)}mo ago`;
};

export const scoreBadge = (pct) =>
  pct == null   ? "ar-badge--warn"
  : pct >= 75   ? "ar-badge--pass"
  : pct >= 60   ? "ar-badge--warn"
  : "ar-badge--fail";
