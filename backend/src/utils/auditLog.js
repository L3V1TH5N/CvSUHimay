// file path: backend/src/utils/auditLog.js

const pool = require('../db');

// Records a course-scoped audit event.
// Fire-and-forget: errors are logged, never thrown, so a log failure never
// breaks the parent request.
//
// Valid action values (enforced here, not in the DB):
//   course_created, course_updated, course_archived, course_unarchived,
//   course_deleted, code_regenerated,
//   student_joined, student_requested, student_reapplied, student_left,
//   student_accepted, student_rejected, student_removed,
//   announcement_posted, announcement_updated, announcement_deleted
async function auditLog({
  courseId     = null,
  actorId,
  actorRole,
  action,
  targetUserId = null,
  metadata     = null,
}) {
  try {
    await pool.query(
      `INSERT INTO course_audit_log
         (course_id, actor_id, actor_role, action, target_user_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        courseId,
        actorId,
        actorRole,
        action,
        targetUserId,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (e) {
    console.error('auditLog failed:', e.message);
  }
}

// [fix U1] Batch-inserts multiple audit events in a single INSERT statement.
// Use this instead of calling auditLog() in a loop — N individual inserts
// hammers the DB connection pool unnecessarily. Fire-and-forget like auditLog().
// Note: for bulk transactional operations (bulk-accept/reject) use the inline
// conn.query() pattern inside the transaction instead, so audit rows are atomic
// with the enrollment state change.
async function auditLogBatch(entries) {
  if (!entries || entries.length === 0) return;
  try {
    const values = entries.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
    const params = entries.flatMap(e => [
      e.courseId     ?? null,
      e.actorId,
      e.actorRole,
      e.action,
      e.targetUserId ?? null,
      e.metadata     ? JSON.stringify(e.metadata) : null,
    ]);
    await pool.query(
      `INSERT INTO course_audit_log
         (course_id, actor_id, actor_role, action, target_user_id, metadata)
       VALUES ${values}`,
      params
    );
  } catch (e) {
    console.error('auditLogBatch failed:', e.message);
  }
}

module.exports = { auditLog, auditLogBatch };
