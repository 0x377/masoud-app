/**
 * Migration: create_social_table
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 7: Social Committee...");

  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS social_committee (
      committee_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL DEFAULT 'اللجنة الاجتماعية',
      name_english VARCHAR(255) DEFAULT 'Social Committee',
      description TEXT,
      formation_date DATE,
      members JSON COMMENT 'Committee members with roles',
      objectives JSON,
      annual_budget DECIMAL(15,2),
      current_balance DECIMAL(15,2) DEFAULT 0,
      meeting_schedule JSON,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      INDEX idx_formation_date (formation_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Social Programs
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS social_programs (
      program_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      program_type ENUM('MARRIAGE_AID', 'FAMILY_AID', 'EDUCATION_AID', 'HEALTH_AID', 'HOUSING_AID', 'OTHER') NOT NULL,
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      description TEXT,
      eligibility_criteria JSON,
      required_documents JSON,
      aid_amount DECIMAL(15,2) COMMENT 'Standard aid amount',
      max_amount DECIMAL(15,2) COMMENT 'Maximum aid amount',
      annual_budget DECIMAL(15,2),
      remaining_budget DECIMAL(15,2),
      application_deadline DATE,
      status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'COMPLETED') DEFAULT 'ACTIVE',
      application_form_path VARCHAR(500),
      guidelines_path VARCHAR(500),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_program_type (program_type),
      INDEX idx_status (status),
      INDEX idx_application_deadline (application_deadline)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

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
        REFERENCES persons(person_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_application_reviewer 
        FOREIGN KEY (reviewed_by) 
        REFERENCES persons(person_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_program_id (program_id),
      INDEX idx_applicant_id (applicant_id),
      INDEX idx_status (status),
      INDEX idx_application_date (application_date),
      INDEX idx_disbursement_date (disbursement_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Section 7 created");
};

export const down = async (queryInterface) => {
  // Write your migration DOWN logic here
  // This should reverse what up() does
  // Example:
  // await queryInterface.execute('DROP TABLE IF EXISTS users');
};
