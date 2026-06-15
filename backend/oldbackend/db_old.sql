-- File Path: backend/complete_db.sql
-- FINAL VERSION: All user profile data merged into users table

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
  
  -- Basic Profile (shared by all roles)
  username VARCHAR(50) UNIQUE NULL,
  full_name VARCHAR(255),
  bio TEXT,
  avatar_url VARCHAR(255),
  phone VARCHAR(20),
  date_of_birth DATE,
  address TEXT,
  
  -- Student-specific fields (nullable for non-students)
  student_id VARCHAR(50),
  experience_level ENUM('beginner','some','intermediate','advanced') DEFAULT NULL,
  department VARCHAR(100),
  year_level VARCHAR(20),
  
  -- Instructor-specific fields (nullable for non-instructors)
  specialization VARCHAR(255),
  office_location VARCHAR(255),
  office_hours TEXT,

  -- Gamification
  xp_points INT DEFAULT 0,
  equipped_badges JSON DEFAULT NULL,

  -- Onboarding
  onboarding_completed BOOLEAN DEFAULT FALSE,
  
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

-- ==================== CLASSES (COURSES) ====================

CREATE TABLE IF NOT EXISTS courses (
  id INT AUTO_INCREMENT PRIMARY KEY,
  instructor_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  course_code VARCHAR(20) UNIQUE NOT NULL,
  status ENUM('active', 'archived') DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_course_code (course_code),
  INDEX idx_instructor (instructor_id),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Class enrollments (students enrolled in classes)
CREATE TABLE IF NOT EXISTS course_enrollments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  student_id INT NOT NULL,
  status ENUM('pending', 'accepted', 'rejected') DEFAULT 'pending',
  enrolled_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  responded_at TIMESTAMP NULL,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_course_enrollment (course_id, student_id),
  INDEX idx_course_status (course_id, status),
  INDEX idx_student_status (student_id, status),
  INDEX idx_status (status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Class announcements (posted by instructors)
CREATE TABLE IF NOT EXISTS class_announcements (
  id INT AUTO_INCREMENT PRIMARY KEY,
  course_id INT NOT NULL,
  instructor_id INT NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority ENUM('low', 'normal', 'high') DEFAULT 'normal',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (course_id) REFERENCES courses(id) ON DELETE CASCADE,
  FOREIGN KEY (instructor_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_course_created (course_id, created_at DESC),
  INDEX idx_priority (priority)
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

CREATE TABLE IF NOT EXISTS lecture_progress (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_module (user_id, module_id),
  INDEX idx_user_completed (user_id, completed),
  INDEX idx_module (module_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS quiz_attempts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  module_id INT NOT NULL,
  score INT NOT NULL,
  total_questions INT NOT NULL,
  passed BOOLEAN DEFAULT FALSE,
  time_spent INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  INDEX idx_user_module (user_id, module_id),
  INDEX idx_user_created (user_id, created_at DESC),
  INDEX idx_module_score (module_id, score DESC),
  INDEX idx_passed (passed)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ==================== ACHIEVEMENTS ====================

CREATE TABLE IF NOT EXISTS user_achievements (
  id             INT AUTO_INCREMENT PRIMARY KEY,
  user_id        INT NOT NULL,
  achievement_id INT NOT NULL,
  unlocked_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_achievement (user_id, achievement_id),
  INDEX idx_user (user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;