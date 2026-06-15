// file path: backend/src/middleware/instructorOrAdmin.js
//
// [Fix #5] Unified role guard for routes accessible by both instructors and admins.
// Replaces the three divergent inline req.user.role checks that existed across
// instructor.js quiz routes — each had different 403 messages and admin handling.
// Apply this to any route that should allow admin access in addition to instructor.

const instructorOrAdmin = (req, res, next) => {
  // Defensive guard: prevents TypeError crash if applied without authMiddleware.
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  if (req.user.role !== 'instructor' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Access denied. Instructor or admin only.' });
  }
  next();
};

module.exports = instructorOrAdmin;
