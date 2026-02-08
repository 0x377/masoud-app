/**
 * Migration: create_reconciliation_table - FIXED VERSION
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 9: Reconciliation Committee...");

  // Reconciliation Committee
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS reconciliation_committee (
      committee_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL DEFAULT 'لجنة إصلاح ذات البين',
      name_english VARCHAR(255) DEFAULT 'Reconciliation Committee',
      description TEXT,
      chairman_id CHAR(36),
      formation_date DATE,
      members JSON,
      principles TEXT,
      procedures JSON,
      success_rate DECIMAL(5,2),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

      CONSTRAINT fk_reconciliation_chairman 
        FOREIGN KEY (chairman_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_reconciliation_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_formation_date (formation_date),
      INDEX idx_chairman_id (chairman_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ reconciliation_committee table created");

  // Reconciliation Cases
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS reconciliation_cases (
      case_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      case_number VARCHAR(50) UNIQUE,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      case_type ENUM('FAMILY_DISPUTE', 'FINANCIAL_DISPUTE', 'INHERITANCE', 'MARITAL', 'BUSINESS', 'OTHER') NOT NULL,
      description TEXT,
      plaintiff_id CHAR(36),
      defendant_id CHAR(36),
      mediator_id CHAR(36),
      filing_date DATE,
      status ENUM('NEW', 'ASSIGNED', 'IN_PROGRESS', 'MEDIATION', 'SETTLED', 'DISMISSED', 'ESCALATED') DEFAULT 'NEW',
      priority ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT') DEFAULT 'MEDIUM',
      confidential_level ENUM('LOW', 'MEDIUM', 'HIGH', 'TOP_SECRET') DEFAULT 'MEDIUM',
      settlement_amount DECIMAL(15,2),
      settlement_date DATE,
      settlement_terms TEXT,
      follow_up_required BOOLEAN DEFAULT FALSE,
      follow_up_date DATE,
      documents JSON,
      notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_case_plaintiff 
        FOREIGN KEY (plaintiff_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_case_defendant 
        FOREIGN KEY (defendant_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_case_mediator 
        FOREIGN KEY (mediator_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_case_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_case_number (case_number),
      INDEX idx_case_type (case_type),
      INDEX idx_status (status),
      INDEX idx_priority (priority),
      INDEX idx_filing_date (filing_date),
      INDEX idx_plaintiff (plaintiff_id),
      INDEX idx_defendant (defendant_id),
      INDEX idx_mediator (mediator_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ reconciliation_cases table created");

  // Case Sessions
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS case_sessions (
      session_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      case_id CHAR(36) NOT NULL,
      session_date DATE NOT NULL,
      session_time TIME,
      location VARCHAR(500),
      session_type ENUM('INITIAL', 'MEDIATION', 'SETTLEMENT', 'FOLLOW_UP', 'OTHER') DEFAULT 'INITIAL',
      attendees JSON,
      discussion_summary TEXT,
      agreements JSON,
      next_session_date DATE,
      documents JSON,
      notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_session_case 
        FOREIGN KEY (case_id) 
        REFERENCES reconciliation_cases(case_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_session_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_case_id (case_id),
      INDEX idx_session_date (session_date),
      INDEX idx_session_type (session_type),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ case_sessions table created");

  console.log("✅ Section 9 Reconciliation Committee created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping Section 9: Reconciliation Committee tables...");

  // Drop tables in reverse order (child tables first)
  await queryInterface.execute("DROP TABLE IF EXISTS case_sessions");
  await queryInterface.execute("DROP TABLE IF EXISTS reconciliation_cases");
  await queryInterface.execute("DROP TABLE IF EXISTS reconciliation_committee");

  console.log("✅ Section 9 tables dropped successfully");
};
