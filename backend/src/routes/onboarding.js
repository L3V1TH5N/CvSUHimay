// file path: backend/src/routes/onboarding.js

const express        = require('express');
const pool           = require('../db');
const authMiddleware = require('../middleware/auth');
const router         = express.Router();

const USERNAME_RE  = /^[a-zA-Z0-9_]{3,20}$/;
const STUDENT_ID_RE = /^\d{4}-\d{4,5}$/;

// Fields that earn +5 XP each when non-empty (on top of 20 XP base).
// Max total = 20 + 5×5 = 45 XP — deliberately below the Level-2 threshold (50)
// so "Novice" remains a real earned rank and not a zero-second cosmetic.
const BONUS_FIELDS = ['full_name', 'student_id', 'department', 'year_level', 'experience_level'];

// POST /api/onboarding/complete
// Saves profile, marks onboarding done, awards proportional XP, unlocks achievement 22.
router.post('/complete', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students can complete onboarding' });
  }

  // Guard: prevent re-completion and XP farming.
  const [[current]] = await pool.query(
    'SELECT onboarding_completed FROM users WHERE id = ?',
    [req.user.id]
  );
  if (!current) return res.status(404).json({ error: 'User not found' });
  if (current.onboarding_completed) {
    // Structured 409 so the frontend can branch without lying to the user.
    return res.status(409).json({
      error:             'Onboarding already completed',
      already_completed: true,
      xp_earned:         0,
    });
  }

  const {
    full_name, username, student_id,
    department, year_level, experience_level, bio,
  } = req.body;

  // Validate student_id format when provided.
  if (student_id && !STUDENT_ID_RE.test(student_id)) {
    return res.status(400).json({
      error: 'Student ID must match the format YYYY-NNNNN (e.g. 2024-00001).',
    });
  }

  // Compute proportional XP: 20 base + 5 per filled bonus field.
  const filledBonus = BONUS_FIELDS.filter(f => req.body[f] && String(req.body[f]).trim() !== '').length;
  const xp_earned   = 20 + filledBonus * 5; // 20–45 XP

  const updates = [
    'onboarding_completed = TRUE',
    `xp_points = COALESCE(xp_points, 0) + ${xp_earned}`,
  ];
  const values = [];
  const profileUpdates = {}; // fields that go to student_profiles

  const set        = (col, val) => { updates.push(`${col} = ?`); values.push(val); };
  const setProfile = (col, val) => { profileUpdates[col] = val; };

  if (full_name)         set('full_name',        full_name);
  if (bio !== undefined) set('bio',              bio);
  if (student_id)        setProfile('student_id',       student_id);
  if (department)        setProfile('department',       department);
  if (year_level)        setProfile('year_level',       year_level);

  if (experience_level && ['beginner','some','intermediate','advanced'].includes(experience_level)) {
    setProfile('experience_level', experience_level);
  }

  if (username !== undefined) {
    const trimmed = username.trim();
    if (trimmed === '') {
      set('username', null);
    } else {
      if (!USERNAME_RE.test(trimmed)) {
        return res.status(400).json({
          error: 'Username must be 3–20 characters: letters, numbers, and underscores only.',
        });
      }
      const [taken] = await pool.query(
        'SELECT id FROM users WHERE username = ? AND id != ?',
        [trimmed, req.user.id]
      );
      if (taken.length) {
        return res.status(409).json({ error: 'That username is already taken.' });
      }
      set('username', trimmed);
    }
  }

  // Wrap both writes in a transaction so a DB hiccup cannot leave the user
  // with onboarding_completed=TRUE but no achievement row (or vice versa).
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();

    values.push(req.user.id);
    await conn.query(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      values
    );

    if (Object.keys(profileUpdates).length > 0 && req.user.role === 'student') {
      const cols       = Object.keys(profileUpdates);
      const vals       = Object.values(profileUpdates);
      const updateCols = cols.map(k => `${k} = VALUES(${k})`).join(', ');
      await conn.query(
        `INSERT INTO student_profiles (user_id, ${cols.join(', ')})
         VALUES (?, ${cols.map(() => '?').join(', ')})
         ON DUPLICATE KEY UPDATE ${updateCols}`,
        [req.user.id, ...vals]
      );
    }

    await conn.commit();

    res.json({
      message:        'Onboarding complete',
      xp_earned,
    });
  } catch (err) {
    await conn.rollback();
    if (err.errno === 1062 && (err.message.includes('student_id') || err.message.includes('uq_student_id'))) {
      return res.status(409).json({ error: 'That Student ID is already registered.' });
    }
    console.error('Onboarding error:', err);
    res.status(500).json({ error: 'Failed to complete onboarding', details: err.message });
  } finally {
    conn.release();
  }
});

// POST /api/onboarding/tour-complete
// Flips tour_completed = TRUE. Separate from onboarding/complete so that a student
// who closes the tab mid-tour can resume the tour on next login without re-awarding XP.
router.post('/tour-complete', authMiddleware, async (req, res) => {
  if (req.user.role !== 'student') {
    return res.status(403).json({ error: 'Only students have a tour to complete' });
  }

  try {
    await pool.query(
      'UPDATE users SET tour_completed = TRUE WHERE id = ?',
      [req.user.id]
    );
    res.json({ message: 'Tour marked complete' });
  } catch (err) {
    console.error('tour-complete error:', err);
    res.status(500).json({ error: 'Failed to mark tour complete', details: err.message });
  }
});

module.exports = router;