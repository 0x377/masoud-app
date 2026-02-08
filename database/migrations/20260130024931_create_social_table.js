/**
 * Migration: create_social_table - FIXED VERSION
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 7: Social Committee...");

  // Social Committee
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS social_committee (
      committee_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL DEFAULT 'اللجنة الاجتماعية',
      name_english VARCHAR(255) DEFAULT 'Social Committee',
      description_arabic TEXT,
      description_english TEXT,
      formation_date DATE,
      members JSON COMMENT 'Committee members with roles (user_id, role, start_date, end_date)',
      objectives_arabic JSON,
      objectives_english JSON,
      annual_budget DECIMAL(15,2),
      current_balance DECIMAL(15,2) DEFAULT 0,
      meeting_schedule JSON,
      contact_person_id CHAR(36),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      office_location VARCHAR(500),
      logo_path VARCHAR(500),
      status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED') DEFAULT 'ACTIVE',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_social_contact_person 
        FOREIGN KEY (contact_person_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,

      CONSTRAINT fk_social_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,

      INDEX idx_formation_date (formation_date),
      INDEX idx_status (status),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ social_committee table created");

  // Social Programs
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS social_programs (
      program_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      program_type ENUM('MARRIAGE_AID', 'FAMILY_AID', 'EDUCATION_AID', 'HEALTH_AID', 'HOUSING_AID', 'RAMADAN_AID', 'EID_AID', 'OTHER') NOT NULL,
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      description_arabic TEXT,
      description_english TEXT,
      eligibility_criteria_arabic JSON,
      eligibility_criteria_english JSON,
      required_documents JSON,
      aid_amount DECIMAL(15,2) COMMENT 'Standard aid amount',
      max_amount DECIMAL(15,2) COMMENT 'Maximum aid amount',
      annual_budget DECIMAL(15,2),
      remaining_budget DECIMAL(15,2) DEFAULT 0,
      application_start_date DATE,
      application_deadline DATE,
      implementation_start_date DATE,
      implementation_end_date DATE,
      status ENUM('PLANNING', 'ACTIVE', 'SUSPENDED', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNING',
      application_form_path VARCHAR(500),
      guidelines_path VARCHAR(500),
      program_manager_id CHAR(36),
      committee_id CHAR(36),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_program_manager 
        FOREIGN KEY (program_manager_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_program_committee 
        FOREIGN KEY (committee_id) 
        REFERENCES social_committee(committee_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_program_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_program_type (program_type),
      INDEX idx_status (status),
      INDEX idx_application_deadline (application_deadline),
      INDEX idx_committee_id (committee_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ social_programs table created");

  // Social Program Applications
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS social_program_applications (
      application_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      program_id CHAR(36) NOT NULL,
      applicant_id CHAR(36) NOT NULL,
      application_date DATE NOT NULL,
      status ENUM('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'DISBURSED', 'COMPLETED') DEFAULT 'DRAFT',
      requested_amount DECIMAL(15,2),
      approved_amount DECIMAL(15,2),
      disbursement_date DATE,
      application_data JSON COMMENT 'Form data filled by applicant',
      supporting_documents JSON,
      review_notes TEXT,
      reviewed_by CHAR(36),
      review_date DATE,
      rejection_reason TEXT,
      disbursement_method ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE') DEFAULT 'BANK_TRANSFER',
      disbursement_reference VARCHAR(100),
      follow_up_required BOOLEAN DEFAULT FALSE,
      follow_up_notes TEXT,
      follow_up_date DATE,
      beneficiary_name VARCHAR(255) COMMENT 'If different from applicant',
      beneficiary_relationship VARCHAR(100) COMMENT 'Relationship to applicant',
      special_circumstances TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_application_program 
        FOREIGN KEY (program_id) 
        REFERENCES social_programs(program_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_application_applicant 
        FOREIGN KEY (applicant_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_application_reviewer 
        FOREIGN KEY (reviewed_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_application_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_program_id (program_id),
      INDEX idx_applicant_id (applicant_id),
      INDEX idx_status (status),
      INDEX idx_application_date (application_date),
      INDEX idx_disbursement_date (disbursement_date),
      INDEX idx_reviewed_by (reviewed_by),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ social_program_applications table created");

  // Social Events
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS social_events (
      event_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      committee_id CHAR(36),
      event_type ENUM('FAMILY_GATHERING', 'WEDDING', 'EID_PARTY', 'RAMADAN_IFTAR', 'CHARITY_EVENT', 'EDUCATIONAL', 'SPORTS', 'OTHER') NOT NULL,
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      description_arabic TEXT,
      description_english TEXT,
      event_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      location VARCHAR(500),
      estimated_attendees INT,
      actual_attendees INT,
      budget DECIMAL(15,2),
      actual_cost DECIMAL(15,2),
      organizer_id CHAR(36),
      status ENUM('PLANNING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNING',
      photos JSON,
      videos JSON,
      feedback_summary TEXT,
      lessons_learned TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_event_committee 
        FOREIGN KEY (committee_id) 
        REFERENCES social_committee(committee_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_event_organizer 
        FOREIGN KEY (organizer_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_event_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_committee_id (committee_id),
      INDEX idx_event_type (event_type),
      INDEX idx_event_date (event_date),
      INDEX idx_status (status),
      INDEX idx_organizer_id (organizer_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ social_events table created");

  // Social Beneficiaries Registry
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS social_beneficiaries (
      beneficiary_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      beneficiary_type ENUM('NEEDY_FAMILY', 'ORPHAN', 'STUDENT', 'PATIENT', 'ELDERLY', 'OTHER') NOT NULL,
      support_level ENUM('CRITICAL', 'HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM',
      monthly_support_amount DECIMAL(15,2),
      support_start_date DATE,
      support_end_date DATE,
      support_reasons JSON,
      special_needs TEXT,
      assigned_case_manager_id CHAR(36),
      case_notes TEXT,
      status ENUM('ACTIVE', 'SUSPENDED', 'COMPLETED', 'DECEASED') DEFAULT 'ACTIVE',
      last_assessment_date DATE,
      next_assessment_date DATE,
      total_aid_received DECIMAL(15,2) DEFAULT 0,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_beneficiary_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_beneficiary_case_manager 
        FOREIGN KEY (assigned_case_manager_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_beneficiary_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_user_beneficiary (user_id, beneficiary_type),
      
      INDEX idx_user_id (user_id),
      INDEX idx_beneficiary_type (beneficiary_type),
      INDEX idx_support_level (support_level),
      INDEX idx_status (status),
      INDEX idx_case_manager (assigned_case_manager_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ social_beneficiaries table created");

  // Insert default social committee
  await queryInterface.execute(`
    INSERT INTO social_committee (
      committee_id, name_arabic, name_english, 
      formation_date, status
    ) VALUES (
      UUID(),
      'اللجنة الاجتماعية',
      'Social Committee',
      CURDATE(),
      'ACTIVE'
    );
  `);

  console.log("✅ Default social committee inserted");

  // Insert default social programs
  await queryInterface.execute(`
    INSERT INTO social_programs (
      program_id, program_type, name_arabic, name_english,
      description_arabic, status, annual_budget, remaining_budget
    ) VALUES (
      UUID(),
      'MARRIAGE_AID',
      'مساعدات الزواج',
      'Marriage Aid',
      'برنامج لدعم شباب العائلة في تكاليف الزواج',
      'ACTIVE',
      500000.00,
      500000.00
    ), (
      UUID(),
      'EDUCATION_AID',
      'مساعدات التعليم',
      'Education Aid',
      'برنامج لدعم الطلاب والطالبات في مصاريف التعليم',
      'ACTIVE',
      300000.00,
      300000.00
    ), (
      UUID(),
      'RAMADAN_AID',
      'إعانة رمضان',
      'Ramadan Aid',
      'برنامج توزيع السلال الغذائية في شهر رمضان',
      'ACTIVE',
      200000.00,
      200000.00
    );
  `);

  console.log("✅ Default social programs inserted");

  console.log("✅ Section 7 Social Committee created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping Section 7: Social Committee tables...");

  // Drop tables in reverse order (child tables first)
  await queryInterface.execute("DROP TABLE IF EXISTS social_beneficiaries");
  await queryInterface.execute("DROP TABLE IF EXISTS social_events");
  await queryInterface.execute(
    "DROP TABLE IF EXISTS social_program_applications",
  );
  await queryInterface.execute("DROP TABLE IF EXISTS social_programs");
  await queryInterface.execute("DROP TABLE IF EXISTS social_committee");

  console.log("✅ Section 7 tables dropped successfully");
};
