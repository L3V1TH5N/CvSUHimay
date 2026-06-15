// file path: backend/src/middleware/requireLiveUser.js
//
// Applied after authMiddleware on protected routes (currently: profile router).
// Performs a single DB lookup per user per 60 s (TTL cache) to confirm:
//   1. Account row still exists and is not soft-deleted.
//   2. Account is not locked (failed-login lockout).
//   3. JWT token_version matches stored version (invalidates sessions after password change).
//   4. must_change_password gate: blocks all routes except PUT /password.
//
// The 60 s cache is intentionally short so admin soft-delete or password-change
// takes effect within a minute without hammering the DB on every request.

'use strict';

const pool = require('../db');

// Simple in-process TTL cache.
// At thesis scale a Map is fine; swap for Redis if multi-instance is ever deployed.
const cache = new Map(); // userId → { row, exp }
const TTL   = 60_000;   // 60 seconds

function invalidateCache(userId) {
  cache.delete(userId);
}

async function requireLiveUser(req, res, next) {
  const id = req.user?.id;
  if (!id) return res.status(401).json({ error: 'Unauthenticated' });

  let row;

  // Check cache first
  const cached = cache.get(id);
  if (cached && cached.exp > Date.now()) {
    row = cached.row;
  } else {
    // Single indexed SELECT — pulls everything needed in one round-trip
    const [[freshRow]] = await pool.query(
      `SELECT id, token_version, must_change_password,
              lock_until, deleted_at
       FROM users WHERE id = ?`,
      [id]
    );

    if (!freshRow) {
      return res.status(401).json({ error: 'Account no longer exists' });
    }

    cache.set(id, { row: freshRow, exp: Date.now() + TTL });
    row = freshRow;
  }

  // 1. Soft-delete check (§4.3 / §3.19)
  if (row.deleted_at) {
    return res.status(401).json({ error: 'Account has been deleted' });
  }

  // 2. Login-lockout check
  if (row.lock_until && new Date(row.lock_until) > new Date()) {
    return res.status(423).json({ error: 'Account temporarily locked. Try again later.' });
  }

  // 3. Token version check (§3.15 — Decision D5)
  // Grace period: tokens issued before this feature have no token_version claim
  // (decoded.token_version === undefined). Treat undefined as 0 until 2026-08-01
  // to avoid force-logging out all existing sessions on deploy.
  // TODO: remove grace period after 2026-08-01 and enforce strict equality.
  const claimedVersion = req.user.token_version ?? 0;
  if (claimedVersion < (row.token_version ?? 0)) {
    return res.status(401).json({ error: 'token_invalidated' });
  }

  // 4. must_change_password gate (§3.23)
  // Allow PUT /password (change flow) and GET /me (identity fetch) through.
  // Blocking /me causes the frontend to lose user context on reload, which
  // redirects the user to sign-in rather than to the password-change prompt.
  if (row.must_change_password) {
    const isPasswordRoute = req.method === 'PUT' && req.path === '/password';
    const isMeRoute       = req.method === 'GET'  && req.path === '/me';
    if (!isPasswordRoute && !isMeRoute) {
      return res.status(403).json({ error: 'password_change_required' });
    }
  }

  // Expose the row to downstream handlers (avoids re-fetching in the handler)
  req.userRow = row;
  next();
}

// Exposed so handlers that change account state can bust the cache immediately.
requireLiveUser.invalidateCache = invalidateCache;

module.exports = requireLiveUser;