// file path: backend/src/routes/sessions.js

const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');

function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// GET /api/sessions - list auth sessions for current user
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, device, user_agent, ip, last_active_at, created_at
       FROM auth_sessions
       WHERE user_id = ?
       ORDER BY last_active_at DESC`,
      [req.user.id]
    );
    res.json({ sessions: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch sessions' });
  }
});

// DELETE /api/sessions/:id - delete a specific session belonging to the user
router.delete('/:id', authMiddleware, async (req, res) => {
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid session id' });
  try {
    const [result] = await pool.query('DELETE FROM auth_sessions WHERE id = ? AND user_id = ?', [id, req.user.id]);
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Session not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;
