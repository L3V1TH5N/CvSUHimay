// file path: backend/src/utils/notificationTypes.js
// Single source of truth for valid notification type strings.
// Used by createNotification / createNotifications to reject unknown types before insert.

'use strict';

const NOTIFICATION_TYPES = new Set([
  'achievement',
  'enrollment',
  'enrollment_request',
  'level_up',
  'announcement',
  'quiz',
  'student_progress',
  'new_user',
  'course_created',
  'instructor_application_submitted',
  'instructor_application_approved',
  'instructor_application_rejected',
  // [audit] Added types that were used in module.js and courses.js but absent from
  // this registry, causing createNotification to throw on every call for these events
  // (silently caught by route try/catch — surfaced as HTTP 500 to the client).
  'all_modules_completed', // module.js  — milestone notification to instructors
  'reapply_request',       // courses.js — student re-requested after rejection via code
  'enrollment_left',       // courses.js — student left an accepted enrollment
  // [fix E4] Pending enrollment request self-cancelled by student — distinct from
  // enrollment_left (which is accepted→left) so instructors see the correct message.
  'enrollment_cancelled',  // courses.js — student withdrew a pending request
  'removed_from_course',   // courses.js — instructor removed a student
  'course_archived',       // courses.js — instructor archived a course
  'course_deleted',        // courses.js — instructor deleted a course
]);

module.exports = { NOTIFICATION_TYPES };
