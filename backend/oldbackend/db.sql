-- File Path: backend/db.sql
-- PROMPTv13 update: added quiz_attempt_answers, quiz_sessions, quiz_questions;
-- altered quiz_attempts with audit columns; altered lecture_progress with completed_at.

CREATE DATABASE IF NOT EXISTS boneup_db;
USE boneup_db;

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

  -- Student-specific
  student_id VARCHAR(50),
  experience_level ENUM('beginner','some','intermediate','advanced') DEFAULT NULL,
  department VARCHAR(100),
  year_level VARCHAR(20),

  -- Instructor-specific
  specialization VARCHAR(255),
  office_location VARCHAR(255),
  office_hours TEXT,

  -- Gamification
  xp_points INT DEFAULT 0,
  equipped_badges JSON DEFAULT NULL,

  -- Onboarding / Security
  onboarding_completed BOOLEAN DEFAULT FALSE,
  tour_completed TINYINT(1) NOT NULL DEFAULT 0,
  failed_login_attempts INT NOT NULL DEFAULT 0,
  lock_until TIMESTAMP NULL,
  must_change_password TINYINT(1) NOT NULL DEFAULT 0,
  last_login_at TIMESTAMP NULL,

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
  INDEX idx_username (username),
  INDEX idx_student_id (student_id),
  INDEX idx_department (department)
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

-- ==================== COURSES ====================

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
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

-- ==================== LEARNING SECTION ====================

-- lecture_progress: completed_at IS NOT NULL means done (replaces boolean completed).
-- The boolean `completed` column is kept for backward compatibility and computed from completed_at.
CREATE TABLE IF NOT EXISTS lecture_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL DEFAULT NULL,
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
  started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,
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
  INDEX idx_user_unread (user_id, is_read, created_at DESC)
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