// file path: backend/src/routes/account.js

const express = require('express');
const router = express.Router();
const pool = require('../db');
const authMiddleware = require('../middleware/auth');
const requireLiveUser = require('../middleware/requireLiveUser');

// POST /api/account/export — requests a data export (queued)
router.post('/export', authMiddleware, async (req, res) => {
  try {
    const [result] = await pool.query(
      'INSERT INTO data_exports (user_id, status) VALUES (?, ?)',
      [req.user.id, 'pending']
    );
    res.json({ message: 'Export requested', exportId: result.insertId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to request export' });
  }
});

// DELETE /api/account — soft-delete account (alias for /api/profile DELETE)
router.delete('/', authMiddleware, requireLiveUser, async (req, res) => {
  try {
    await pool.query('UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?', [req.user.id]);
    // Evict requireLiveUser cache so deletion takes effect immediately
    requireLiveUser.invalidateCache(req.user.id);
    res.json({ message: 'Account deleted successfully.' });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete account' });
  }
});

module.exports = router;
