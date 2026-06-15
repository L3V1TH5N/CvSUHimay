// file path: backend/src/middleware/instructorOnly.js
//
// Fix 9: Extracted from the inline isInstructor defined in routes/courses.js.
// Shared role guard — import this instead of redefining per-router.

const instructorOnly = (req, res, next) => {
  // [Fix #9] Defensive guard: authMiddleware always sets req.user before calling
  // next(), but if this middleware is ever applied without authMiddleware in the
  // chain, req.user.role would throw TypeError and crash the process.
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'instructor') {
    return res.status(403).json({ error: 'Access denied. Instructor only.' });
  }
  next();
};

module.exports = instructorOnly;
