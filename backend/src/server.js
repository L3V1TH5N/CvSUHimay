// file path: backend/src/server.js
//
// CHANGES:
// - [audit fix] Added pool import and setInterval for quiz_sessions cleanup.
//   Previously the DELETE of expired sessions fired fire-and-forget on every
//   GET /api/quiz/modules/:id/questions request, causing concurrent DELETE queries
//   on the expires_at index under load. Moving to a 5-minute server-level interval
//   amortizes the cost and eliminates the write contention on the hot path.

require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const path      = require('path');
const rateLimit = require('express-rate-limit');
const { initializeAdmin, ensureTables } = require('./utils/initDB');
// [audit fix] Pool imported here to run the scheduled quiz_sessions cleanup.
const pool = require('./db');

const authRoutes                   = require('./routes/auth');
const usersRoutes                  = require('./routes/users');
const instructorRoutes             = require('./routes/instructor');
const { studentRouter: studentRoutes, attemptsRouter: attemptsRoutes, rulesRouter: rulesRoutes } = require('./routes/student');
const coursesRoutes                = require('./routes/courses');
const moduleRoutes                 = require('./routes/module'); // [fix #13] renamed from learning
const quizRoutes                   = require('./routes/quiz');
const profileRoutes                = require('./routes/profile');
const achievementsRoutes           = require('./routes/achievements');
const onboardingRoutes             = require('./routes/onboarding');
const leaderboardRoutes            = require('./routes/leaderboard');
const notificationRoutes           = require('./routes/notifications');
const sessionsRoutes               = require('./routes/sessions');
const settingsRoutes               = require('./routes/settings');
const accountRoutes                = require('./routes/account');

const app = express();

// credentials: true is only meaningful with cookie-based auth.
// Remove it until refresh-token cookies are implemented (Tier 2).
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000'],
}));

app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.get('/api/health', (_req, res) => res.json({ ok: true }));

// ─── Rate limiters ────────────────────────────────────────────────────────
// Login: 10 attempts per 15 min window; failed requests count, successful don't.
const loginLimiter = rateLimit({
  windowMs:              15 * 60 * 1000,
  max:                   10,
  skipSuccessfulRequests: true,
  message:               { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders:       true,
  legacyHeaders:         false,
});

// Register / Google sign-up: 5 accounts per hour per IP.
const registerLimiter = rateLimit({
  windowMs:        60 * 60 * 1000,
  max:             5,
  message:         { error: 'Too many registrations from this IP. Please try again later.' },
  standardHeaders: true,
  legacyHeaders:   false,
});

// Google sign-in shares the login limit.
app.use('/api/auth/login',        loginLimiter);
app.use('/api/auth/google-signin', loginLimiter);
app.use('/api/auth/register',     registerLimiter);
app.use('/api/auth/google-signup', registerLimiter);

// ─── Routes ───────────────────────────────────────────────────────────────
app.use('/api/auth',                    authRoutes);
app.use('/api/rules',                   rulesRoutes);
app.use('/api/attempts',                attemptsRoutes);
app.use('/api/users',                   usersRoutes);
app.use('/api/instructor',              instructorRoutes);
app.use('/api/student',                 studentRoutes);
app.use('/api/courses',                 coursesRoutes);
app.use('/api/module',                  moduleRoutes);
app.use('/api/quiz',                    quizRoutes);
app.use('/api/profile',                 profileRoutes);
app.use('/api/achievements',            achievementsRoutes);
app.use('/api/onboarding',              onboardingRoutes);
app.use('/api/leaderboard',             leaderboardRoutes);
app.use('/api/notifications',           notificationRoutes);
app.use('/api/sessions',               sessionsRoutes);
app.use('/api/settings',               settingsRoutes);
app.use('/api/account',                accountRoutes);
app.use('/api/sim',                    require('./routes/simulation'));
app.use('/api/admin',                  require('./routes/admin'));


const port = process.env.PORT || 4000;

async function start() {
  await ensureTables();
  await initializeAdmin();
  app.listen(port, () => console.log(`API running at http://localhost:${port}`));

  // [audit fix] Scheduled quiz_sessions cleanup — runs every 5 minutes.
  // Moved from a fire-and-forget DELETE on every GET /questions request to here,
  // eliminating concurrent write contention on the quiz_sessions.expires_at index
  // when many users fetch questions simultaneously.
  setInterval(() => {
    pool.query('DELETE FROM quiz_sessions WHERE expires_at < NOW()').catch(err =>
      console.error('quiz_sessions cleanup error', { err: err?.message })
    );
  }, 5 * 60 * 1000);
}

start();
