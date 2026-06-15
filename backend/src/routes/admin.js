// file path: backend/src/routes/admin.js

const express        = require('express');
const pool           = require('../db');
const authMiddleware = require('../middleware/auth');
const router         = express.Router();

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin only.' });
  next();
};

// ── GET /activity-logs ────────────────────────────────────────────────────────
router.get('/activity-logs', authMiddleware, isAdmin, async (req, res) => {
  const page   = Math.max(1, parseInt(req.query.page)  || 1);
  const limit  = Math.min(50, parseInt(req.query.limit) || 20);
  const offset = (page - 1) * limit;
  const action = req.query.action?.trim() || null;

  try {
    const where       = action ? 'WHERE action = ?' : '';
    const filterParam = action ? [action] : [];

    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM activity_logs ${where}`,
      filterParam
    );

    const [logs] = await pool.query(
      `SELECT id, admin_id, admin_name, action, target_id, target_name, details, created_at
       FROM activity_logs ${where}
       ORDER BY created_at DESC
       LIMIT ? OFFSET ?`,
      [...filterParam, limit, offset]
    );

    res.json({ logs, total, page, limit });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch activity logs', details: e.message });
  }
});

module.exports = router;
