/**
 * Migration: create_family_waqf_tables
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Family Waqf Tables...");

  // Create family_waqf table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_waqf (
      waqf_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      description TEXT,
      waqf_type ENUM('CASH', 'PROPERTY', 'LAND', 'BUSINESS', 'OTHER') NOT NULL,
      establishment_date DATE,
      founder_id CHAR(36),
      current_value DECIMAL(15,2),
      estimated_annual_return DECIMAL(15,2),
      beneficiaries JSON COMMENT 'Who benefits from this waqf',
      management_committee JSON COMMENT 'Committee managing this waqf',
      documents JSON COMMENT 'Waqf documents and contracts',
      location JSON COMMENT 'Geographic location if property/land',
      status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LIQUIDATED') DEFAULT 'ACTIVE',
      income_distribution_rules JSON,
      special_conditions TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_waqf_founder 
        FOREIGN KEY (founder_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_waqf_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_waqf_type (waqf_type),
      INDEX idx_status (status),
      INDEX idx_establishment_date (establishment_date),
      INDEX idx_current_value (current_value),
      INDEX idx_created_by (created_by),
      FULLTEXT idx_waqf_search (name_arabic, name_english, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_waqf table created");

  // Create waqf_transactions table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS waqf_transactions (
      transaction_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      waqf_id CHAR(36) NOT NULL,
      transaction_type ENUM('INCOME', 'EXPENSE', 'INVESTMENT', 'DISTRIBUTION', 'VALUATION_UPDATE', 'TRANSFER') NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      currency CHAR(3) DEFAULT 'SAR',
      description TEXT,
      transaction_date DATE NOT NULL,
      reference_number VARCHAR(100),
      bank_statement_path VARCHAR(500),
      category VARCHAR(100),
      beneficiary_id CHAR(36) COMMENT 'If distribution to beneficiary',
      approved_by CHAR(36),
      approval_date DATE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_transaction_waqf 
        FOREIGN KEY (waqf_id) 
        REFERENCES family_waqf(waqf_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_transaction_beneficiary 
        FOREIGN KEY (beneficiary_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_transaction_approver 
        FOREIGN KEY (approved_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_transaction_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_waqf_id (waqf_id),
      INDEX idx_transaction_type (transaction_type),
      INDEX idx_transaction_date (transaction_date),
      INDEX idx_amount (amount),
      INDEX idx_category (category),
      INDEX idx_approved_by (approved_by),
      INDEX idx_beneficiary_id (beneficiary_id),
      INDEX idx_reference_number (reference_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ waqf_transactions table created");

  // Create waqf_beneficiaries table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS waqf_beneficiaries (
      beneficiary_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      waqf_id CHAR(36) NOT NULL,
      person_id CHAR(36) NOT NULL,
      relationship ENUM('FAMILY_MEMBER', 'ORPHAN', 'STUDENT', 'NEEDY', 'OTHER') DEFAULT 'FAMILY_MEMBER',
      share_percentage DECIMAL(5,2) COMMENT 'Percentage share of waqf income',
      share_amount DECIMAL(15,2) COMMENT 'Fixed amount if applicable',
      distribution_frequency ENUM('MONTHLY', 'QUARTERLY', 'BIANNUALLY', 'ANNUALLY', 'ON_DEMAND') DEFAULT 'MONTHLY',
      start_date DATE,
      end_date DATE,
      special_conditions TEXT,
      status ENUM('ACTIVE', 'SUSPENDED', 'TERMINATED') DEFAULT 'ACTIVE',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_waqf_person (waqf_id, person_id),
      
      CONSTRAINT fk_beneficiary_waqf 
        FOREIGN KEY (waqf_id) 
        REFERENCES family_waqf(waqf_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_beneficiary_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_beneficiary_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_waqf_id (waqf_id),
      INDEX idx_person_id (person_id),
      INDEX idx_status (status),
      INDEX idx_relationship (relationship),
      INDEX idx_distribution_frequency (distribution_frequency)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ waqf_beneficiaries table created");

  // Create waqf_management_committee table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS waqf_management_committee (
      committee_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      waqf_id CHAR(36) NOT NULL,
      person_id CHAR(36) NOT NULL,
      role ENUM('CHAIRPERSON', 'VICE_CHAIRPERSON', 'TREASURER', 'SECRETARY', 'MEMBER', 'AUDITOR', 'ADVISOR') DEFAULT 'MEMBER',
      start_date DATE NOT NULL,
      end_date DATE,
      responsibilities TEXT,
      is_active BOOLEAN DEFAULT TRUE,
      meeting_attendance JSON COMMENT 'Attendance records',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_waqf_person_role (waqf_id, person_id, role),
      
      CONSTRAINT fk_committee_waqf 
        FOREIGN KEY (waqf_id) 
        REFERENCES family_waqf(waqf_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_committee_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_committee_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_waqf_id (waqf_id),
      INDEX idx_person_id (person_id),
      INDEX idx_role (role),
      INDEX idx_is_active (is_active),
      INDEX idx_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ waqf_management_committee table created");

  // Create waqf_documents table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS waqf_documents (
      document_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      waqf_id CHAR(36) NOT NULL,
      document_type ENUM('DEED', 'CONTRACT', 'LAND_TITLE', 'FINANCIAL_STATEMENT', 'AUDIT_REPORT', 'LEGAL_OPINION', 'OTHER') NOT NULL,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      file_path VARCHAR(500) NOT NULL,
      file_size INT,
      file_type VARCHAR(50),
      version VARCHAR(20),
      is_verified BOOLEAN DEFAULT FALSE,
      verified_by CHAR(36),
      verified_at TIMESTAMP NULL,
      valid_from DATE,
      valid_until DATE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_document_waqf 
        FOREIGN KEY (waqf_id) 
        REFERENCES family_waqf(waqf_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_document_verified_by 
        FOREIGN KEY (verified_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_document_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_waqf_id (waqf_id),
      INDEX idx_document_type (document_type),
      INDEX idx_is_verified (is_verified),
      INDEX idx_valid_until (valid_until),
      FULLTEXT idx_document_search (title, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ waqf_documents table created");

  // Create waqf_investments table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS waqf_investments (
      investment_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      waqf_id CHAR(36) NOT NULL,
      investment_type ENUM('REAL_ESTATE', 'STOCKS', 'BONDS', 'BUSINESS', 'SAVINGS_ACCOUNT', 'MUTUAL_FUNDS', 'OTHER') NOT NULL,
      investment_name VARCHAR(255) NOT NULL,
      description TEXT,
      investment_date DATE NOT NULL,
      initial_amount DECIMAL(15,2) NOT NULL,
      current_value DECIMAL(15,2),
      expected_return_percentage DECIMAL(5,2),
      risk_level ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM',
      status ENUM('ACTIVE', 'MATURED', 'SOLD', 'LIQUIDATED', 'DEFAULTED') DEFAULT 'ACTIVE',
      maturity_date DATE,
      sale_date DATE,
      sale_amount DECIMAL(15,2),
      documents JSON COMMENT 'Investment documents',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_investment_waqf 
        FOREIGN KEY (waqf_id) 
        REFERENCES family_waqf(waqf_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_investment_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_waqf_id (waqf_id),
      INDEX idx_investment_type (investment_type),
      INDEX idx_status (status),
      INDEX idx_investment_date (investment_date),
      INDEX idx_risk_level (risk_level),
      INDEX idx_maturity_date (maturity_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ waqf_investments table created");

  // Create waqf_audit_log table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS waqf_audit_log (
      log_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      waqf_id CHAR(36) NOT NULL,
      action_type ENUM('CREATE', 'UPDATE', 'DELETE', 'APPROVE', 'REJECT', 'DISTRIBUTE', 'INVEST', 'VALUATE') NOT NULL,
      action_description TEXT NOT NULL,
      table_name VARCHAR(100) NOT NULL,
      record_id CHAR(36) NOT NULL,
      old_values JSON,
      new_values JSON,
      performed_by CHAR(36),
      performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ip_address VARCHAR(45),
      user_agent TEXT,
      metadata JSON,
      
      CONSTRAINT fk_audit_log_waqf 
        FOREIGN KEY (waqf_id) 
        REFERENCES family_waqf(waqf_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_audit_log_performed_by 
        FOREIGN KEY (performed_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_waqf_id (waqf_id),
      INDEX idx_action_type (action_type),
      INDEX idx_table_name (table_name),
      INDEX idx_performed_at (performed_at),
      INDEX idx_performed_by (performed_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ waqf_audit_log table created");

  // Create waqf_financial_summary view (via trigger/table pattern)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS waqf_financial_summary (
      summary_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      waqf_id CHAR(36) NOT NULL,
      period_type ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUALLY') DEFAULT 'MONTHLY',
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      total_income DECIMAL(15,2) DEFAULT 0,
      total_expenses DECIMAL(15,2) DEFAULT 0,
      total_distributions DECIMAL(15,2) DEFAULT 0,
      total_investments DECIMAL(15,2) DEFAULT 0,
      net_income DECIMAL(15,2) DEFAULT 0,
      cash_balance DECIMAL(15,2) DEFAULT 0,
      asset_value DECIMAL(15,2) DEFAULT 0,
      liability_value DECIMAL(15,2) DEFAULT 0,
      net_worth DECIMAL(15,2) DEFAULT 0,
      metadata JSON,
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_waqf_period (waqf_id, period_type, period_start),
      
      CONSTRAINT fk_summary_waqf 
        FOREIGN KEY (waqf_id) 
        REFERENCES family_waqf(waqf_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      INDEX idx_period (period_type, period_start),
      INDEX idx_calculated_at (calculated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ waqf_financial_summary table created");

  // Create triggers for waqf transactions
  await queryInterface.execute(`
    CREATE TRIGGER after_waqf_transaction_insert
    AFTER INSERT ON waqf_transactions
    FOR EACH ROW
    BEGIN
      -- Update waqf current value for certain transaction types
      IF NEW.transaction_type IN ('INCOME', 'INVESTMENT', 'VALUATION_UPDATE') THEN
        UPDATE family_waqf 
        SET current_value = current_value + NEW.amount,
            updated_at = NOW()
        WHERE waqf_id = NEW.waqf_id;
      ELSEIF NEW.transaction_type IN ('EXPENSE', 'DISTRIBUTION') THEN
        UPDATE family_waqf 
        SET current_value = current_value - NEW.amount,
            updated_at = NOW()
        WHERE waqf_id = NEW.waqf_id;
      END IF;
      
      -- Log the transaction
      INSERT INTO waqf_audit_log (
        log_id, waqf_id, action_type, action_description, 
        table_name, record_id, performed_by, performed_at
      ) VALUES (
        UUID(),
        NEW.waqf_id,
        'CREATE',
        CONCAT('New ', NEW.transaction_type, ' transaction of ', NEW.amount, ' ', NEW.currency),
        'waqf_transactions',
        NEW.transaction_id,
        NEW.created_by,
        NOW()
      );
    END;
  `);

  await queryInterface.execute(`
    CREATE TRIGGER before_waqf_transaction_delete
    BEFORE DELETE ON waqf_transactions
    FOR EACH ROW
    BEGIN
      -- Log the deletion attempt
      INSERT INTO waqf_audit_log (
        log_id, waqf_id, action_type, action_description, 
        table_name, record_id, performed_by, performed_at
      ) VALUES (
        UUID(),
        OLD.waqf_id,
        'DELETE',
        CONCAT('Attempt to delete transaction: ', OLD.transaction_type, ' of ', OLD.amount, ' ', OLD.currency),
        'waqf_transactions',
        OLD.transaction_id,
        OLD.created_by,
        NOW()
      );
      
      SIGNAL SQLSTATE '45000'
      SET MESSAGE_TEXT = 'Direct deletion of waqf transactions is not allowed. Use status updates instead.';
    END;
  `);

  console.log("✅ Waqf triggers created");

  // Insert sample waqf data for testing
  await queryInterface.execute(`
    INSERT INTO family_waqf (
      waqf_id, name_arabic, name_english, description, waqf_type, 
      establishment_date, current_value, estimated_annual_return, status
    ) VALUES (
      UUID(),
      'وقف الأسرة المسعودية',
      'Al Masoud Family Waqf',
      'وقف عائلي للأغراض الخيرية والتعليمية والصحية لأفراد العائلة',
      'CASH',
      '2020-01-01',
      1000000.00,
      50000.00,
      'ACTIVE'
    );
  `);

  console.log("✅ Sample waqf data inserted");

  console.log("🎉 All family waqf tables created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping family waqf tables...");

  // Drop triggers first
  await queryInterface.execute("DROP TRIGGER IF EXISTS before_waqf_transaction_delete");
  await queryInterface.execute("DROP TRIGGER IF EXISTS after_waqf_transaction_insert");

  // Drop tables in reverse order
  await queryInterface.execute("DROP TABLE IF EXISTS waqf_financial_summary");
  await queryInterface.execute("DROP TABLE IF EXISTS waqf_audit_log");
  await queryInterface.execute("DROP TABLE IF EXISTS waqf_investments");
  await queryInterface.execute("DROP TABLE IF EXISTS waqf_documents");
  await queryInterface.execute("DROP TABLE IF EXISTS waqf_management_committee");
  await queryInterface.execute("DROP TABLE IF EXISTS waqf_beneficiaries");
  await queryInterface.execute("DROP TABLE IF EXISTS waqf_transactions");
  await queryInterface.execute("DROP TABLE IF EXISTS family_waqf");

  console.log("✅ All family waqf tables dropped successfully");
};







// /**
//  * Migration: create_waqf_table
//  */

// export const up = async (queryInterface) => {
//   console.log("📦 Creating Section 3: Family Waqf...");

//   await queryInterface.execute(`
//     CREATE TABLE IF NOT EXISTS family_waqf (
//       waqf_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
//       name_arabic VARCHAR(255) NOT NULL,
//       name_english VARCHAR(255),
//       description TEXT,
//       waqf_type ENUM('CASH', 'PROPERTY', 'LAND', 'BUSINESS', 'OTHER') NOT NULL,
//       establishment_date DATE,
//       founder_id CHAR(36),
//       current_value DECIMAL(15,2),
//       estimated_annual_return DECIMAL(15,2),
//       beneficiaries JSON COMMENT 'Who benefits from this waqf',
//       management_committee JSON COMMENT 'Committee managing this waqf',
//       documents JSON COMMENT 'Waqf documents and contracts',
//       location JSON COMMENT 'Geographic location if property/land',
//       status ENUM('ACTIVE', 'INACTIVE', 'SUSPENDED', 'LIQUIDATED') DEFAULT 'ACTIVE',
//       income_distribution_rules JSON,
//       special_conditions TEXT,
//       metadata JSON,
//       created_by CHAR(36),
//       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
//       CONSTRAINT fk_waqf_founder 
//         FOREIGN KEY (founder_id) 
//         REFERENCES persons(person_id) 
//         ON DELETE SET NULL 
//         ON UPDATE CASCADE,
      
//       INDEX idx_waqf_type (waqf_type),
//       INDEX idx_status (status),
//       INDEX idx_establishment_date (establishment_date),
//       INDEX idx_current_value (current_value)
//     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
//   `);

//   // Waqf Transactions
//   await queryInterface.execute(`
//     CREATE TABLE IF NOT EXISTS waqf_transactions (
//       transaction_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
//       waqf_id CHAR(36) NOT NULL,
//       transaction_type ENUM('INCOME', 'EXPENSE', 'INVESTMENT', 'DISTRIBUTION') NOT NULL,
//       amount DECIMAL(15,2) NOT NULL,
//       currency CHAR(3) DEFAULT 'SAR',
//       description TEXT,
//       transaction_date DATE NOT NULL,
//       reference_number VARCHAR(100),
//       bank_statement_path VARCHAR(500),
//       category VARCHAR(100),
//       beneficiary_id CHAR(36) COMMENT 'If distribution to beneficiary',
//       approved_by CHAR(36),
//       approval_date DATE,
//       metadata JSON,
//       created_by CHAR(36),
//       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
//       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
//       CONSTRAINT fk_transaction_waqf 
//         FOREIGN KEY (waqf_id) 
//         REFERENCES family_waqf(waqf_id) 
//         ON DELETE CASCADE 
//         ON UPDATE CASCADE,
      
//       CONSTRAINT fk_transaction_beneficiary 
//         FOREIGN KEY (beneficiary_id) 
//         REFERENCES persons(person_id) 
//         ON DELETE SET NULL 
//         ON UPDATE CASCADE,
      
//       CONSTRAINT fk_transaction_approver 
//         FOREIGN KEY (approved_by) 
//         REFERENCES persons(person_id) 
//         ON DELETE SET NULL 
//         ON UPDATE CASCADE,
      
//       INDEX idx_waqf_id (waqf_id),
//       INDEX idx_transaction_type (transaction_type),
//       INDEX idx_transaction_date (transaction_date),
//       INDEX idx_amount (amount),
//       INDEX idx_category (category)
//     ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
//   `);

//   console.log("✅ Section 3 created");
// };

// export const down = async (queryInterface) => {
//   // Write your migration DOWN logic here
//   // This should reverse what up() does
//   // Example:
//   // await queryInterface.execute('DROP TABLE IF EXISTS users');
// };
