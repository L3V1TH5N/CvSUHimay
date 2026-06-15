// file path: backend/src/routes/auth.js
//
// Simplified: instructor self-signup removed.
// - POST /register now only accepts role='student'.
// - instructor field validation and notification helpers deleted.
// - POST /google-signup rejects requestedRole='instructor' with 400.
// - Register handler simplified (no transaction needed for student-only).

const express  = require('express');
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const pool     = require('../db');
const crypto   = require('crypto');
const authMiddleware = require('../middleware/auth');
const requireLiveUser = require('../middleware/requireLiveUser');
const router   = express.Router();

const googleClient = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Helpers ───────────────────────────────────────────────────────────────

const buildUserPayload = (user, extras = {}) => ({
  id:                   user.id,
  email:                user.email,
  role:                 user.role,
  full_name:            user.full_name,
  username:             user.username          ?? null,
  avatar_url:           user.avatar_url        ?? null,
  xp_points:            user.xp_points         ?? 0,
  onboarding_completed: !!user.onboarding_completed,
  tour_completed:       !!user.tour_completed,
  // profile fields sourced from student_profiles via LEFT JOIN
  experience_level:     user.experience_level  ?? null,
  student_id:           user.student_id        ?? null,
  year_level:           user.year_level        ?? null,
  department:           user.department        ?? null,
  bio:                  user.bio               ?? null,
  account_status:       user.account_status    ?? 'active',
  requested_role:       user.requested_role    ?? null,
  ...extras,
});

// Fix 11: moved to utils/password.js — import and re-export so existing callers of
// require('./auth').checkPasswordPolicy continue to work without changes.
const { checkPasswordPolicy } = require('../utils/password');

// ── Verifier A: ID-token (GoogleLogin component, original flow) ─────────────
const verifyGoogleCredential = async (credential) => {
  if (!credential) throw new Error('Missing credential');
  const ticket = await googleClient.verifyIdToken({
    idToken:  credential,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  const payload = ticket.getPayload();
  if (!payload.email_verified) throw new Error('Google email not verified');
  return {
    googleId:      payload.sub,
    email:         payload.email,
    name:          payload.name,
    emailVerified: payload.email_verified,
  };
};

// ── Verifier B: access_token (useGoogleLogin hook, custom button flow) ───────
const verifyGoogleAccessToken = async (accessToken) => {
  if (!accessToken) throw new Error('Missing access_token');

  const response = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    throw new Error(`Google userinfo request failed: ${response.status}`);
  }

  const payload = await response.json();

  if (!payload.email_verified) throw new Error('Google email not verified');

  return {
    googleId:      payload.sub,
    email:         payload.email,
    name:          payload.name,
    emailVerified: payload.email_verified,
  };
};

// ── Unified resolver — picks the right verifier based on what the client sent.
const resolveGoogleIdentity = async (body) => {
  if (body.credential)    return verifyGoogleCredential(body.credential);
  if (body.access_token)  return verifyGoogleAccessToken(body.access_token);
  throw new Error('Missing Google credential or access_token');
};

// ── Token signing ───────────────────────────────────────────────────────────
function signToken(user) {
  return jwt.sign(
    {
      id:            user.id,
      role:          user.role,
      email:         user.email,
      token_version: user.token_version ?? 0,
    },
    process.env.JWT_SECRET,
    { expiresIn: '4h' }
  );
}

// ─── Register (student-only) ────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  const { email, password, full_name, role = 'student' } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Only student self-registration is allowed.
  if (role !== 'student') {
    return res.status(400).json({ error: 'Only student registration is allowed' });
  }

  const pwErrs = checkPasswordPolicy(password);
  if (pwErrs.length) {
    return res.status(400).json({ error: 'Weak password', details: pwErrs });
  }

  // No transaction needed — single INSERT + profile row.
  try {
    const hash = await bcrypt.hash(password, 10);

    const [result] = await pool.query(
      `INSERT INTO users
         (email, password_hash, role, full_name, auth_provider,
          account_status, requested_role)
       VALUES (?, ?, ?, ?, 'local', 'active', ?)`,
      [email, hash, role, full_name || null, role]  // requested_role is 'student'
    );

    const userId = result.insertId;

    // Write student-specific fields to student_profiles, not users
    await pool.query(
      `INSERT INTO student_profiles (user_id, experience_level)
       VALUES (?, 'beginner')
       ON DUPLICATE KEY UPDATE experience_level = VALUES(experience_level)`,
      [userId]
    );

    const [rows] = await pool.query(
      `SELECT u.*,
              sp.student_id, sp.department, sp.year_level, sp.experience_level,
              (u.auth_provider = 'local') AS has_password
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.id = ?`,
      [userId]
    );
    const user = rows[0];

    const token = signToken(user);
    res.json({ token, user: buildUserPayload(user), message: 'Account created successfully' });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Registration failed', details: e.message });
  }
});

// ─── Login ─────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  try {
    const [rows] = await pool.query(
      `SELECT u.*, NOW() AS server_now,
              sp.student_id, sp.department, sp.year_level, sp.experience_level,
              (u.auth_provider = 'local') AS has_password
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.email = ?`,
      [email]
    );
    if (rows.length === 0) return res.status(401).json({ error: 'Invalid credentials' });

    const user = rows[0];

    if (user.auth_provider === 'google') {
      return res.status(401).json({
        error: 'This account uses Google Sign-In. Please sign in with Google.',
        provider: 'google',
      });
    }

    // Compare against MySQL's own NOW() to avoid Node.js vs MySQL timezone mismatch
    if (user.lock_until && new Date(user.lock_until) > new Date(user.server_now)) {
      const minutesLeft = Math.ceil((new Date(user.lock_until) - new Date(user.server_now)) / 60000);
      return res.status(423).json({ error: `Account locked. Try again in ${minutesLeft} minute(s).` });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      const newCount = (user.failed_login_attempts || 0) + 1;
      if (newCount >= 5) {
        await pool.query(
          `UPDATE users SET failed_login_attempts = ?, lock_until = DATE_ADD(NOW(), INTERVAL 15 MINUTE) WHERE id = ?`,
          [newCount, user.id]
        );
      } else {
        await pool.query('UPDATE users SET failed_login_attempts = ? WHERE id = ?', [newCount, user.id]);
      }
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await pool.query(
      'UPDATE users SET failed_login_attempts = 0, lock_until = NULL, last_login_at = NOW() WHERE id = ?',
      [user.id]
    );

    const token    = signToken(user);
    const response = { token, user: buildUserPayload(user) };
    if (user.must_change_password) response.must_change_password = true;

    res.json(response);
  } catch (e) {
    res.status(500).json({ error: 'Login failed', details: e.message });
  }
});

// ─── Google Sign-In ────────────────────────────────────────────────────────
router.post('/google-signin', async (req, res) => {
  let verified;
  try {
    verified = await resolveGoogleIdentity(req.body);
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Invalid Google credential' });
  }

  const { googleId, email } = verified;

  try {
    const [existingUsers] = await pool.query(
      `SELECT u.*,
              sp.student_id, sp.department, sp.year_level, sp.experience_level,
              (u.auth_provider = 'local') AS has_password
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.email = ? OR u.google_id = ?`,
      [email, googleId]
    );

    if (existingUsers.length === 0) {
      return res.status(404).json({
        error: 'No account found. Please sign up first.',
        action: 'signup_required',
      });
    }

    const user = existingUsers[0];

    // Link google_id if this was a local account that now signs in via Google
    if (!user.google_id) {
      await pool.query(
        'UPDATE users SET google_id = ?, auth_provider = ? WHERE id = ?',
        [googleId, 'google', user.id]
      );
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = ?', [user.id]);

    const token = signToken(user);
    res.json({ token, user: buildUserPayload(user), message: 'Sign in successful' });
  } catch (e) {
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// ─── Google Sign-Up (student-only) ─────────────────────────────────────────
router.post('/google-signup', async (req, res) => {
  let verified;
  try {
    verified = await resolveGoogleIdentity(req.body);
  } catch (e) {
    return res.status(401).json({ error: e.message || 'Invalid Google credential' });
  }

  const { requestedRole = 'student' } = req.body;

  // Explicitly reject instructor role — admin should use /api/users/instructors
  if (requestedRole !== 'student') {
    return res.status(400).json({ error: 'Only student accounts can be created via Google sign-up.' });
  }

  const { googleId, email, name } = verified;

  try {
    const [existingUsers] = await pool.query(
      `SELECT u.*,
              sp.student_id, sp.department, sp.year_level, sp.experience_level,
              (u.auth_provider = 'local') AS has_password
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE (u.email = ? OR u.google_id = ?) AND u.deleted_at IS NULL`,
      [email, googleId]
    );
    if (existingUsers.length > 0) {
      return res.status(400).json({
        error: 'An account with this email already exists. Please sign in instead.',
        action: 'signin_required',
      });
    }

    const randomPassword = await bcrypt.hash(Math.random().toString(36), 10);

    const [result] = await pool.query(
      `INSERT INTO users
         (email, password_hash, role, full_name, google_id, auth_provider,
          account_status, requested_role)
       VALUES (?, ?, ?, ?, ?, 'google', 'active', ?)`,
      [email, randomPassword, 'student', name, googleId, 'student']
    );

    const userId = result.insertId;

    // Write student-specific fields to student_profiles, not users
    await pool.query(
      `INSERT INTO student_profiles (user_id, experience_level)
       VALUES (?, 'beginner')
       ON DUPLICATE KEY UPDATE experience_level = VALUES(experience_level)`,
      [userId]
    );

    const [rows] = await pool.query(
      `SELECT u.*,
              sp.student_id, sp.department, sp.year_level, sp.experience_level,
              (u.auth_provider = 'local') AS has_password
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.id = ?`,
      [userId]
    );
    const user = rows[0];

    const token = signToken(user);
    res.json({
      token,
      user: buildUserPayload(user),
      isNewUser: true,
      message: 'Account created successfully',
    });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ error: 'Email already exists' });
    }
    res.status(500).json({ error: 'Google authentication failed' });
  }
});

// ─── Get current user (/me) ────────────────────────────────────────────────
router.get('/me', authMiddleware, requireLiveUser, async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT u.id, u.email, u.role, u.full_name, u.username, u.avatar_url, u.xp_points,
              u.onboarding_completed, u.tour_completed, u.bio,
              u.must_change_password, u.account_status, u.requested_role,
              sp.experience_level, sp.student_id, sp.year_level, sp.department
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
       WHERE u.id = ?`,
      [req.user.id]
    );

    if (rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const user   = rows[0];
    const extras = {};

    if (user.role === 'student') {
      const [cc] = await pool.query(
        'SELECT COUNT(*) AS count FROM course_enrollments WHERE student_id = ? AND status = "accepted"',
        [user.id]
      );
      extras.enrolled_courses = cc[0].count;
    }

    if (user.role === 'instructor') {
      const [courseCount]  = await pool.query('SELECT COUNT(*) AS count FROM courses WHERE instructor_id = ?', [user.id]);
      const [studentCount] = await pool.query(
        `SELECT COUNT(*) AS count FROM course_enrollments ce
         JOIN courses c ON ce.course_id = c.id
         WHERE c.instructor_id = ? AND ce.status = "accepted"`,
        [user.id]
      );
      extras.course_count  = courseCount[0].count;
      extras.student_count = studentCount[0].count;
    }

    if (user.must_change_password) extras.must_change_password = true;

    res.json({ user: buildUserPayload(user, extras) });
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch user', details: e.message });
  }
});

module.exports = router;
module.exports.checkPasswordPolicy = checkPasswordPolicy;