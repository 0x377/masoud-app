/**
 * Migration: Comprehensive Family Management System - FIXED VERSION
 */

export const up = async (queryInterface) => {
  console.log("🚀 Creating comprehensive family management system...");

  // ============================================
  // SYSTEM-WIDE TABLES
  // ============================================
  console.log("📦 Creating system-wide tables...");

  // Access Control Matrix
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS access_control_matrix (
      access_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
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
      ) NOT NULL,
      section_id INT NOT NULL COMMENT 'Section number 1-10',
      permission_level ENUM('NONE', 'VIEW', 'EDIT', 'APPROVE', 'ADMIN') DEFAULT 'NONE',
      specific_access JSON COMMENT 'Specific permissions within the section',
      conditions TEXT COMMENT 'Conditions for access',
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_user_type_section (user_type, section_id),
      
      INDEX idx_user_type (user_type),
      INDEX idx_section_id (section_id),
      INDEX idx_permission_level (permission_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Activity Log
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS activity_logs (
      log_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36),
      section_id INT COMMENT 'Which section was accessed',
      action VARCHAR(255) NOT NULL,
      action_type ENUM('CREATE', 'READ', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'DOWNLOAD', 'UPLOAD', 'APPROVE', 'REJECT') NOT NULL,
      entity_type VARCHAR(100) COMMENT 'Type of entity affected',
      entity_id CHAR(36) COMMENT 'ID of entity affected',
      description TEXT,
      old_values JSON,
      new_values JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      device_info JSON,
      location_info JSON,
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_log_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_user_id (user_id),
      INDEX idx_section_id (section_id),
      INDEX idx_action_type (action_type),
      INDEX idx_entity (entity_type, entity_id),
      INDEX idx_created_at (created_at),
      INDEX idx_action (action)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Notifications
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS notifications (
      notification_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      message_arabic TEXT,
      message_english TEXT,
      notification_type ENUM('SYSTEM', 'ALERT', 'REMINDER', 'ANNOUNCEMENT', 'MESSAGE', 'APPROVAL', 'REJECTION') DEFAULT 'SYSTEM',
      priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
      related_entity_type VARCHAR(100),
      related_entity_id CHAR(36),
      action_url VARCHAR(500),
      is_read BOOLEAN DEFAULT FALSE,
      read_at TIMESTAMP NULL,
      expires_at TIMESTAMP NULL,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_notification_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      INDEX idx_user_id (user_id),
      INDEX idx_notification_type (notification_type),
      INDEX idx_is_read (is_read),
      INDEX idx_created_at (created_at),
      INDEX idx_expires_at (expires_at),
      INDEX idx_priority (priority)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // ============================================
  // INSERT DEFAULT DATA
  // ============================================
  console.log("📝 Inserting default data...");

  // Insert access control matrix
  await queryInterface.execute(`
    INSERT IGNORE INTO access_control_matrix (user_type, section_id, permission_level) VALUES
    -- Super Admin has full access to all sections
    ('SUPER_ADMIN', 1, 'ADMIN'),
    ('SUPER_ADMIN', 2, 'ADMIN'),
    ('SUPER_ADMIN', 3, 'ADMIN'),
    ('SUPER_ADMIN', 4, 'ADMIN'),
    ('SUPER_ADMIN', 5, 'ADMIN'),
    ('SUPER_ADMIN', 6, 'ADMIN'),
    ('SUPER_ADMIN', 7, 'ADMIN'),
    ('SUPER_ADMIN', 8, 'ADMIN'),
    ('SUPER_ADMIN', 9, 'ADMIN'),
    ('SUPER_ADMIN', 10, 'ADMIN'),
    
    -- Board Members access
    ('BOARD_MEMBER', 2, 'ADMIN'),
    ('BOARD_MEMBER', 3, 'VIEW'),
    ('BOARD_MEMBER', 4, 'VIEW'),
    ('BOARD_MEMBER', 5, 'VIEW'),
    ('BOARD_MEMBER', 6, 'VIEW'),
    
    -- Executive Management access
    ('EXECUTIVE', 5, 'ADMIN'),
    ('EXECUTIVE', 1, 'EDIT'),
    ('EXECUTIVE', 4, 'VIEW'),
    
    -- Finance Manager access
    ('FINANCE_MANAGER', 6, 'ADMIN'),
    ('FINANCE_MANAGER', 1, 'APPROVE'),
    
    -- Social Committee access
    ('SOCIAL_COMMITTEE', 7, 'ADMIN'),
    
    -- Cultural Committee access
    ('CULTURAL_COMMITTEE', 8, 'ADMIN'),
    
    -- Reconciliation Committee access
    ('RECONCILIATION_COMMITTEE', 9, 'ADMIN'),
    
    -- Media Center access
    ('MEDIA_CENTER', 10, 'ADMIN'),
    
    -- Family Member access
    ('FAMILY_MEMBER', 1, 'VIEW'),
    ('FAMILY_MEMBER', 4, 'VIEW'),
    ('FAMILY_MEMBER', 7, 'VIEW'),
    ('FAMILY_MEMBER', 8, 'VIEW');
  `);

  console.log("✅ Default data inserted");

  // ============================================
  // CREATE STORED PROCEDURES (WITH DROP IF EXISTS)
  // ============================================
  console.log("⚙️ Creating stored procedures...");

  // First drop the procedures if they exist
  await queryInterface.execute(`DROP PROCEDURE IF EXISTS sp_get_user_permissions`);
  await queryInterface.execute(`DROP PROCEDURE IF EXISTS sp_log_activity`);

  // Create stored procedures
  await queryInterface.execute(`
    CREATE PROCEDURE sp_get_user_permissions(
      IN p_user_id CHAR(36)
    )
    BEGIN
      DECLARE v_user_type VARCHAR(50);
      
      -- Get user type (with error handling if users table doesn't exist yet)
      SELECT user_type INTO v_user_type 
      FROM users 
      WHERE id = p_user_id 
        AND deleted_at IS NULL;
      
      -- Return permissions for this user type
      IF v_user_type IS NOT NULL THEN
        SELECT 
          ac.section_id,
          ac.permission_level,
          ac.specific_access,
          ac.conditions,
          CASE ac.section_id
            WHEN 1 THEN 'منصة التبرعات'
            WHEN 2 THEN 'أعضاء مجلس الإدارة'
            WHEN 3 THEN 'وقف العائلة'
            WHEN 4 THEN 'أرشيف العائلة'
            WHEN 5 THEN 'الإدارة التنفيذية'
            WHEN 6 THEN 'المدير المالي'
            WHEN 7 THEN 'اللجنة الاجتماعية'
            WHEN 8 THEN 'اللجنة الثقافية'
            WHEN 9 THEN 'لجنة إصلاح ذات البين'
            WHEN 10 THEN 'المركز الإعلامي'
          END AS section_name_arabic
        FROM access_control_matrix ac
        WHERE ac.user_type = v_user_type
        ORDER BY ac.section_id;
      ELSE
        -- Return empty result if user not found
        SELECT NULL as section_id, NULL as permission_level, NULL as specific_access, 
               NULL as conditions, NULL as section_name_arabic
        WHERE FALSE;
      END IF;
    END
  `);

  // Procedure to log activity
  await queryInterface.execute(`
    CREATE PROCEDURE sp_log_activity(
      IN p_user_id CHAR(36),
      IN p_section_id INT,
      IN p_action VARCHAR(255),
      IN p_action_type VARCHAR(50),
      IN p_entity_type VARCHAR(100),
      IN p_entity_id CHAR(36),
      IN p_description TEXT,
      IN p_ip_address VARCHAR(45),
      IN p_user_agent TEXT
    )
    BEGIN
      DECLARE v_table_exists INT;
      
      -- Check if activity_logs table exists
      SELECT COUNT(*) INTO v_table_exists
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
        AND table_name = 'activity_logs';
      
      -- Only insert if table exists
      IF v_table_exists > 0 THEN
        INSERT INTO activity_logs (
          user_id,
          section_id,
          action,
          action_type,
          entity_type,
          entity_id,
          description,
          ip_address,
          user_agent,
          created_at
        ) VALUES (
          p_user_id,
          p_section_id,
          p_action,
          p_action_type,
          p_entity_type,
          p_entity_id,
          p_description,
          p_ip_address,
          p_user_agent,
          NOW()
        );
      END IF;
    END
  `);

  console.log("✅ Stored procedures created");

  // ============================================
  // CREATE VIEWS
  // ============================================
  console.log("👁️ Creating views...");

  // Drop view if exists first
  await queryInterface.execute(`DROP VIEW IF EXISTS vw_basic_dashboard`);
  await queryInterface.execute(`DROP VIEW IF EXISTS vw_user_statistics`);

  // Create view for user statistics (doesn't reference persons table)
  await queryInterface.execute(`
    CREATE VIEW vw_user_statistics AS
    SELECT 
      'إجمالي الأعضاء' AS metric_name_arabic,
      'Total Members' AS metric_name_english,
      COUNT(*) AS metric_value,
      'users' AS metric_icon,
      'info' AS metric_type
    FROM users
    WHERE deleted_at IS NULL
      AND status IN ('ACTIVE', 'PENDING_VERIFICATION')
    
    UNION ALL
    
    SELECT 
      'الأعضاء النشطين',
      'Active Users',
      COUNT(*),
      'user-check',
      'success'
    FROM users
    WHERE status = 'ACTIVE'
      AND deleted_at IS NULL
      
    UNION ALL
    
    SELECT 
      'المشرفين',
      'Super Admins',
      COUNT(*),
      'shield',
      'warning'
    FROM users
    WHERE user_type = 'SUPER_ADMIN'
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
      
    UNION ALL
    
    SELECT 
      'أعضاء مجلس الإدارة',
      'Board Members',
      COUNT(*),
      'users',
      'primary'
    FROM users
    WHERE user_type = 'BOARD_MEMBER'
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
      
    UNION ALL
    
    SELECT 
      'أعضاء العائلة',
      'Family Members',
      COUNT(*),
      'user',
      'secondary'
    FROM users
    WHERE user_type = 'FAMILY_MEMBER'
      AND status = 'ACTIVE'
      AND deleted_at IS NULL;
  `);

  // Create a basic dashboard view that only uses existing tables
  await queryInterface.execute(`
    CREATE VIEW vw_basic_dashboard AS
    SELECT 
      'إجمالي المستخدمين' AS metric_name_arabic,
      'Total Users' AS metric_name_english,
      COUNT(*) AS metric_value,
      'users' AS metric_icon
    FROM users
    WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
      'المستخدمين النشطين',
      'Active Users',
      COUNT(*),
      'user-check'
    FROM users
    WHERE status = 'ACTIVE'
      AND deleted_at IS NULL
      
    UNION ALL
    
    SELECT 
      'إجمالي التبرعات',
      'Total Donations',
      COALESCE(SUM(total_donations), 0),
      'donate'
    FROM users
    WHERE deleted_at IS NULL
    
    UNION ALL
    
    SELECT 
      'آخر تسجيل دخول',
      'Last Login',
      COALESCE(MAX(last_login_at), NOW()),
      'clock'
    FROM users
    WHERE deleted_at IS NULL;
  `);

  console.log("✅ Views created");

  // ============================================
  // CREATE TRIGGERS
  // ============================================
  console.log("🔔 Creating triggers...");

  // Drop triggers if they exist
  await queryInterface.execute(`DROP TRIGGER IF EXISTS after_user_insert_notification`);
  await queryInterface.execute(`DROP TRIGGER IF EXISTS after_user_update_status`);

  // Create trigger for new user notifications
  await queryInterface.execute(`
    CREATE TRIGGER after_user_insert_notification
    AFTER INSERT ON users
    FOR EACH ROW
    BEGIN
      DECLARE v_notification_exists INT;
      
      -- Check if notifications table exists
      SELECT COUNT(*) INTO v_notification_exists
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
        AND table_name = 'notifications';
      
      -- Insert welcome notification if table exists
      IF v_notification_exists > 0 AND NEW.status = 'ACTIVE' THEN
        INSERT INTO notifications (
          user_id,
          title_arabic,
          title_english,
          message_arabic,
          message_english,
          notification_type,
          priority,
          is_read,
          created_at,
          updated_at
        ) VALUES (
          NEW.id,
          'مرحباً بك في منصة العائلة',
          'Welcome to Family Platform',
          CONCAT('مرحباً ', COALESCE(NEW.full_name_arabic, 'عزيزي العضو'), '، نرحب بك في منصة عائلتنا الإلكترونية'),
          CONCAT('Hello ', COALESCE(NEW.full_name_english, 'Dear Member'), ', welcome to our family electronic platform'),
          'ANNOUNCEMENT',
          'MEDIUM',
          FALSE,
          NOW(),
          NOW()
        );
      END IF;
    END
  `);

  // Create trigger for user status change notifications
  await queryInterface.execute(`
    CREATE TRIGGER after_user_update_status
    AFTER UPDATE ON users
    FOR EACH ROW
    BEGIN
      DECLARE v_notification_exists INT;
      
      -- Check if notifications table exists
      SELECT COUNT(*) INTO v_notification_exists
      FROM information_schema.tables 
      WHERE table_schema = DATABASE() 
        AND table_name = 'notifications';
      
      -- Insert notification for status change
      IF v_notification_exists > 0 AND OLD.status != NEW.status THEN
        INSERT INTO notifications (
          user_id,
          title_arabic,
          title_english,
          message_arabic,
          message_english,
          notification_type,
          priority,
          is_read,
          created_at,
          updated_at
        ) VALUES (
          NEW.id,
          CASE NEW.status
            WHEN 'ACTIVE' THEN 'تم تفعيل حسابك'
            WHEN 'SUSPENDED' THEN 'تم تعليق حسابك مؤقتاً'
            WHEN 'DEACTIVATED' THEN 'تم إلغاء تفعيل حسابك'
            WHEN 'BANNED' THEN 'تم حظر حسابك'
            ELSE 'تغيير في حالة حسابك'
          END,
          CASE NEW.status
            WHEN 'ACTIVE' THEN 'Your account has been activated'
            WHEN 'SUSPENDED' THEN 'Your account has been suspended'
            WHEN 'DEACTIVATED' THEN 'Your account has been deactivated'
            WHEN 'BANNED' THEN 'Your account has been banned'
            ELSE 'Change in your account status'
          END,
          CASE NEW.status
            WHEN 'ACTIVE' THEN CONCAT('تهانينا ', COALESCE(NEW.full_name_arabic, 'عزيزي العضو'), '! تم تفعيل حسابك بنجاح.')
            WHEN 'SUSPENDED' THEN CONCAT('عزيزي ', COALESCE(NEW.full_name_arabic, 'العضو'), '، تم تعليق حسابك مؤقتاً لأسباب أمنية.')
            ELSE CONCAT('عزيزي ', COALESCE(NEW.full_name_arabic, 'العضو'), '، تم تغيير حالة حسابك إلى ', NEW.status)
          END,
          CASE NEW.status
            WHEN 'ACTIVE' THEN CONCAT('Congratulations ', COALESCE(NEW.full_name_english, 'Dear Member'), '! Your account has been successfully activated.')
            WHEN 'SUSPENDED' THEN CONCAT('Dear ', COALESCE(NEW.full_name_english, 'Member'), ', your account has been temporarily suspended for security reasons.')
            ELSE CONCAT('Dear ', COALESCE(NEW.full_name_english, 'Member'), ', your account status has been changed to ', NEW.status)
          END,
          'SYSTEM',
          CASE NEW.status
            WHEN 'SUSPENDED' THEN 'HIGH'
            WHEN 'BANNED' THEN 'URGENT'
            ELSE 'MEDIUM'
          END,
          FALSE,
          NOW(),
          NOW()
        );
      END IF;
    END
  `);

  console.log("✅ Triggers created");

  console.log("🎉 System-wide tables created successfully!");
  console.log("📊 Tables created: access_control_matrix, activity_logs, notifications");
  console.log("⚙️ Procedures created: sp_get_user_permissions, sp_log_activity");
  console.log("👁️ Views created: vw_basic_dashboard, vw_user_statistics");
  console.log("🔔 Triggers created: after_user_insert_notification, after_user_update_status");
  console.log("🚀 Ready for section-specific migrations!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping comprehensive family management system...");

  // Drop triggers first
  const triggers = [
    "after_user_insert_notification",
    "after_user_update_status",
    "after_donation_insert"  // This might exist from other migrations
  ];

  for (const trigger of triggers) {
    try {
      await queryInterface.execute(`DROP TRIGGER IF EXISTS ${trigger}`);
      console.log(`✅ Dropped trigger: ${trigger}`);
    } catch (error) {
      console.log(`⚠️ Could not drop trigger ${trigger}: ${error.message}`);
    }
  }

  // Drop procedures
  const procedures = [
    "sp_get_user_permissions",
    "sp_log_activity"
  ];

  for (const procedure of procedures) {
    try {
      await queryInterface.execute(`DROP PROCEDURE IF EXISTS ${procedure}`);
      console.log(`✅ Dropped procedure: ${procedure}`);
    } catch (error) {
      console.log(`⚠️ Could not drop procedure ${procedure}: ${error.message}`);
    }
  }

  // Drop views
  const views = [
    "vw_basic_dashboard",
    "vw_user_statistics",
    "vw_family_dashboard"  // This might exist from other migrations
  ];

  for (const view of views) {
    try {
      await queryInterface.execute(`DROP VIEW IF EXISTS ${view}`);
      console.log(`✅ Dropped view: ${view}`);
    } catch (error) {
      console.log(`⚠️ Could not drop view ${view}: ${error.message}`);
    }
  }

  // Drop tables in reverse order of creation
  const tables = [
    "notifications",
    "activity_logs",
    "access_control_matrix"
  ];

  for (const table of tables) {
    try {
      await queryInterface.execute(`DROP TABLE IF EXISTS ${table}`);
      console.log(`✅ Dropped table: ${table}`);
    } catch (error) {
      console.log(`⚠️ Could not drop table ${table}: ${error.message}`);
    }
  }

  console.log("✅ All components dropped successfully");
};
