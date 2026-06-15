// file path: backend/src/utils/notifications.js

'use strict';

const pool = require('../db');
const { NOTIFICATION_TYPES } = require('./notificationTypes');

// Inserts a single notification row.
// Throws on failure so callers can decide whether to log, retry, or surface the error.
// Previously swallowed errors silently — callers had no signal on DB failure.
async function createNotification({ userId, type, title, message, link = null }) {
  // Reject unknown types before touching the DB; prevents garbage rows.
  if (!NOTIFICATION_TYPES.has(type)) {
    throw new Error(`createNotification: unknown type "${type}"`);
  }
  // Throws on DB error — no catch block. Callers must handle.
  await pool.query(
    'INSERT INTO notifications (user_id, type, title, message, link) VALUES (?, ?, ?, ?, ?)',
    [userId, type, title, message, link]
  );
}

// Inserts multiple notification rows in transactional chunks of 1000.
// Throws on failure; previously silently dropped failed chunks with no rollback.
async function createNotifications(rows) {
  if (!rows || rows.length === 0) return;

  // Validate all rows upfront before touching the DB.
  // Previously, undefined fields would bind as NULL mid-batch with no error signal.
  for (const r of rows) {
    if (!NOTIFICATION_TYPES.has(r.type)) {
      throw new Error(`createNotifications: unknown type "${r.type}"`);
    }
    if (r.userId == null || r.title == null || r.message == null) {
      throw new Error('createNotifications: row missing required field (userId, title, or message)');
    }
  }

  const BATCH = 1000;
  const conn  = await pool.getConnection();
  try {
    await conn.beginTransaction();
    for (let i = 0; i < rows.length; i += BATCH) {
      const chunk  = rows.slice(i, i + BATCH);
      const values = chunk.map(() => '(?, ?, ?, ?, ?)').join(', ');
      const params = chunk.flatMap(r => [r.userId, r.type, r.title, r.message, r.link ?? null]);
      await conn.query(
        `INSERT INTO notifications (user_id, type, title, message, link) VALUES ${values}`,
        params
      );
    }
    await conn.commit();
  } catch (e) {
    // Roll back the entire batch so no partial state is committed.
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

module.exports = { createNotification, createNotifications };
