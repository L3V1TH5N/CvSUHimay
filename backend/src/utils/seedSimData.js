// file path: backend/src/utils/seedSimData.js
//
// Development-only seed script — populates realistic simulation analytics data
// so the instructor analytics page can be tested without real student sessions.
//
// Run from the repo root:
//   node backend/src/utils/seedSimData.js
//
// Safe to run multiple times: skips any student-course pair that already has
// completed simulation sessions.

'use strict';

// Load .env before requiring db (which reads DB_* env vars at require-time)
require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });

const pool = require('../db');

const STEP_KEYS = [
  'wash_fish', 'inspect_fish', 'trim_fins', 'split_dorsal',
  'remove_backbone', 'pull_rib_bones', 'pull_dorsal_spines',
  'pull_ventral_spines', 'pull_lateral_spines', 'final_wash', 'pack',
];

// Must match the WEIGHTS constant in simulation.js (sum = 100)
const WEIGHTS = { 1:8, 2:5, 3:0, 4:8, 5:8, 6:10, 7:18, 8:15, 9:15, 10:5, 11:8 };

const ERROR_CLASSES = ['wrong_cut_path', 'excess_flesh_damage', 'missed_bone'];

const rand    = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randF   = (min, max) => Math.random() * (max - min) + min;
const fix3    = (n) => parseFloat(n.toFixed(3));

async function seedStudent(userId, courseId, sessionCount) {
  // Get current attempt count for this user across all courses (for attempt_number)
  const [[{ base }]] = await pool.query(
    'SELECT COUNT(*) AS base FROM sim_attempts WHERE user_id = ?',
    [userId]
  );
  let nextAttemptNumber = Number(base) + 1;

  for (let s = 0; s < sessionCount; s++) {
    // 1. Insert base attempt record (required FK for sim_attempts)
    const [ares] = await pool.query(
      'INSERT INTO attempts (user_id, course_id, score, hints_used, completed) VALUES (?, ?, ?, ?, 1)',
      [userId, courseId, rand(55, 95), rand(0, 5)]
    );
    const attemptId = ares.insertId;

    // 2. Compute per-step scores
    // Later sessions are slightly better (simulates learning effect)
    const improvementFactor = 1 + s * 0.08;
    const steps = STEP_KEYS.map((key, i) => {
      const stepId    = i + 1;
      const accuracy  = fix3(Math.min(randF(0.50, 0.95) * improvementFactor, 0.99));
      const errors    = Math.max(rand(0, 4) - s, 0);
      const timeSecs  = rand(12, 130);
      const weight    = WEIGHTS[stepId] ?? 0;
      const earned    = fix3(weight * accuracy * randF(0.65, 1.0));
      return { stepId, key, weight, earned, accuracy, errors, timeSecs };
    });

    const rawScore     = steps.reduce((sum, st) => sum + st.earned, 0);
    const scorePercent = Math.min(Math.round(rawScore), 100);
    const passed       = scorePercent >= 60 ? 1 : 0;
    const grade        = scorePercent >= 90 ? 'A' : scorePercent >= 75 ? 'B' : scorePercent >= 60 ? 'C' : 'F';
    const totalErrors  = steps.reduce((sum, st) => sum + st.errors, 0);
    const hintsUsed    = Math.max(rand(0, 5) - s, 0);
    const duration     = rand(300, 900);

    // 3. Insert sim_attempt
    const [saRes] = await pool.query(
      `INSERT INTO sim_attempts
         (attempt_id, user_id, course_id, attempt_number, raw_score, score_percent,
          grade, passed, completed, duration_seconds, total_errors, hints_used,
          steps_completed, wash_quality_percent, bones_total, scoring_version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, 11, ?, ?, 'v2')`,
      [
        attemptId, userId, courseId, nextAttemptNumber,
        parseFloat(rawScore.toFixed(2)), scorePercent, grade, passed,
        duration, totalErrors, hintsUsed,
        rand(65, 100),
        rand(110, 177),
      ]
    );
    const simAttemptId = saRes.insertId;
    nextAttemptNumber++;

    // 4. Insert per-step results
    for (const st of steps) {
      await pool.query(
        `INSERT INTO sim_step_results
           (sim_attempt_id, step_id, step_key, score_weight, earned_score,
            accuracy_factor, efficiency_factor, quality_factor,
            error_count, correct_actions, time_spent_seconds, completed, hint_level)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [
          simAttemptId, st.stepId, st.key, st.weight, st.earned,
          st.accuracy, fix3(randF(0.55, 1.0)), fix3(randF(0.60, 1.0)),
          st.errors, rand(1, 6), st.timeSecs,
          rand(0, 2),
        ]
      );
    }

    // 5. Insert error log entries (2–6 per session)
    const errCount = rand(2, 6);
    for (let e = 0; e < errCount; e++) {
      const cls      = ERROR_CLASSES[rand(0, 2)];
      const severity = cls === 'missed_bone' ? 'critical' : cls === 'wrong_cut_path' ? 'major' : 'minor';
      await pool.query(
        `INSERT INTO sim_error_log
           (sim_attempt_id, step_id, error_class, severity, client_timestamp)
         VALUES (?, ?, ?, ?, ?)`,
        [simAttemptId, rand(1, 11), cls, severity, Date.now() - rand(0, duration * 800)]
      );
    }

    // 6. Insert bone counts
    await pool.query(
      `INSERT INTO sim_bone_counts
         (sim_attempt_id, dorsal, ventral, lateral)
       VALUES (?, ?, ?, ?)`,
      [simAttemptId, rand(55, 87), rand(30, 48), rand(28, 42)]
    );

    console.log(
      `    session #${nextAttemptNumber - 1} — score ${scorePercent}% (${grade}), errors ${totalErrors}, hints ${hintsUsed}`
    );
  }
}

async function main() {
  console.log('Fetching accepted student-course enrollments…\n');

  const [enrollments] = await pool.query(
    `SELECT ce.student_id AS user_id, ce.course_id, c.name AS course_name, u.full_name
     FROM course_enrollments ce
     JOIN courses c  ON ce.course_id  = c.id
     JOIN users   u  ON ce.student_id = u.id
     WHERE ce.status = 'accepted'
     ORDER BY ce.student_id, ce.course_id`
  );

  if (!enrollments.length) {
    console.log('No accepted enrollments found. Enroll students in courses first.');
    await pool.end();
    return;
  }

  console.log(`Found ${enrollments.length} accepted enrollment(s).\n`);
  let seededSessions = 0;
  let skipped        = 0;

  for (const { user_id, course_id, course_name, full_name } of enrollments) {
    // Check if this student already has completed sessions for this course
    const [[{ cnt }]] = await pool.query(
      'SELECT COUNT(*) AS cnt FROM sim_attempts WHERE user_id = ? AND course_id = ? AND completed = 1',
      [user_id, course_id]
    );
    if (Number(cnt) > 0) {
      console.log(`  [skip] ${full_name} / ${course_name} — already has ${cnt} session(s)`);
      skipped++;
      continue;
    }

    // Seed 2–3 sessions per student-course pair
    const sessionCount = rand(2, 3);
    console.log(`  [seed] ${full_name} / ${course_name} — ${sessionCount} sessions`);
    await seedStudent(user_id, course_id, sessionCount);
    seededSessions += sessionCount;
  }

  console.log(`\nDone. Seeded ${seededSessions} session(s). Skipped ${skipped} already-populated pair(s).`);
  await pool.end();
}

main().catch(err => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
