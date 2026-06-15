// file path: backend/src/routes/notifications.js
// CHANGES:
// - createNotification and createNotifications moved to utils/notifications.js.
//   This file now only contains route handlers and re-exports the helpers
//   (backward compatibility for any internal consumers that haven't been updated).
//   New imports will use the utils path directly.

const express        = require('express');
const router         = express.Router();
const pool           = require('../db');
const authMiddleware = require('../middleware/auth');
const { createNotification, createNotifications } = require('../utils/notifications');

// Parses a route :id param as a positive integer.
// Returns null for non-numeric, zero, or negative values so routes can return 400.
function parseId(raw) {
  const n = parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

// ══════════════════════════════════════════════════════════════════════════
// GET /api/notifications
// Returns the current user's 50 newest notifications.
// ══════════════════════════════════════════════════════════════════════════
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT id, type, title, message, link, is_read, created_at
       FROM notifications
       WHERE user_id = ?
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.user.id]
    );
    res.json({ notifications: rows });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/notifications/unread-count
// Cheap count endpoint used to populate the bell badge.
// ══════════════════════════════════════════════════════════════════════════
router.get('/unread-count', authMiddleware, async (req, res) => {
  try {
    const [[row]] = await pool.query(
      'SELECT COUNT(*) AS count FROM notifications WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    // Cast to Number: MySQL COUNT(*) returns a string or BigInt in some driver versions.
    res.json({ count: Number(row.count) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch count' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PATCH /api/notifications/read-all
// NOTE: must be registered BEFORE /:id/read so Express matches it first.
// Marks all unread notifications as read for the authenticated user.
// ══════════════════════════════════════════════════════════════════════════
router.patch('/read-all', authMiddleware, async (req, res) => {
  try {
    await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE user_id = ? AND is_read = FALSE',
      [req.user.id]
    );
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PATCH /api/notifications/:id/read
// Marks a single notification as read — only if it belongs to the caller.
// ══════════════════════════════════════════════════════════════════════════
router.patch('/:id/read', authMiddleware, async (req, res) => {
  // Previously: invalid IDs (e.g. 'abc') passed directly to the query, silently no-oped, and returned 200.
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid notification ID' });

  try {
    const [result] = await pool.query(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    // Previously: 0 affectedRows still returned { success: true } — a lie to the caller.
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/notifications/:id
// Permanently removes a single notification owned by the caller.
// ══════════════════════════════════════════════════════════════════════════
router.delete('/:id', authMiddleware, async (req, res) => {
  // Previously: invalid IDs passed directly; 0 affectedRows returned 200; e.message was leaked.
  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'Invalid notification ID' });

  try {
    const [result] = await pool.query(
      'DELETE FROM notifications WHERE id = ? AND user_id = ?',
      [id, req.user.id]
    );
    if (result.affectedRows === 0) return res.status(404).json({ error: 'Notification not found' });
    res.json({ success: true });
  } catch (e) {
    // Previously exposed e.message (internal DB details) to the client — removed.
    res.status(500).json({ error: 'Failed to delete notification' });
  }
});

// Re-export for any remaining internal consumers (but prefer utils/notifications)
module.exports = router;
module.exports.createNotification  = createNotification;
module.exports.createNotifications = createNotifications;
