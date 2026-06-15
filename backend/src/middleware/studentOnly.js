// file path: backend/src/middleware/studentOnly.js
//
// [fix #11] Extracted from learning.js (was inlined as isStudent).
// Shared middleware — import this instead of redefining per-router.

const studentOnly = (req, res, next) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'ACCESS_DENIED', message: 'Student only.' });
  }
  next();
};

module.exports = studentOnly;
