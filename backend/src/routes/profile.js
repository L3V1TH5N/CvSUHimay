// file path: backend/src/routes/profile.js
//
// All student/instructor profile endpoints.
// Applied fixes (PROMPTv14):
//   Phase 3  — PUT /         : Zod validation, role-aware schema, structured 400, returns updated row
//   Phase 4  — GET /         : removes google_id/auth_provider leak, adds has_password, single query
//   Phase 5  — POST /avatar  : magic-byte verification, atomic (DB first then unlink), rate-limited,
//                              path-traversal guard, lowercase extension, DELETE /avatar added
//   Phase 6  — PUT /password : uses exported checkPasswordPolicy, token_version bump,
//                              security notification, rate-limited, reuse check
//   Phase 7  — PUT /badges   : uses VALID_ACHIEVEMENT_IDS from profileSchemas (fixes IDs 23–27)
//   Phase 8  — multer error handler moved to end and narrowed; requireLiveUser applied globally
//   Phase 9  — PUT /tour-complete, PUT /email, DELETE / (soft-delete), PATCH alias (D3a)
//
// CHANGES (audit fixes):
// - Fix 1:  total_attempts stat adds AND completed = TRUE — matches achievementUtils filter,
//           prevents inflated count from abandoned simulation runs
// - Fix 2:  requireLiveUser.invalidateCache() called immediately after PUT /password,
//           PUT /email, and DELETE / so the 60s TTL cache does not delay enforcement
// - Fix 5:  username uniqueness check adds AND deleted_at IS NULL so soft-deleted
//           usernames do not permanently block future registrations; UPDATE also wrapped
//           in try/catch to convert 1062 TOCTOU races into 409 responses
// - Fix 6:  GET /public/:userId adds AND deleted_at IS NULL AND account_status = 'active'
//           so deleted/suspended students are not publicly visible
// - Fix 7:  emailLimiter (3/15 min) applied to PUT /email; deleteLimiter (5/hr) to DELETE /
// - Fix 8:  student_id uniqueness pre-check added for student role (mirrors username check);
//           1062 catch in UPDATE covers the race window
// - Fix 11: checkPasswordPolicy imported from utils/password instead of routes/auth
//           to break route→route coupling

'use strict';

const express        = require('express');
const multer         = require('multer');
const path           = require('path');
const fs             = require('fs');
const fsp            = require('fs').promises;
const bcrypt         = require('bcryptjs');
const rateLimit      = require('express-rate-limit');
const router         = express.Router();

const pool               = require('../db');
const authMiddleware     = require('../middleware/auth');
const requireLiveUser    = require('../middleware/requireLiveUser');
const { createNotification } = require('../utils/notifications');
// Fix 11: import from utility module — avoids route→route coupling
const { checkPasswordPolicy } = require('../utils/password');
const { TOTAL_MODULES } = require('../utils/gamification');
const { z } = require('zod');
const { ACHIEVEMENT_DEFS } = require('../utils/achievementUtils');

// ── Profile validation schemas ─────────────────────────────────────────────

const USERNAME_RE   = /^[a-zA-Z0-9_]{3,20}$/;
const STUDENT_ID_RE = /^\d{9}$/;

const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'system', 'support', 'staff',
  'mod', 'moderator', 'api', 'null', 'undefined',
  'cvsu', 'cvsuhimay', 'boneup',
  'instructor', 'student',
]);

const VALID_ACHIEVEMENT_IDS = new Set(ACHIEVEMENT_DEFS.map(a => a.id));
const EXPERIENCE_LEVELS = ['beginner', 'some', 'intermediate', 'advanced'];

const usernameSchema = z
  .string()
  .trim()
  .regex(USERNAME_RE, 'Username must be 3–20 characters: letters, numbers, and underscores only.')
  .refine(v => !RESERVED_USERNAMES.has(v.toLowerCase()), {
    message: 'That username is reserved.',
  });

const sharedFields = z.object({
  username:      usernameSchema.or(z.literal('')).optional(),
  full_name:     z.string().trim().min(1).max(120).or(z.literal('')).optional(),
  bio:           z.string().max(500).optional(),
  phone:         z.string().regex(/^[0-9+\-\s()]{7,20}$/, 'Invalid phone format').or(z.literal('')).optional(),
  date_of_birth: z
    .string()
    .date('Invalid date format')
    .refine(v => {
      const ageDays = (Date.now() - new Date(v).getTime()) / 86_400_000;
      return ageDays >= 13 * 365.25 && ageDays <= 120 * 365.25;
    }, 'Date of birth must represent an age between 13 and 120')
    .or(z.literal(''))
    .optional(),
  address: z.string().max(255).optional(),
});

const studentFields = z.object({
  experience_level: z.enum(EXPERIENCE_LEVELS).optional(),
  department:       z.string().max(100).optional(),
  year_level:       z.string().max(20).optional(),
  student_id:       z
    .string()
    .regex(STUDENT_ID_RE, 'Student ID must be 9 digits with no hyphen (e.g. 202400001)')
    .or(z.literal(''))
    .optional(),
});

const passwordSchema = z
  .string()
  .min(8, 'At least 8 characters')
  .regex(/[A-Za-z]/, 'At least one letter')
  .regex(/\d/, 'At least one digit');

const badgesSchema = z.object({
  badge_ids: z
    .array(
      z.number().int().refine(id => VALID_ACHIEVEMENT_IDS.has(id), {
        message: 'Invalid achievement ID',
      })
    )
    .max(3, 'Maximum 3 badges can be equipped'),
});

const emailChangeSchema = z.object({
  new_email:        z.string().email('Invalid email address').max(120),
  current_password: z.string().min(1, 'Current password is required'),
});

// ── Avatar storage ─────────────────────────────────────────────────────────

const AVATAR_DIR = path.resolve(__dirname, '../../uploads/avatars');
fs.mkdirSync(AVATAR_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    cb(null, `avatar_${req.user.id}_${Date.now()}${ext}`);
  },
});

const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp']);

const upload = multer({
  storage,
  limits: { fileSize: 2 * 1024 * 1024 }, // 2 MB
  fileFilter: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ALLOWED_EXTS.has(ext)) {
      cb(null, true);
    } else {
      cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Invalid file type. Allowed: JPG, PNG, WebP'));
    }
  },
});

// ── Magic-byte verification ────────────────────────────────────────
async function verifyImageMagicBytes(filePath, ext) {
  const buf = Buffer.alloc(16);
  const fh  = await fsp.open(filePath, 'r');
  try {
    await fh.read(buf, 0, 16, 0);
  } finally {
    await fh.close();
  }

  if (ext === '.jpg' || ext === '.jpeg') {
    return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  }
  if (ext === '.png') {
    return (
      buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4E && buf[3] === 0x47 &&
      buf[4] === 0x0D && buf[5] === 0x0A && buf[6] === 0x1A && buf[7] === 0x0A
    );
  }
  if (ext === '.webp') {
    return (
      buf.slice(0, 4).toString('ascii') === 'RIFF' &&
      buf.slice(8, 12).toString('ascii') === 'WEBP'
    );
  }
  return false;
}

// ── Rate limiters ──────────────────────────────────────────────────

const makeLimiter = (windowMs, max) =>
  rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders:   false,
    // All profile routes are behind authMiddleware so req.user.id is always set.
    // Keying purely on user ID avoids the express-rate-limit IPv6 validation warning
    // that fires when req.ip is used in a custom keyGenerator.
    keyGenerator:    req => String(req.user.id),
    skip:            req => !req.user?.id,
    message:         { error: 'RATE_LIMIT', message: 'Too many requests. Try again later.' },
  });

const profileLimiter  = makeLimiter(60 * 60 * 1000, 60);
const avatarLimiter   = makeLimiter(60 * 60 * 1000, 10);
const passwordLimiter = makeLimiter(15 * 60 * 1000, 5);
// Fix 7: tighter limits on security-sensitive and destructive endpoints
const emailLimiter    = makeLimiter(15 * 60 * 1000, 3);
const deleteLimiter   = makeLimiter(60 * 60 * 1000, 5);

const USER_COLUMNS = `
  u.id, u.email, u.role, u.username, u.full_name, u.bio,
  u.avatar_url, u.phone, u.date_of_birth, u.address,
  sp.student_id, sp.experience_level, sp.department, sp.year_level,
  u.equipped_badges, u.onboarding_completed, u.tour_completed,
  u.xp_points, u.current_streak, u.last_active_date,
  u.last_password_changed_at, u.created_at, u.updated_at,
  (u.auth_provider = 'local') AS has_password
`;

router.use(authMiddleware);
router.use(requireLiveUser);

// ══════════════════════════════════════════════════════════════════════════
// GET /api/profile
// ══════════════════════════════════════════════════════════════════════════
router.get('/', async (req, res) => {
  try {
    const [[user]] = await pool.query(
      `SELECT ${USER_COLUMNS}
         FROM users u
         LEFT JOIN student_profiles sp ON sp.user_id = u.id
        WHERE u.id = ?`,
      [req.user.id]
    );
    if (!user) return res.status(404).json({ error: 'User not found' });

    user.equipped_badges = parseJson(user.equipped_badges, []);

    const stats = {};
    if (user.role === 'student') {
      const [[r]] = await pool.query(
        `SELECT
           COUNT(*)      AS total_attempts,
           MAX(score)    AS best_score,
           (SELECT COUNT(*) FROM course_enrollments WHERE student_id = ? AND status = 'accepted') AS enrolled_courses,
           (SELECT COUNT(*) FROM module_progress WHERE user_id = ? AND completed_at IS NOT NULL AND module_id BETWEEN 1 AND ?) AS completed_modules,
           (SELECT COUNT(DISTINCT module_id) FROM quiz_attempts WHERE user_id = ? AND passed = TRUE) AS passed_modules
         -- Fix 1: AND completed = TRUE — counts finished simulations only, matching
         --        the achievementUtils evaluateAchievements filter
         FROM attempts WHERE user_id = ? AND completed = TRUE`,
        [req.user.id, req.user.id, TOTAL_MODULES, req.user.id, req.user.id]
      );
      Object.assign(stats, r);
    } else if (user.role === 'instructor') {
      const [[r]] = await pool.query(
        `SELECT
           (SELECT COUNT(*) FROM courses WHERE instructor_id = ?) AS course_count,
           (SELECT COUNT(*) FROM course_enrollments ce
            JOIN courses c ON ce.course_id = c.id
            WHERE c.instructor_id = ? AND ce.status = 'accepted')  AS student_count
         FROM DUAL`,
        [req.user.id, req.user.id]
      );
      Object.assign(stats, r);
    }

    res.json({ user: { ...user, ...stats } });
  } catch (err) {
    console.error('profile GET error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'PROFILE_FETCH_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/profile  (also aliased as PATCH — Decision D3a)
// Updates allowed fields for the caller's role. Returns the updated row.
// ══════════════════════════════════════════════════════════════════════════
const STUDENT_PROFILE_FIELDS = ['student_id', 'department', 'year_level', 'experience_level'];

async function handleProfileUpdate(req, res) {
  // Compose schema based on caller's role
  const roleExtra =
    req.user.role === 'student' ? studentFields :
    /* instructor, admin, etc. */ z.object({});

  const schema = sharedFields.merge(roleExtra);
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:  'VALIDATION',
      issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  const fields = parsed.data;

  const clean = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined)
  );

  if (Object.keys(clean).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  // Username: empty string → NULL, non-empty → uniqueness check
  if ('username' in clean) {
    if (clean.username === '') {
      clean.username = null;
    } else {
      const [taken] = await pool.query(
        'SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ? AND deleted_at IS NULL',
        [clean.username, req.user.id]
      );
      if (taken.length) {
        return res.status(409).json({ error: 'That username is already taken.' });
      }
    }
  }

  // Map empty strings → NULL on clearable columns
  for (const key of ['full_name','bio','phone','date_of_birth','address',
                     'student_id','department','year_level']) {
    if (clean[key] === '') clean[key] = null;
  }

  // Route fields to the correct table
  const userClean    = {};
  const profileClean = {};
  for (const [k, v] of Object.entries(clean)) {
    if (STUDENT_PROFILE_FIELDS.includes(k)) {
      profileClean[k] = v;
    } else {
      userClean[k] = v;
    }
  }

  // Fix 8: student_id uniqueness pre-check against student_profiles
  if (
    req.user.role === 'student' &&
    'student_id' in profileClean &&
    profileClean.student_id !== '' &&
    profileClean.student_id != null
  ) {
    const [takenSid] = await pool.query(
      'SELECT user_id FROM student_profiles WHERE student_id = ? AND user_id != ?',
      [profileClean.student_id, req.user.id]
    );
    if (takenSid.length) {
      return res.status(409).json({ error: 'That Student ID is already registered.' });
    }
  }

  // Write shared fields to users
  if (Object.keys(userClean).length > 0) {
    const setCols = Object.keys(userClean).map(k => `${k} = ?`).join(', ');
    const values  = [...Object.values(userClean), req.user.id];
    try {
      await pool.query(
        `UPDATE users SET ${setCols}, updated_at = NOW() WHERE id = ?`,
        values
      );
    } catch (err) {
      if (err.errno === 1062) {
        if (err.message.includes('username'))
          return res.status(409).json({ error: 'That username is already taken.' });
      }
      throw err;
    }
  }

  // Write student profile fields
  if (Object.keys(profileClean).length > 0 && req.user.role === 'student') {
    const cols       = Object.keys(profileClean);
    const vals       = Object.values(profileClean);
    const updateCols = cols.map(k => `${k} = VALUES(${k})`).join(', ');
    try {
      await pool.query(
        `INSERT INTO student_profiles (user_id, ${cols.join(', ')})
         VALUES (?, ${cols.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updateCols}`,
        [req.user.id, ...vals]
      );
    } catch (err) {
      if (err.errno === 1062 && (err.message.includes('student_id') || err.message.includes('uq_student_id')))
        return res.status(409).json({ error: 'That Student ID is already registered.' });
      throw err;
    }
  }

  const [[user]] = await pool.query(
    `SELECT ${USER_COLUMNS}
       FROM users u
       LEFT JOIN student_profiles sp ON sp.user_id = u.id
      WHERE u.id = ?`,
    [req.user.id]
  );
  user.equipped_badges = parseJson(user.equipped_badges, []);

  res.json({ message: 'Profile updated successfully', user });
}

router.put('/',   profileLimiter, handleProfileUpdate);
// Decision D3a: accept both PUT and PATCH — Settings.jsx uses PATCH
router.patch('/', profileLimiter, handleProfileUpdate);

// ══════════════════════════════════════════════════════════════════════════
// POST /api/profile/avatar
// Uploads a new avatar, verifies magic bytes, updates DB then removes old file.
// ══════════════════════════════════════════════════════════════════════════
router.post('/avatar', avatarLimiter, upload.single('avatar'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const newPath = req.file.path;

  // Magic-byte check — reject renamed non-image files
  let magicOk;
  try {
    magicOk = await verifyImageMagicBytes(newPath, ext);
  } catch {
    magicOk = false;
  }
  if (!magicOk) {
    await fsp.unlink(newPath).catch(() => {});
    return res.status(400).json({ error: 'File content does not match its declared extension.' });
  }

  const newUrl = `/uploads/avatars/${req.file.filename}`;

  try {
    // 1. Fetch old avatar path BEFORE updating DB (atomic order)
    const [[row]] = await pool.query('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);

    // 2. Update DB first — if this fails, we clean up the new file
    await pool.query(
      'UPDATE users SET avatar_url = ?, updated_at = NOW() WHERE id = ?',
      [newUrl, req.user.id]
    );

    // 3. Unlink old file AFTER DB is confirmed (never blocks success response)
    if (row?.avatar_url) {
      const oldResolved = path.resolve(AVATAR_DIR, path.basename(row.avatar_url));
      // Path-traversal guard: only unlink files inside AVATAR_DIR
      if (oldResolved.startsWith(AVATAR_DIR + path.sep) || oldResolved === AVATAR_DIR) {
        await fsp.unlink(oldResolved).catch(() => {}); // missing file is not an error
      }
    }

    res.json({ message: 'Avatar updated successfully', avatar_url: newUrl });
  } catch (err) {
    // DB failed — clean up the newly written file to avoid orphans
    await fsp.unlink(newPath).catch(() => {});
    console.error('avatar upload error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'AVATAR_UPLOAD_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/profile/avatar
// Removes the user's avatar: unlinks the file and nulls the column.
// ══════════════════════════════════════════════════════════════════════════
router.delete('/avatar', async (req, res) => {
  try {
    const [[row]] = await pool.query('SELECT avatar_url FROM users WHERE id = ?', [req.user.id]);

    await pool.query(
      'UPDATE users SET avatar_url = NULL, updated_at = NOW() WHERE id = ?',
      [req.user.id]
    );

    if (row?.avatar_url) {
      const resolved = path.resolve(AVATAR_DIR, path.basename(row.avatar_url));
      if (resolved.startsWith(AVATAR_DIR + path.sep)) {
        await fsp.unlink(resolved).catch(() => {});
      }
    }

    res.json({ message: 'Avatar removed successfully' });
  } catch (err) {
    console.error('avatar delete error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'AVATAR_DELETE_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/profile/password
// Validates policy, reuse, bumps token_version (invalidates old JWTs), notifies.
// ══════════════════════════════════════════════════════════════════════════
router.put('/password', passwordLimiter, async (req, res) => {
  const { current_password, new_password } = req.body;
  if (!current_password || !new_password) {
    return res.status(400).json({ error: 'Both current_password and new_password are required' });
  }

  const policyErrs = checkPasswordPolicy(new_password);
  if (policyErrs.length) {
    return res.status(400).json({ error: 'PASSWORD_POLICY', requirements: policyErrs });
  }

  try {
    const [[row]] = await pool.query(
      'SELECT password_hash, auth_provider FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'User not found' });

    // Google-only accounts cannot use this endpoint
    if (row.auth_provider === 'google') {
      return res.status(400).json({ error: 'Cannot change password for Google-authenticated accounts.' });
    }

    const currentOk = await bcrypt.compare(current_password, row.password_hash);
    if (!currentOk) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    // Reuse check
    const sameAsOld = await bcrypt.compare(new_password, row.password_hash);
    if (sameAsOld) {
      return res.status(400).json({ error: 'New password must differ from the current password.' });
    }

    const newHash = await bcrypt.hash(new_password, 10);

    // Bump token_version to invalidate all existing sessions
    await pool.query(
      `UPDATE users
         SET password_hash             = ?,
             token_version             = token_version + 1,
             last_password_changed_at  = NOW(),
             must_change_password      = 0,
             updated_at                = NOW()
       WHERE id = ?`,
      [newHash, req.user.id]
    );
    // Fix 2: bust the 60s requireLiveUser cache immediately so the incremented
    // token_version takes effect on the very next request, not after TTL expiry
    requireLiveUser.invalidateCache(req.user.id);

    // Security notification
    await createNotification({
      userId:  req.user.id,
      type:    'security',
      title:   'Password changed',
      message: "Your password was just changed. If this wasn't you, contact support immediately.",
      link:    '/student/dashboard/settings',
    });

    res.json({ message: 'Password changed successfully.' });
  } catch (err) {
    console.error('password change error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'PASSWORD_CHANGE_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/profile/badges
// Equips up to 3 unlocked badges. Validates against VALID_ACHIEVEMENT_IDS.
// ══════════════════════════════════════════════════════════════════════════
router.put('/badges', async (req, res) => {
  const parsed = badgesSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:  'VALIDATION',
      issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  const unique = [...new Set(parsed.data.badge_ids)];

  if (unique.length > 0) {
    const [earned] = await pool.query(
      'SELECT achievement_id FROM user_achievements WHERE user_id = ? AND achievement_id IN (?)',
      [req.user.id, unique]
    );
    if (earned.length !== unique.length) {
      return res.status(403).json({ error: 'You have not unlocked all selected badges.' });
    }
  }

  await pool.query(
    'UPDATE users SET equipped_badges = ?, updated_at = NOW() WHERE id = ?',
    [JSON.stringify(unique), req.user.id]
  );

  res.json({ message: 'Badges updated successfully', equipped_badges: unique });
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/profile/tour-complete
// Marks the dashboard tour as complete.
// ══════════════════════════════════════════════════════════════════════════
router.put('/tour-complete', async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET tour_completed = 1, updated_at = NOW() WHERE id = ?',
      [req.user.id]
    );
    res.json({ message: 'Tour marked complete' });
  } catch (err) {
    console.error('tour-complete error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'TOUR_COMPLETE_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// PUT /api/profile/email
// Requires current password, checks uniqueness, updates, notifies.
// Fix 7: emailLimiter — 3 per 15 min (security-sensitive: changes login identity)
// ══════════════════════════════════════════════════════════════════════════
router.put('/email', emailLimiter, async (req, res) => {
  const parsed = emailChangeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({
      error:  'VALIDATION',
      issues: parsed.error.issues.map(i => ({ path: i.path.join('.'), message: i.message })),
    });
  }

  const { new_email, current_password } = parsed.data;

  try {
    const [[row]] = await pool.query(
      'SELECT password_hash, auth_provider, email AS old_email FROM users WHERE id = ?',
      [req.user.id]
    );
    if (!row) return res.status(404).json({ error: 'User not found' });

    if (row.auth_provider === 'google') {
      return res.status(400).json({ error: 'Cannot change email for Google-authenticated accounts.' });
    }

    const passwordOk = await bcrypt.compare(current_password, row.password_hash);
    if (!passwordOk) {
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    if (new_email.toLowerCase() === row.old_email.toLowerCase()) {
      return res.status(400).json({ error: 'New email must differ from current email.' });
    }

    const [taken] = await pool.query(
      'SELECT id FROM users WHERE email = ? AND id != ?',
      [new_email, req.user.id]
    );
    if (taken.length) return res.status(409).json({ error: 'That email is already in use.' });

    await pool.query(
      'UPDATE users SET email = ?, updated_at = NOW() WHERE id = ?',
      [new_email, req.user.id]
    );
    // Fix 2: invalidate cache so requireLiveUser fetches fresh row (new email) on next request
    requireLiveUser.invalidateCache(req.user.id);

    // Security notifications (fire-and-forget)
    createNotification({
      userId:  req.user.id,
      type:    'security',
      title:   'Email address changed',
      message: `Your account email was changed to ${new_email}.`,
      link:    '/student/dashboard/settings',
    });

    res.json({ message: 'Email updated successfully', email: new_email });
  } catch (err) {
    console.error('email change error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'EMAIL_CHANGE_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// DELETE /api/profile  (soft delete)
// Sets deleted_at = NOW(). requireLiveUser middleware rejects future requests.
// FSM event-stream rows are preserved (thesis data integrity).
// Fix 7: deleteLimiter — 5 per hour
// ══════════════════════════════════════════════════════════════════════════
router.delete('/', deleteLimiter, async (req, res) => {
  try {
    await pool.query(
      'UPDATE users SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
      [req.user.id]
    );
    // Fix 2: evict from cache immediately — requireLiveUser must block the very next request,
    // not allow up to 60s of continued access after deletion
    requireLiveUser.invalidateCache(req.user.id);

    res.json({ message: 'Account deleted successfully.' });
  } catch (err) {
    console.error('account delete error', { userId: req.user.id, err: err.message });
    res.status(500).json({ error: 'ACCOUNT_DELETE_FAILED' });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/profile/public/by-username/:username
// [leaderboard fix 4] Leaderboard entries now expose username instead of user_id.
// This route supports PublicProfileModal when opened from the leaderboard page.
// Response shape is identical to GET /public/:userId.
// Must be registered BEFORE /public/:userId to avoid the parameterized route
// consuming the literal segment "by-username" (though path depth differs,
// explicit ordering is clearer intent).
// ══════════════════════════════════════════════════════════════════════════
router.get('/public/by-username/:username', async (req, res) => {
  const { username } = req.params;
  if (!username?.trim()) {
    return res.status(400).json({ error: 'Username is required' });
  }

  try {
    const [[user]] = await pool.query(
      `SELECT id, username, full_name, avatar_url, xp_points, equipped_badges, created_at, current_streak
         FROM users
        WHERE username = ? AND role = 'student'
          AND deleted_at IS NULL AND account_status = 'active'`,
      [username.trim()]
    );
    if (!user) return res.status(404).json({ error: 'Profile not found' });

    const [[quizAgg]] = await pool.query(
      `SELECT COUNT(*) AS total_attempts,
              ROUND(AVG((score / NULLIF(total_questions, 0)) * 100)) AS avg_percentage,
              SUM(CASE WHEN passed = TRUE THEN 1 ELSE 0 END) AS passes
         FROM quiz_attempts WHERE user_id = ?`,
      [user.id]
    );

    const [[achAgg]] = await pool.query(
      `SELECT COUNT(*) AS unlocked FROM user_achievements WHERE user_id = ?`,
      [user.id]
    );

    const [achievementRows] = await pool.query(
      `SELECT achievement_id, unlocked_at FROM user_achievements
        WHERE user_id = ? ORDER BY unlocked_at DESC LIMIT 12`,
      [user.id]
    );

    const badges = (() => {
      try { return JSON.parse(user.equipped_badges || '[]'); } catch { return []; }
    })();

    res.json({
      profile: {
        id:              user.id,
        username:        user.username,
        full_name:       user.full_name,
        avatar_url:      user.avatar_url,
        xp_points:       user.xp_points ?? 0,
        equipped_badges: Array.isArray(badges) ? badges : [],
        joined_at:       user.created_at,
        stats: {
          total_quiz_attempts:   quizAgg?.total_attempts ?? 0,
          quiz_avg_percentage:   quizAgg?.avg_percentage ?? null,
          quiz_passes:           quizAgg?.passes ?? 0,
          achievements_unlocked: achAgg?.unlocked ?? 0,
          streak:                user.current_streak ?? 0,
        },
        recent_achievements: achievementRows,
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load profile', details: e.message });
  }
});

// ══════════════════════════════════════════════════════════════════════════
// GET /api/profile/public/:userId
// Returns leaderboard-visible data. No authentication required.
// Fix 6: excludes soft-deleted and non-active accounts
// ══════════════════════════════════════════════════════════════════════════
router.get('/public/:userId', async (req, res) => {
  try {
    const [[user]] = await pool.query(
      // Fix 6: AND deleted_at IS NULL AND account_status = 'active' — suspended/deleted
      //        students must not appear on public profiles or leaderboard pages
      `SELECT id, username, full_name, avatar_url, xp_points, equipped_badges, created_at, current_streak
         FROM users
        WHERE id = ? AND role = 'student'
          AND deleted_at IS NULL AND account_status = 'active'`,
      [req.params.userId]
    );
    if (!user) return res.status(404).json({ error: 'Profile not found' });

    const [[quizAgg]] = await pool.query(
      `SELECT COUNT(*) AS total_attempts,
              ROUND(AVG((score / NULLIF(total_questions, 0)) * 100)) AS avg_percentage,
              SUM(CASE WHEN passed = TRUE THEN 1 ELSE 0 END) AS passes
         FROM quiz_attempts WHERE user_id = ?`,
      [req.params.userId]
    );

    const [[achAgg]] = await pool.query(
      `SELECT COUNT(*) AS unlocked FROM user_achievements WHERE user_id = ?`,
      [req.params.userId]
    );

    const [achievementRows] = await pool.query(
      `SELECT achievement_id, unlocked_at FROM user_achievements
        WHERE user_id = ? ORDER BY unlocked_at DESC LIMIT 12`,
      [req.params.userId]
    );

    const badges = (() => {
      try { return JSON.parse(user.equipped_badges || '[]'); } catch { return []; }
    })();

    res.json({
      profile: {
        id:              user.id,
        username:        user.username,
        full_name:       user.full_name,
        avatar_url:      user.avatar_url,
        xp_points:       user.xp_points ?? 0,
        equipped_badges: Array.isArray(badges) ? badges : [],
        joined_at:       user.created_at,
        stats: {
          total_quiz_attempts:   quizAgg?.total_attempts ?? 0,
          quiz_avg_percentage:   quizAgg?.avg_percentage ?? null,
          quiz_passes:           quizAgg?.passes ?? 0,
          achievements_unlocked: achAgg?.unlocked ?? 0,
          streak:                user.current_streak ?? 0,
        },
        recent_achievements: achievementRows,
      }
    });
  } catch (e) {
    res.status(500).json({ error: 'Failed to load profile', details: e.message });
  }
});

// ── Multer error handler — MUST be last, narrowed to multer errors ─────────
// eslint-disable-next-line no-unused-vars
router.use((err, _req, res, next) => {
  if (err instanceof multer.MulterError || err?.field) {
    const msg =
      err.code === 'LIMIT_FILE_SIZE'    ? 'File too large. Maximum size is 2 MB.' :
      err.message                       ? err.message :
      /* default */                       'File upload error.';
    return res.status(400).json({ error: msg });
  }
  // Not a multer error — pass to Express's default error handler
  next(err);
});

// ── Utility: safely parse JSON strings/objects ─────────────────────────────
function parseJson(raw, fallback) {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw !== 'string') return raw; // already parsed by mysql2
  try { return JSON.parse(raw); } catch { return fallback; }
}

module.exports = router;
