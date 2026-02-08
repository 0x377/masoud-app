CREATE TABLE IF NOT EXISTS users (
  -- Primary identification
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  
  -- Personal Information (from persons table)
  national_id VARCHAR(14) UNIQUE COMMENT 'الهوية الوطنية - 14 رقم',
  full_name_arabic VARCHAR(255),
  full_name_english VARCHAR(255),
  gender ENUM('M', 'F') NOT NULL COMMENT 'M = ذكر, F = أنثى',
  birth_date DATE,
  birth_place VARCHAR(255),
  death_date DATE,
  is_alive BOOLEAN DEFAULT TRUE,
  marital_status ENUM('single', 'married', 'divorced', 'widowed') DEFAULT 'single',
  blood_type VARCHAR(5) COMMENT 'مثل: O+, A-, AB+',
  current_address TEXT,
  photo_path VARCHAR(500),
  family_info JSON COMMENT 'معلومات الأب والأم والأبناء',
  education_info JSON COMMENT 'معلومات التعليم',
  work_info JSON COMMENT 'معلومات العمل',
  additional_info JSON,
  verified_by CHAR(36),
  verified_at TIMESTAMP NULL,
  deleted_at TIMESTAMP NULL,
  
  -- Authentication & basic info (from users table)
  username VARCHAR(50) UNIQUE,
  email VARCHAR(255) UNIQUE,
  email_verified_at TIMESTAMP NULL,
  phone_number VARCHAR(20) UNIQUE,
  phone_verified_at TIMESTAMP NULL,
  password VARCHAR(255) NOT NULL,
  password_changed_at TIMESTAMP NULL,
  remember_token VARCHAR(100),
  
  -- User roles and permissions
  user_type ENUM(
    'FAMILY_MEMBER',
    'BOARD_MEMBER',
    'EXECUTIVE',
    'FINANCE_MANAGER',
    'SOCIAL_COMMITTEE',
    'CULTURAL_COMMITTEE',
    'RECONCILIATION_COMMITTEE',
    'SPORTS_COMMITTEE',
    'MEDIA_CENTER',
    'SUPER_ADMIN'
  ) DEFAULT 'FAMILY_MEMBER',
  
  additional_roles JSON COMMENT 'أدوار إضافية للمستخدم',
  permissions_override JSON COMMENT 'Permissions beyond user type',
  
  -- Account status
  status ENUM(
    'PENDING_VERIFICATION',
    'ACTIVE',
    'SUSPENDED',
    'DEACTIVATED',
    'BANNED'
  ) DEFAULT 'PENDING_VERIFICATION',
  
  suspension_reason TEXT,
  suspended_at TIMESTAMP NULL,
  suspended_by CHAR(36),
  
  -- MFA/2FA Configuration
  mfa_enabled BOOLEAN DEFAULT FALSE,
  mfa_secret VARCHAR(255) COMMENT 'TOTP secret key',
  mfa_backup_codes JSON COMMENT 'Backup codes for 2FA',
  mfa_enabled_at TIMESTAMP NULL,
  last_mfa_used_at TIMESTAMP NULL,
  
  -- Login security
  failed_login_attempts INT DEFAULT 0,
  locked_until TIMESTAMP NULL,
  last_login_ip VARCHAR(45),
  last_login_at TIMESTAMP NULL,
  last_activity_at TIMESTAMP NULL,
  current_session_id VARCHAR(255),
  login_count INT DEFAULT 0,
  
  -- Preferences
  preferences JSON COMMENT 'User preferences (theme, language, notifications)',
  notification_settings JSON COMMENT 'Notification preferences',
  
  -- Statistics
  total_donations DECIMAL(15, 2) DEFAULT 0,
  donation_count INT DEFAULT 0,
  last_donation_at TIMESTAMP NULL,
  
  -- Metadata
  metadata JSON,
  
  -- Audit timestamps
  created_by CHAR(36),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  -- Indexes for performance
  INDEX idx_birth_date (birth_date),
  INDEX idx_is_alive (is_alive),
  INDEX idx_gender_marital (gender, marital_status),
  INDEX idx_national_id (national_id),
  INDEX idx_email (email),
  INDEX idx_phone_number (phone_number),
  INDEX idx_user_type_status (user_type, status),
  INDEX idx_status (status),
  INDEX idx_email_verified (email_verified_at),
  INDEX idx_last_login (last_login_at),
  INDEX idx_created_at (created_at),
  INDEX idx_total_donations (total_donations)
  
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci 
COMMENT='Combined user and personal information table';
