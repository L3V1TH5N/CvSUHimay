// file path: backend/src/routes/users.js

const express = require('express');
const bcrypt  = require('bcryptjs');
const pool    = require('../db');
const authMiddleware = require('../middleware/auth');
const router  = express.Router();

const { logActivity } = require('../utils/activityLog');

const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Access denied. Admin only.' });
  next();
};

// ── GET /stats — aggregate counts (must be before /:id) ──────────────────
router.get('/stats', authMiddleware, isAdmin, async (req, res) => {
  try {
    const [[r]] = await pool.query(`
      SELECT
        COUNT(*) AS total,
        SUM(account_status = 'active') AS active,
        SUM(role = 'instructor') AS instructors,
        SUM(role = 'student') AS students,
        SUM(account_status = 'pending_approval') AS pending
      FROM users
    `);
    res.json(r);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch stats', details: e.message });
  }
});

// ── GET / — list with search, filter, pagination ──────────────────────────
router.get('/', authMiddleware, isAdmin, async (req, res) => {
  const {
    role   = 'all',
    status = 'all',
    search = '',
    page   = 1,
    limit  = 50,
  } = req.query;

  const cap    = Math.min(parseInt(limit) || 50, 100);
  const offset = (Math.max(parseInt(page) || 1, 1) - 1) * cap;

  const conditions = [];
  const params     = [];

  if (role !== 'all')   { conditions.push('u.role = ?');           params.push(role); }
  if (status !== 'all') { conditions.push('u.account_status = ?'); params.push(status); }
  if (search.trim())    {
    conditions.push('(u.full_name LIKE ? OR u.email LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

  try {
    const [[{ total }]] = await pool.query(
      `SELECT COUNT(*) AS total FROM users u ${where}`,
      params
    );

    const [users] = await pool.query(
      `SELECT
         u.id, u.email, u.full_name, u.role, u.account_status, u.requested_role,
         u.avatar_url, u.created_at, u.last_login_at, sp.experience_level,
         COALESCE(cc.cnt, 0) AS course_count,
         COALESCE(ec.cnt, 0) AS enrolled_course_count
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       LEFT JOIN (
         SELECT instructor_id, COUNT(*) AS cnt FROM courses GROUP BY instructor_id
       ) cc ON cc.instructor_id = u.id
       LEFT JOIN (
         SELECT student_id, COUNT(*) AS cnt FROM course_enrollments
         WHERE status = 'accepted' GROUP BY student_id
       ) ec ON ec.student_id = u.id
       ${where}
       ORDER BY u.created_at DESC
       LIMIT ? OFFSET ?`,
      [...params, cap, offset]
    );

    res.json({ users, total, page: parseInt(page), limit: cap });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch users', details: e.message });
  }
});

// GET /api/users/:id/public  (§4.10)
// Returns only public-safe fields: username, full_name, avatar_url,
// equipped_badges, xp_points. Used by leaderboard click-through and
// classmate discovery. No authentication required (data is intentionally public).
// ──────────────────────────────────────────────────────────────────────────
router.get('/:id/public', authMiddleware, async (req, res) => {
  const userId = Number(req.params.id);
  if (!Number.isInteger(userId) || userId < 1) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }
 
  try {
    const [[user]] = await pool.query(
      `SELECT id, username, full_name, avatar_url, equipped_badges, xp_points
       FROM users
       WHERE id = ? AND deleted_at IS NULL AND account_status = 'active'`,
      [userId]
    );
 
    if (!user) return res.status(404).json({ error: 'User not found' });
 
    // Normalise equipped_badges from DB
    user.equipped_badges =
      typeof user.equipped_badges === 'string'
        ? JSON.parse(user.equipped_badges || '[]')
        : (user.equipped_badges ?? []);
 
    res.json({ user });
  } catch (err) {
    console.error('public profile error', { userId, err: err.message });
    res.status(500).json({ error: 'PUBLIC_PROFILE_FAILED' });
  }
});

// ── GET /:id ──────────────────────────────────────────────────────────────
router.get('/:id', authMiddleware, isAdmin, async (req, res) => {
  try {
    // Explicit column list — excludes password_hash, token_version (JWT revocation
    // counter; leaking it could aid session-invalidation attacks), and google_id
    // (internal OAuth identifier with no admin UI purpose).
    const [[user]] = await pool.query(
      `SELECT
         u.id, u.email, u.full_name, u.role, u.username, u.bio, u.avatar_url,
         u.phone, u.date_of_birth, u.address,
         sp.student_id, sp.experience_level, sp.department, sp.year_level,
         u.equipped_badges, u.onboarding_completed, u.tour_completed,
         u.xp_points, u.current_streak, u.last_active_date,
         u.auth_provider, u.account_status, u.requested_role,
         u.approval_decision_by, u.approval_decision_at,
         u.must_change_password, u.failed_login_attempts, u.lock_until,
         u.last_login_at, u.last_password_changed_at, u.deleted_at,
         u.created_at, u.updated_at
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = ?`,
      [req.params.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ user });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user', details: e.message });
  }
});

// ── POST / — admin create user ────────────────────────────────────────────
router.post('/', authMiddleware, isAdmin, async (req, res) => {
  const { email, password, role, full_name, must_change_password = 1 } = req.body;

  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  if (!['student', 'instructor', 'admin'].includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    // Admin-created users skip approval — always active
    const [result] = await pool.query(
      `INSERT INTO users
         (email, password_hash, role, full_name,
          account_status, must_change_password)
       VALUES (?, ?, ?, ?, 'active', ?)`,
      [email, hash, role, full_name || null, must_change_password ? 1 : 0]
    );

    // Seed a student_profiles row with default experience_level for new students
    if (role === 'student') {
      await pool.query(
        `INSERT INTO student_profiles (user_id, experience_level)
         VALUES (?, 'beginner')
         ON DUPLICATE KEY UPDATE experience_level = experience_level`,
        [result.insertId]
      );
    }

    await logActivity(req.user.id, 'user.create', result.insertId, full_name || email, { role, email });
    res.json({ message: 'User created successfully', userId: result.insertId });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to create user', details: e.message });
  }
});

// ── PUT /:id — partial update ─────────────────────────────────────────────
router.put('/:id', authMiddleware, isAdmin, async (req, res) => {
  const { email, role, full_name, password } = req.body;
  const userId = parseInt(req.params.id);

  try {
    const [currentRows] = await pool.query('SELECT * FROM users WHERE id = ?', [userId]);
    if (currentRows.length === 0) return res.status(404).json({ error: 'User not found' });
    const current = currentRows[0];

    // Prevent self-demotion if last admin
    if (role && role !== 'admin' && current.role === 'admin') {
      const [[{ cnt }]] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM users WHERE role='admin' AND id != ?",
        [userId]
      );
      if (cnt === 0) {
        return res.status(400).json({ error: 'Cannot demote the last admin' });
      }
    }

    const updates = [];
    const values  = [];

    if (email)             { updates.push('email = ?');     values.push(email); }
    if (full_name !== undefined) { updates.push('full_name = ?'); values.push(full_name); }
    if (password) {
      const hash = await bcrypt.hash(password, 10);
      updates.push('password_hash = ?');
      values.push(hash);
    }

    if (role && ['student', 'instructor', 'admin'].includes(role) && role !== current.role) {
      updates.push('role = ?');
      values.push(role);

      // Side-door approval: promoting a pending instructor via role change
      if (role === 'instructor' && current.account_status === 'pending_approval') {
        updates.push('account_status = ?', 'approval_decision_by = ?', 'approval_decision_at = NOW()');
        values.push('active', req.user.id);
        // Close any open application row
        await pool.query(
          `UPDATE instructor_applications SET status='approved', decided_by=?, decided_at=NOW()
           WHERE user_id=? AND status='pending'`,
          [req.user.id, userId]
        );
      }
    }

    if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

    values.push(userId);
    await pool.query(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`, values);

    const changes = {};
    if (email     && email     !== current.email)          changes.email     = { from: current.email,     to: email };
    if (full_name !== undefined && full_name !== current.full_name) changes.full_name = { from: current.full_name, to: full_name };
    if (role      && role      !== current.role)           changes.role      = { from: current.role,      to: role };
    await logActivity(req.user.id, 'user.update', userId, current.full_name || current.email,
      Object.keys(changes).length ? { changes } : null);
    res.json({ message: 'User updated successfully' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Email already exists' });
    res.status(500).json({ error: 'Failed to update user', details: e.message });
  }
});

// ── DELETE /:id ────────────────────────────────────────────────────────────
router.delete('/:id', authMiddleware, isAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);

  if (userId === req.user.id) {
    return res.status(400).json({ error: 'Cannot delete your own account' });
  }

  try {
    // Prevent deleting the last admin
    const [targetRows] = await pool.query('SELECT role, full_name, email FROM users WHERE id = ?', [userId]);
    if (targetRows.length === 0) return res.status(404).json({ error: 'User not found' });

    if (targetRows[0].role === 'admin') {
      const [[{ cnt }]] = await pool.query(
        "SELECT COUNT(*) AS cnt FROM users WHERE role='admin' AND id != ?",
        [userId]
      );
      if (cnt === 0) {
        return res.status(400).json({ error: 'Cannot delete the last admin account' });
      }
    }

    await pool.query('DELETE FROM users WHERE id = ?', [userId]);
    await logActivity(req.user.id, 'user.delete', userId,
      targetRows[0].full_name || targetRows[0].email, { role: targetRows[0].role });
    res.json({ deleted: true, id: userId });
  } catch (e) {
    res.status(500).json({ error: 'Failed to delete user', details: e.message });
  }
});

// ── POST /:id/reset-password ───────────────────────────────────────────────
router.post('/:id/reset-password', authMiddleware, isAdmin, async (req, res) => {
  const userId = parseInt(req.params.id);

  try {
    const [rows] = await pool.query('SELECT id, full_name, email FROM users WHERE id = ?', [userId]);
    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    // Generate random 12-char password
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$';
    let tempPassword = '';
    for (let i = 0; i < 12; i++) {
      tempPassword += chars[Math.floor(Math.random() * chars.length)];
    }

    const hash = await bcrypt.hash(tempPassword, 10);
    await pool.query(
      'UPDATE users SET password_hash=?, must_change_password=1, failed_login_attempts=0, lock_until=NULL WHERE id=?',
      [hash, userId]
    );

    await logActivity(req.user.id, 'user.reset_password', userId,
      rows[0].full_name || rows[0].email, null);
    res.json({ temporary_password: tempPassword });
  } catch (e) {
    res.status(500).json({ error: 'Failed to reset password', details: e.message });
  }
});

// ── Admin-only: create instructor account directly (no application) ─────────
// POST /api/users/instructors — requires authMiddleware + isAdmin
router.post('/instructors', authMiddleware, isAdmin, async (req, res) => {
  const { full_name, email, password, must_change_password = 1 } = req.body;

  if (!full_name || !email || !password) {
    return res.status(400).json({ error: 'Full name, email, and password are required' });
  }

  try {
    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users
         (email, password_hash, role, full_name, auth_provider, account_status, must_change_password)
       VALUES (?, ?, 'instructor', ?, 'local', 'active', ?)`,
      [email, hash, full_name, must_change_password ? 1 : 0]
    );

    // Fetch inserted user without password_hash to return
    const [users] = await pool.query(
      `SELECT id, email, role, full_name, username, avatar_url, xp_points,
              onboarding_completed, tour_completed,
              account_status, created_at, updated_at
       FROM users WHERE id = ?`,
      [result.insertId]
    );

    res.json({
      message: 'Instructor account created successfully',
      user: users[0],
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Failed to create instructor', details: e.message });
  }
});

module.exports = router;