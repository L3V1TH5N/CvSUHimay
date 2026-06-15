-- File Path: backend/db.sql
-- PROMPTv13 update: added quiz_attempt_answers, quiz_sessions, quiz_questions;
-- altered quiz_attempts with audit columns; altered module_progress with completed_at.

-- new updates
-- CHANGES:
-- - Added unique key uq_notif_dedup on notifications(user_id, type, link)
--   to support idempotent milestone notification inserts and prevent
--   duplicate student_progress notifications for instructors.
--   This index allows multiple NULL links (as MySQL treats NULLs as distinct),
--   which is intentional — most notification types do not require deduplication.
-- - No other schema changes.
-- ... (rest of file unchanged up to notifications table definition) ...



CREATE DATABASE IF NOT EXISTS cvsuhimay_db;
USE cvsuhimay_db;

-- ==================== USERS (FULLY MERGED) ====================

CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,

  -- Authentication
  email VARCHAR(120) UNIQUE NOT NULL,
  google_id VARCHAR(255) UNIQUE NULL,
  password_hash VARCHAR(255) NOT NULL,
  auth_provider ENUM('local','google') DEFAULT 'local',
  role ENUM('student','instructor','admin') DEFAULT 'student',

  -- Basic Profile
  username VARCHAR(50) UNIQUE NULL,
  full_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(255),
  phone VARCHAR(20),
  date_of_birth DATE,
  address TEXT,

  -- Gamification
  xp_points INT DEFAULT 0,
  equipped_badges JSON DEFAULT NULL,
  current_streak INT DEFAULT 0,
  last_active_date DATE DEFAULT NULL,

  -- Onboarding / Security
  onboarding_completed BOOLEAN DEFAULT FALSE,
  tour_completed TINYINT(1) NOT NULL DEFAULT 0,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  lock_until TIMESTAMP NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP NULL,
  -- PROMPTv14: token invalidation on password change
  token_version INT UNSIGNED NOT NULL DEFAULT 0,
  -- PROMPTv14: audit when password was last changed
  last_password_changed_at TIMESTAMP NULL,
  -- PROMPTv14: soft delete — preserved for FSM analytics integrity
  deleted_at TIMESTAMP NULL,

  -- Account lifecycle
  account_status ENUM('active','pending_approval','rejected','suspended') NOT NULL DEFAULT 'active',
  requested_role ENUM('student','instructor') NULL,
  approval_decision_by INT NULL,
  approval_decision_at TIMESTAMP NULL,
  approval_rejection_reason TEXT NULL,

  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

  INDEX idx_email (email),
  INDEX idx_google_id (google_id),
  INDEX idx_role (role),
  INDEX idx_users_deleted_at (deleted_at),
  INDEX idx_username (username)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== INSTRUCTOR APPLICATIONS ====================

CREATE TABLE IF NOT EXISTS instructor_applications (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  employee_id      VARCHAR(100) NULL,
  department       VARCHAR(255) NULL,
  campus           VARCHAR(255) NULL,
  justification    TEXT NULL,
  status           ENUM('pending','approved','rejected') NOT NULL DEFAULT 'pending',
  decided_by       INT NULL,
  decided_at       TIMESTAMP NULL,
  rejection_reason TEXT NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_status_created (status, created_at DESC),
  INDEX idx_user_id (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== STUDENT PROFILES ====================

CREATE TABLE IF NOT EXISTS student_profiles (
  id               INT AUTO_INCREMENT PRIMARY KEY,
  user_id          INT NOT NULL,
  student_id       VARCHAR(50) NULL,
  department       VARCHAR(100) NULL,
  year_level       VARCHAR(20) NULL,
  experience_level ENUM('beginner','some','intermediate','advanced') DEFAULT NULL,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user (user_id),
  UNIQUE KEY uq_student_id (student_id),
  INDEX idx_department (department)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- ==================== COURSES ====================

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  code_name VARCHAR(32) NULL,
  description TEXT,
  course_code VARCHAR(8) NOT NULL,
  status ENUM('active','archived') DEFAULT 'active',
  allow_reapply TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_course_code (course_code),
  INDEX idx_instructor (instructor_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ENROLLMENTS ====================

CREATE TABLE IF NOT EXISTS course_enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  student_id INT NOT NULL,
  status ENUM('pending','accepted','rejected') DEFAULT 'pending',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  rejection_reason TEXT DEFAULT NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_course_student (course_id, student_id),
  INDEX idx_course_status (course_id, status),
  INDEX idx_student_status (student_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ANNOUNCEMENTS ====================

CREATE TABLE IF NOT EXISTS class_announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  author_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  pinned TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_course_pinned_time (course_id, pinned DESC, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== SIMULATION & PRACTICE ====================

CREATE TABLE IF NOT EXISTS rules (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NULL,
  step INT NOT NULL,
  instruction VARCHAR(255) NOT NULL,
  correct_action VARCHAR(100) NOT NULL,
  created_by INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,
  INDEX idx_course_step (course_id, step),
  INDEX idx_step (step)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  course_id INT NULL,
  score INT DEFAULT 0,
  hints_used INT DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,
  duration_seconds INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  INDEX idx_user_course (user_id, course_id),
  INDEX idx_course_score (course_id, score DESC),
  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_completed (completed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sim_attempts: one row per simulation session (analytics counterpart to attempts).
CREATE TABLE IF NOT EXISTS sim_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  user_id INT NOT NULL,
  course_id INT NULL,
  attempt_number INT NOT NULL DEFAULT 1,
  raw_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  score_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
  grade VARCHAR(2) AS (
    CASE
      WHEN score_percent >= 90 THEN 'A'
      WHEN score_percent >= 80 THEN 'B'
      WHEN score_percent >= 70 THEN 'C'
      WHEN score_percent >= 60 THEN 'D'
      ELSE 'F'
    END
  ) STORED,
  passed TINYINT(1) NOT NULL DEFAULT 0,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  duration_seconds INT NOT NULL DEFAULT 0,
  total_errors INT NOT NULL DEFAULT 0,
  hints_used INT NOT NULL DEFAULT 0,
  steps_completed INT NOT NULL DEFAULT 0,
  wash_quality_percent INT NOT NULL DEFAULT 0,
  bones_total INT NOT NULL DEFAULT 0,
  scoring_version VARCHAR(8) NOT NULL DEFAULT 'v2',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES attempts(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_id (user_id),
  INDEX idx_attempt_id (attempt_id),
  INDEX idx_course_id (course_id),
  INDEX idx_course_completed (course_id, completed),
  INDEX idx_user_course (user_id, course_id),
  UNIQUE KEY uq_sim_attempt_user_course_number (user_id, course_id, attempt_number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sim_step_results: per-step scoring detail for each sim_attempt.
CREATE TABLE IF NOT EXISTS sim_step_results (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sim_attempt_id INT NOT NULL,
  step_id INT NOT NULL,
  step_key VARCHAR(64) NOT NULL DEFAULT '',
  score_weight INT NOT NULL DEFAULT 0,
  earned_score DECIMAL(6,2) NOT NULL DEFAULT 0,
  accuracy_factor DECIMAL(6,3) NOT NULL DEFAULT 0,
  efficiency_factor DECIMAL(6,3) NOT NULL DEFAULT 0,
  quality_factor DECIMAL(6,3) NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  correct_actions INT NOT NULL DEFAULT 0,
  time_spent_seconds INT NOT NULL DEFAULT 0,
  completed TINYINT(1) NOT NULL DEFAULT 0,
  hint_level TINYINT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sim_attempt_id) REFERENCES sim_attempts(id) ON DELETE CASCADE,
  INDEX idx_sim_attempt_step (sim_attempt_id, step_id),
  INDEX idx_step (step_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sim_error_log: one row per error event per step.
CREATE TABLE IF NOT EXISTS sim_error_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sim_attempt_id INT NOT NULL,
  step_id INT NOT NULL,
  error_class VARCHAR(64) NOT NULL,
  severity ENUM('minor','major','critical') NOT NULL DEFAULT 'major',
  tool_active VARCHAR(64) NULL,
  client_timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sim_attempt_id) REFERENCES sim_attempts(id) ON DELETE CASCADE,
  INDEX idx_sim_attempt (sim_attempt_id),
  INDEX idx_step_class (step_id, error_class)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sim_bone_counts: bone extraction totals per sim_attempt.
CREATE TABLE IF NOT EXISTS sim_bone_counts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sim_attempt_id INT NOT NULL,
  rib INT NOT NULL DEFAULT 0,
  dorsal INT NOT NULL DEFAULT 0,
  ventral INT NOT NULL DEFAULT 0,
  lateral INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sim_attempt_id) REFERENCES sim_attempts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_sim_attempt (sim_attempt_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sim_tool_usage: aggregated tool-selection stats per step per sim_attempt.
CREATE TABLE IF NOT EXISTS sim_tool_usage (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sim_attempt_id INT NOT NULL,
  step_id INT NOT NULL,
  tool_name VARCHAR(64) NOT NULL,
  selection_count INT NOT NULL DEFAULT 0,
  active_seconds INT NOT NULL DEFAULT 0,
  wrong_tool_triggers INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sim_attempt_id) REFERENCES sim_attempts(id) ON DELETE CASCADE,
  UNIQUE KEY uq_attempt_step_tool (sim_attempt_id, step_id, tool_name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sim_event_log: append-only FSM event stream per sim_attempt.
CREATE TABLE IF NOT EXISTS sim_event_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  sim_attempt_id INT NOT NULL,
  step_id INT NOT NULL,
  event_type VARCHAR(64) NOT NULL,
  payload JSON NULL,
  geometric_trace JSON NULL,
  client_timestamp BIGINT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sim_attempt_id) REFERENCES sim_attempts(id) ON DELETE CASCADE,
  INDEX idx_sim_attempt (sim_attempt_id),
  INDEX idx_step_event (step_id, event_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- sim_mastery: running per-step mastery score per student.
CREATE TABLE IF NOT EXISTS sim_mastery (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  step_id INT NOT NULL,
  mastery_score DECIMAL(5,2) NOT NULL DEFAULT 0,
  attempts_count INT NOT NULL DEFAULT 0,
  best_accuracy DECIMAL(6,3) NOT NULL DEFAULT 0,
  avg_accuracy DECIMAL(6,3) NOT NULL DEFAULT 0,
  avg_time_seconds INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_step (user_id, step_id),
  INDEX idx_step (step_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== LEARNING SECTION ====================

-- module_progress: completed_at IS NOT NULL means done (replaces boolean completed).
-- The boolean `completed` column is kept for backward compatibility and computed from completed_at.
CREATE TABLE IF NOT EXISTS module_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  completed_at TIMESTAMP NULL DEFAULT NULL,
  completed TINYINT(1) GENERATED ALWAYS AS (completed_at IS NOT NULL) VIRTUAL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_module (user_id, module_id),
  INDEX idx_user_completed (user_id, completed),
  INDEX idx_module (module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== QUIZ ATTEMPTS ====================

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  -- course_id: null = independent practice; set = course-scoped attempt
  course_id INT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  passed BOOLEAN DEFAULT FALSE,
  time_spent INT DEFAULT 0,
  -- PROMPTv13 audit columns
  max_streak INT NOT NULL DEFAULT 0,
  completed_in_time TINYINT(1) NOT NULL DEFAULT 0,
  xp_earned INT NOT NULL DEFAULT 0,
  is_first_pass TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE SET NULL,
  INDEX idx_user_module (user_id, module_id),
  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_module_score (module_id, score DESC),
  INDEX idx_passed (passed),
  INDEX idx_course_created (course_id, created_at DESC)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Per-question audit log (thesis analytics: which question is hardest?)
CREATE TABLE IF NOT EXISTS quiz_attempt_answers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  attempt_id INT NOT NULL,
  question_index INT NOT NULL,
  question_id INT NOT NULL,
  picked_option CHAR(1) NULL,       -- 'A'|'B'|'C'|'D' or NULL on timeout
  correct_option CHAR(1) NOT NULL,
  is_correct TINYINT(1) NOT NULL,
  time_spent_ms INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (attempt_id) REFERENCES quiz_attempts(id) ON DELETE CASCADE,
  INDEX idx_attempt (attempt_id),
  INDEX idx_question (question_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Server-side quiz session: stores shuffled question order + correct answers
-- so /submit can score against the same set the student saw.
CREATE TABLE IF NOT EXISTS quiz_sessions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  question_ids JSON NOT NULL,
  shuffled_data JSON NOT NULL,
  -- [fix] Tracks which question indices the student has already answered via /check.
  -- NULL = no answers recorded yet. Each index is written once; re-checks are rejected.
  -- Prevents option-probing (calling /check 4× per question to enumerate the correct letter).
  answered_indices JSON NULL DEFAULT NULL,
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uq_user_module (user_id, module_id),
  INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ACHIEVEMENTS ====================

CREATE TABLE IF NOT EXISTS user_achievements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  achievement_id INT NOT NULL,
  unlocked_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_achievement (user_id, achievement_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== NOTIFICATIONS ====================

CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  link VARCHAR(255) DEFAULT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_unread (user_id, is_read, created_at DESC),
  -- Dedup key: prevents re-sending the same notification (same type+title+link) to the same user.
  -- title is included so multiple achievement notifications (different def.name, same link) are allowed.
  UNIQUE KEY uq_notif_dedup (user_id, type, title, link)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== COURSE AUDIT LOG ====================

CREATE TABLE IF NOT EXISTS course_audit_log (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT DEFAULT NULL,
  actor_id INT NOT NULL,
  actor_role VARCHAR(20) NOT NULL,
  action VARCHAR(64) NOT NULL,
  target_user_id INT DEFAULT NULL,
  metadata JSON DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_course_time (course_id, created_at DESC),
  INDEX idx_actor_time (actor_id, created_at DESC),
  INDEX idx_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== MIGRATIONS / DATA SYNC ====================
-- Idempotent. Safe to re-run after re-importing this file.

-- Backfill: students who completed onboarding before tour_completed was introduced
-- are treated as having already seen the tour so they are not forced through it again.
UPDATE users
   SET tour_completed = 1
 WHERE onboarding_completed = TRUE
   AND tour_completed = 0;

-- Safety guard: remove any unlock rows for achievement IDs outside the valid range (1–21).
DELETE FROM user_achievements
  WHERE achievement_id NOT BETWEEN 1 AND 21;

-- ── Activity logs (admin action audit trail) ──────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id    INT UNSIGNED NOT NULL,
  admin_name  VARCHAR(255) NOT NULL,
  action      VARCHAR(64)  NOT NULL,
  target_id   INT UNSIGNED NULL,
  target_name VARCHAR(255) NULL,
  details     JSON         NULL,
  created_at  TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at (created_at),
  INDEX idx_admin_id   (admin_id),
  INDEX idx_action     (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
