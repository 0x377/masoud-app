/**
 * Migration: create_executive_table - CORRECTED VERSION
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 5: Executive Management...");

  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS executive_management (
      executive_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      position_arabic VARCHAR(255) NOT NULL,
      position_english VARCHAR(255),
      position_level INT DEFAULT 1 COMMENT '1 = Executive Director, 2 = Deputy, 3 = Manager, etc.',
      department_arabic VARCHAR(255),
      department_english VARCHAR(255),
      start_date DATE NOT NULL,
      end_date DATE,
      is_current BOOLEAN DEFAULT TRUE,
      responsibilities_arabic TEXT,
      responsibilities_english TEXT,
      reporting_to CHAR(36) COMMENT 'Reports to which executive',
      decision_authority JSON COMMENT 'Decision-making authority levels',
      signature_path VARCHAR(500),
      photo_path VARCHAR(500),
      office_location VARCHAR(500),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      assistant_id CHAR(36),
      salary_band VARCHAR(100) COMMENT 'Salary range or band',
      performance_review_date DATE,
      achievements JSON,
      challenges TEXT,
      goals JSON COMMENT 'Performance goals',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_executive_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_executive_reporting 
        FOREIGN KEY (reporting_to) 
        REFERENCES executive_management(executive_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_executive_assistant 
        FOREIGN KEY (assistant_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_executive_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_user_current (user_id, is_current),
      
      INDEX idx_position_level (position_level),
      INDEX idx_is_current (is_current),
      INDEX idx_department_arabic (department_arabic),
      INDEX idx_dates (start_date, end_date),
      INDEX idx_reporting_to (reporting_to),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ executive_management table created");

  // Executive Decisions Log
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS executive_decisions (
      decision_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      executive_id CHAR(36) NOT NULL,
      decision_type ENUM('STRATEGIC', 'OPERATIONAL', 'FINANCIAL', 'PERSONNEL', 'OTHER') NOT NULL,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      description TEXT,
      decision_date DATE NOT NULL,
      implementation_deadline DATE,
      status ENUM('PENDING', 'APPROVED', 'IMPLEMENTED', 'REJECTED', 'DEFERRED') DEFAULT 'PENDING',
      impact_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
      affected_departments JSON,
      budget_impact DECIMAL(15,2) COMMENT 'Financial impact if any',
      supporting_documents JSON,
      meeting_reference VARCHAR(100),
      voting_results JSON COMMENT 'If voted on',
      follow_up_actions JSON,
      notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_decision_executive 
        FOREIGN KEY (executive_id) 
        REFERENCES executive_management(executive_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_decision_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_executive_id (executive_id),
      INDEX idx_decision_type (decision_type),
      INDEX idx_decision_date (decision_date),
      INDEX idx_status (status),
      INDEX idx_impact_level (impact_level),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ executive_decisions table created");

  // Executive Performance Reviews
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS executive_performance_reviews (
      review_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      executive_id CHAR(36) NOT NULL,
      review_period_start DATE NOT NULL,
      review_period_end DATE NOT NULL,
      reviewer_id CHAR(36) NOT NULL COMMENT 'Who conducted the review',
      review_date DATE NOT NULL,
      performance_rating DECIMAL(3,1) COMMENT 'Rating out of 5',
      strengths_arabic TEXT,
      strengths_english TEXT,
      areas_for_improvement_arabic TEXT,
      areas_for_improvement_english TEXT,
      goals_achieved JSON,
      goals_not_achieved JSON,
      recommendations TEXT,
      salary_adjustment_percentage DECIMAL(5,2),
      bonus_amount DECIMAL(15,2),
      promotion_recommended BOOLEAN DEFAULT FALSE,
      next_review_date DATE,
      employee_comments TEXT,
      employee_signature_date DATE,
      reviewer_signature_date DATE,
      status ENUM('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'ARCHIVED') DEFAULT 'DRAFT',
      documents JSON,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_review_executive 
        FOREIGN KEY (executive_id) 
        REFERENCES executive_management(executive_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_review_reviewer 
        FOREIGN KEY (reviewer_id) 
        REFERENCES users(id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_review_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_executive_period (executive_id, review_period_start, review_period_end),
      
      INDEX idx_executive_id (executive_id),
      INDEX idx_reviewer_id (reviewer_id),
      INDEX idx_review_date (review_date),
      INDEX idx_status (status),
      INDEX idx_performance_rating (performance_rating),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ executive_performance_reviews table created");

  // Executive Meeting Attendance
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS executive_meeting_attendance (
      attendance_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      executive_id CHAR(36) NOT NULL,
      meeting_type ENUM('BOARD', 'EXECUTIVE', 'DEPARTMENTAL', 'STRATEGIC', 'OTHER') NOT NULL,
      meeting_date DATE NOT NULL,
      meeting_title_arabic VARCHAR(255),
      meeting_title_english VARCHAR(255),
      duration_hours DECIMAL(4,2),
      location VARCHAR(500),
      attendance_status ENUM('PRESENT', 'ABSENT', 'LATE', 'EXCUSED', 'REMOTE') DEFAULT 'PRESENT',
      minutes_path VARCHAR(500),
      decisions_made JSON,
      action_items JSON COMMENT 'Action items assigned to executive',
      preparation_rating ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR') COMMENT 'Quality of preparation',
      participation_rating ENUM('EXCELLENT', 'GOOD', 'FAIR', 'POOR') COMMENT 'Quality of participation',
      notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_attendance_executive 
        FOREIGN KEY (executive_id) 
        REFERENCES executive_management(executive_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_attendance_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_executive_id (executive_id),
      INDEX idx_meeting_date (meeting_date),
      INDEX idx_meeting_type (meeting_type),
      INDEX idx_attendance_status (attendance_status),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ executive_meeting_attendance table created");

  // Executive Reports
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS executive_reports (
      report_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      executive_id CHAR(36) NOT NULL,
      report_type ENUM('MONTHLY', 'QUARTERLY', 'ANNUAL', 'PROGRESS', 'PERFORMANCE', 'FINANCIAL', 'STRATEGIC') NOT NULL,
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      report_content TEXT,
      key_achievements JSON,
      challenges_faced JSON,
      financial_summary JSON,
      personnel_updates JSON,
      recommendations JSON,
      file_path VARCHAR(500),
      approval_status ENUM('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
      approved_by CHAR(36),
      approval_date DATE,
      next_report_due DATE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_report_executive 
        FOREIGN KEY (executive_id) 
        REFERENCES executive_management(executive_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_report_approved_by 
        FOREIGN KEY (approved_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_report_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_executive_id (executive_id),
      INDEX idx_report_type (report_type),
      INDEX idx_period (period_start, period_end),
      INDEX idx_approval_status (approval_status),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ executive_reports table created");

  // Insert default executive roles
  await queryInterface.execute(`
    INSERT INTO executive_management (
      executive_id, user_id, position_arabic, position_english, 
      position_level, start_date, is_current
    ) VALUES (
      UUID(),
      (SELECT id FROM users WHERE user_type = 'EXECUTIVE' AND status = 'ACTIVE' LIMIT 1),
      'المدير التنفيذي',
      'Executive Director',
      1,
      CURDATE(),
      TRUE
    );
  `);

  console.log("✅ Default executive role inserted");

  console.log("✅ Section 5 Executive Management created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping Section 5: Executive Management tables...");

  // Drop tables in reverse order (child tables first)
  await queryInterface.execute("DROP TABLE IF EXISTS executive_reports");
  await queryInterface.execute(
    "DROP TABLE IF EXISTS executive_meeting_attendance",
  );
  await queryInterface.execute(
    "DROP TABLE IF EXISTS executive_performance_reviews",
  );
  await queryInterface.execute("DROP TABLE IF EXISTS executive_decisions");
  await queryInterface.execute("DROP TABLE IF EXISTS executive_management");

  console.log("✅ Section 5 tables dropped successfully");
};
