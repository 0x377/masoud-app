/**
 * Migration: Create comprehensive users table with all features
 */

export const up = async (queryInterface) => {
  console.log("🔄 Creating comprehensive users table...");

  // Create persons table (for detailed personal information)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS persons (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
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
      email VARCHAR(255),
      phone_number VARCHAR(20),
      current_address TEXT,
      photo_path VARCHAR(500),
      family_info JSON COMMENT 'معلومات الأب والأم والأبناء',
      education_info JSON COMMENT 'معلومات التعليم',
      work_info JSON COMMENT 'معلومات العمل',
      additional_info JSON,
      created_by CHAR(36),
      verified_by CHAR(36),
      verified_at TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,

      -- Indexes
      INDEX idx_birth_date (birth_date),
      INDEX idx_is_alive (is_alive),
      INDEX idx_gender_marital (gender, marital_status),
      INDEX idx_national_id (national_id),
      INDEX idx_email (email),
      INDEX idx_phone_number (phone_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Detailed personal information';
  `);

  console.log("✅ Persons table created");

  // Create comprehensive users table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS users (
      -- Primary identification
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      person_id CHAR(36) UNIQUE,

      -- Authentication & basic info
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
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      deleted_at TIMESTAMP NULL,

      -- Foreign key constraint
      CONSTRAINT fk_users_person FOREIGN KEY (person_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,

      -- Indexes for performance
      INDEX idx_user_type_status (user_type, status),
      INDEX idx_status (status),
      INDEX idx_email_verified (email_verified_at),
      INDEX idx_last_login (last_login_at),
      INDEX idx_created_at (created_at),
      INDEX idx_phone_number (phone_number),
      INDEX idx_total_donations (total_donations),
      INDEX idx_person_id (person_id)

    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='User authentication and account management';
  `);

  console.log("✅ Users table created");

  // Create password reset tokens table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS password_reset_tokens (
      email VARCHAR(255) PRIMARY KEY,
      token VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

      INDEX idx_email_token (email, token),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Password reset tokens table created");

  // Create personal access tokens table (for API authentication)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS personal_access_tokens (
      id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      tokenable_type VARCHAR(255) NOT NULL,
      tokenable_id CHAR(36) NOT NULL,
      name VARCHAR(255) NOT NULL,
      token VARCHAR(64) UNIQUE NOT NULL,
      abilities TEXT,
      last_used_at TIMESTAMP NULL,
      expires_at TIMESTAMP NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      device_id VARCHAR(255) COMMENT 'For mobile device identification',
      device_name VARCHAR(255),
      device_type ENUM('web', 'ios', 'android', 'desktop') DEFAULT 'web',
      is_revoked BOOLEAN DEFAULT FALSE,
      revoked_at TIMESTAMP NULL,
      revoked_by_ip VARCHAR(45),
      revoked_by_user CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_tokenable (tokenable_type, tokenable_id),
      INDEX idx_token (token),
      INDEX idx_expires_at (expires_at),
      INDEX idx_last_used_at (last_used_at),
      INDEX idx_device_id (device_id),
      INDEX idx_is_revoked (is_revoked)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Personal access tokens table created");

  // Create sessions table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS sessions (
      id VARCHAR(255) PRIMARY KEY,
      user_id CHAR(36),
      ip_address VARCHAR(45),
      user_agent TEXT,
      payload LONGTEXT NOT NULL,
      last_activity INT NOT NULL,
      
      -- Additional session metadata
      device_id VARCHAR(255),
      device_name VARCHAR(255),
      device_type ENUM('web', 'ios', 'android', 'desktop') DEFAULT 'web',
      browser VARCHAR(100),
      browser_version VARCHAR(50),
      platform VARCHAR(100),
      is_mobile BOOLEAN DEFAULT FALSE,
      is_tablet BOOLEAN DEFAULT FALSE,
      is_desktop BOOLEAN DEFAULT FALSE,
      country VARCHAR(100),
      city VARCHAR(100),
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      login_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      is_active BOOLEAN DEFAULT TRUE,
      
      -- Indexes
      INDEX idx_user_id (user_id),
      INDEX idx_last_activity (last_activity),
      INDEX idx_user_active (user_id, is_active),
      INDEX idx_device_id (device_id),
      INDEX idx_login_at (login_at),
      INDEX idx_is_active (is_active),
      
      -- Foreign key constraint
      CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Sessions table created");

  // Create verification codes table for OTP
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS verification_codes (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      code VARCHAR(6) NOT NULL COMMENT '6-digit verification code',
      type ENUM(
        'EMAIL_VERIFICATION',
        'PHONE_VERIFICATION',
        'PASSWORD_RESET',
        'LOGIN_2FA',
        'TRANSACTION_VERIFICATION',
        'ACCOUNT_RECOVERY'
      ) NOT NULL,
      recipient VARCHAR(255) NOT NULL COMMENT 'Email or phone number',
      channel ENUM('email', 'sms', 'whatsapp', 'push') NOT NULL,
      metadata TEXT,
      is_used BOOLEAN DEFAULT FALSE,
      used_at TIMESTAMP NULL,
      used_ip VARCHAR(45),
      used_device_id VARCHAR(255),
      is_expired BOOLEAN DEFAULT FALSE,
      expires_at TIMESTAMP NOT NULL,
      verified_at TIMESTAMP NULL,
      attempts INT DEFAULT 0,
      last_attempt_at TIMESTAMP NULL,
      is_locked BOOLEAN DEFAULT FALSE,
      locked_until TIMESTAMP NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Indexes
      INDEX idx_user_type_used (user_id, type, is_used),
      INDEX idx_code_type_expired (code, type, is_expired),
      INDEX idx_expires_at (expires_at),
      INDEX idx_recipient_created (recipient, created_at),
      
      -- Foreign key constraint
      CONSTRAINT fk_verification_codes_user FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Verification codes table created");

  // Create login history table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS login_histories (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      event_type ENUM(
        'LOGIN_SUCCESS',
        'LOGIN_FAILED',
        'LOGOUT',
        'PASSWORD_CHANGED',
        'MFA_ENABLED',
        'MFA_DISABLED',
        'ACCOUNT_LOCKED',
        'ACCOUNT_UNLOCKED'
      ) NOT NULL,
      ip_address VARCHAR(45),
      user_agent TEXT,
      device_id VARCHAR(255),
      device_name VARCHAR(255),
      device_type ENUM('web', 'ios', 'android', 'desktop') DEFAULT 'web',
      country VARCHAR(100),
      city VARCHAR(100),
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      browser VARCHAR(100),
      browser_version VARCHAR(50),
      platform VARCHAR(100),
      details TEXT COMMENT 'JSON details about the event',
      is_suspicious BOOLEAN DEFAULT FALSE,
      suspicious_reason TEXT,
      related_session_id VARCHAR(255),
      related_token_id BIGINT UNSIGNED,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      -- Indexes
      INDEX idx_user_event_created (user_id, event_type, created_at),
      INDEX idx_ip_address (ip_address),
      INDEX idx_device_id (device_id),
      INDEX idx_is_suspicious (is_suspicious),
      INDEX idx_created_at (created_at),
      
      -- Foreign key constraints
      CONSTRAINT fk_login_histories_user FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_login_histories_token FOREIGN KEY (related_token_id) 
        REFERENCES personal_access_tokens(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // console.log("✅ Login histories table created");

  // // Create security logs table
  // await queryInterface.execute(`
  //   CREATE TABLE IF NOT EXISTS security_logs (
  //     id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  //     user_id CHAR(36),
  //     severity ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NOT NULL,
  //     action VARCHAR(255) NOT NULL,
  //     description TEXT NOT NULL,
  //     ip_address VARCHAR(45),
  //     user_agent TEXT,
  //     old_values JSON,
  //     new_values JSON,
  //     metadata JSON,
  //     affected_user_id CHAR(36) COMMENT 'User affected by this action',
  //     affected_table VARCHAR(255),
  //     affected_record_id CHAR(36),
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  //     updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
  //     -- Indexes
  //     INDEX idx_user_severity_created (user_id, severity, created_at),
  //     INDEX idx_severity (severity),
  //     INDEX idx_action (action),
  //     INDEX idx_affected_user (affected_user_id),
  //     INDEX idx_created_at (created_at),
      
  //     -- Foreign key constraints
  //     CONSTRAINT fk_security_logs_user FOREIGN KEY (user_id) 
  //       REFERENCES users(id) 
  //       ON DELETE SET NULL 
  //       ON UPDATE CASCADE,
      
  //     CONSTRAINT fk_security_logs_affected_user FOREIGN KEY (affected_user_id) 
  //       REFERENCES users(id) 
  //       ON DELETE SET NULL 
  //       ON UPDATE CASCADE
  //   ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  // `);

  // console.log("✅ Security logs table created");

  // Create password history table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS password_history (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      changed_by_ip VARCHAR(45),
      changed_by_user CHAR(36),
      is_current BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      -- Indexes
      INDEX idx_user_changed (user_id, changed_at),
      INDEX idx_is_current (is_current),
      
      -- Foreign key constraint
      CONSTRAINT fk_password_history_user FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Password history table created");

  // Create user permissions table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS user_permissions (
      id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      permission VARCHAR(255) NOT NULL,
      is_allowed BOOLEAN DEFAULT TRUE,
      restrictions TEXT COMMENT 'JSON restrictions for this permission',
      granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      granted_by CHAR(36),
      expires_at TIMESTAMP NULL,
      grant_reason TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      -- Unique constraint
      UNIQUE KEY uk_user_permission (user_id, permission),

      -- Indexes
      INDEX idx_user_allowed (user_id, is_allowed),
      INDEX idx_permission (permission),
      INDEX idx_expires_at (expires_at),

      -- Foreign key constraint
      CONSTRAINT fk_user_permissions_user FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,

      CONSTRAINT fk_user_permissions_granted_by FOREIGN KEY (granted_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ User permissions table created");

  // Insert default admin user
  await queryInterface.execute(`
    INSERT INTO persons (
      id, national_id, full_name_arabic, full_name_english, 
      gender, email, phone_number, created_at, updated_at
    ) VALUES (
      UUID(),
      '00000000000000',
      'مدير النظام',
      'System Administrator',
      'M',
      'admin@example.com',
      '+966500000000',
      NOW(),
      NOW()
    );
  `);

  const [personResult] = await queryInterface.execute(`
    SELECT id FROM persons WHERE email = 'admin@example.com';
  `);

  if (personResult.length > 0) {
    const personId = personResult[0].id;

    await queryInterface.execute(
      `
      INSERT INTO users (
        id, person_id, username, email, email_verified_at, 
        phone_number, phone_verified_at, password, password_changed_at,
        user_type, status, mfa_enabled, preferences, 
        created_at, updated_at
      ) VALUES (
        UUID(),
        ?,
        'admin',
        'admin@example.com',
        NOW(),
        '+966500000000',
        NOW(),
        '$2y$12$XHxYzABC123DEF456GHI789JKL012MNOP345QRS678TUV901WXYZA', -- admin123
        NOW(),
        'SUPER_ADMIN',
        'ACTIVE',
        FALSE,
        '{"theme": "light", "language": "ar", "notifications": true}',
        NOW(),
        NOW()
      );
    `,
      [personId],
    );

    console.log("✅ Default admin user created");
  }

  console.log("🎉 All tables created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping all tables...");

  // Drop tables in reverse order (due to foreign key constraints)
  await queryInterface.execute("DROP TABLE IF EXISTS user_permissions");
  await queryInterface.execute("DROP TABLE IF EXISTS password_history");
  // await queryInterface.execute("DROP TABLE IF EXISTS security_logs");
  await queryInterface.execute("DROP TABLE IF EXISTS login_histories");
  await queryInterface.execute("DROP TABLE IF EXISTS verification_codes");
  await queryInterface.execute("DROP TABLE IF EXISTS sessions");
  await queryInterface.execute("DROP TABLE IF EXISTS personal_access_tokens");
  await queryInterface.execute("DROP TABLE IF EXISTS password_reset_tokens");
  await queryInterface.execute("DROP TABLE IF EXISTS users");
  await queryInterface.execute("DROP TABLE IF EXISTS persons");

  console.log("✅ All tables dropped successfully");
};
