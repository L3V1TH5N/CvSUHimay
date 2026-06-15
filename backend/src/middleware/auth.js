// file path: backend/src/middleware/auth.js
//
// PROMPTv14 change: token_version added to the DB lookup so password changes
// immediately invalidate all prior JWTs without a second query.
// Grace period: tokens without a token_version claim treat it as 0 until
// 2026-08-01 (see TODO below).

const jwt  = require('jsonwebtoken');
const pool = require('../db');

// Verifies JWT and attaches account_status + token_version from DB so neither
// can be spoofed from a stale/crafted token.
// Does NOT block on account_status — that is requireActiveAccount's job.
// Does NOT block on token_version mismatch here intentionally:
// requireLiveUser (applied on specific routers) owns the full live-user gate.
// This middleware only attaches the DB-fresh version to req.user.
async function authMiddleware(req, res, next) {
  const token = req.headers['authorization']?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token provided' });

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch {
    return res.status(403).json({ error: 'Invalid token' });
  }

  try {
    const [[row]] = await pool.query(
      'SELECT account_status, token_version FROM users WHERE id = ?',
      [decoded.id]
    );
    if (!row) return res.status(401).json({ error: 'Account no longer exists' });

    req.user = {
      ...decoded,
      account_status: row.account_status,
      // Store the DB value; requireLiveUser will compare this against the
      // token-carried claim for routes that need the full live-user gate.
      _db_token_version: row.token_version,
    };
    next();
  } catch (e) {
    return res.status(500).json({ error: 'Auth check failed' });
  }
}

// Applied on top of authMiddleware for every protected route.
// Whitelisted routes (e.g. /api/auth/me, /api/instructor-applications/my-status)
// use only authMiddleware so pending users can still reach them.
function requireActiveAccount(req, res, next) {
  if (req.user.account_status !== 'active') {
    return res.status(403).json({
      error: 'Account not active',
      account_status: req.user.account_status,
    });
  }
  next();
}

module.exports = authMiddleware;
module.exports.requireActiveAccount = requireActiveAccount;