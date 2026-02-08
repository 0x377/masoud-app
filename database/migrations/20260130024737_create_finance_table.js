/**
 * Migration: create_finance_table - FIXED VERSION
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 6: Finance Manager...");

  // Finance Manager
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS finance_manager (
      finance_manager_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      is_current BOOLEAN DEFAULT TRUE,
      authorization_level ENUM('FULL', 'PARTIAL', 'VIEW_ONLY') DEFAULT 'FULL',
      authorized_transaction_limit DECIMAL(15,2) COMMENT 'Maximum transaction amount authorized',
      bank_accounts_access JSON COMMENT 'Which bank accounts they can access',
      financial_reports_access JSON COMMENT 'Which reports they can access',
      signature_path VARCHAR(500),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      office_location VARCHAR(500),
      assistant_id CHAR(36),
      monthly_report_due_date INT DEFAULT 5 COMMENT 'Day of month reports are due',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_finance_manager_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_finance_manager_assistant 
        FOREIGN KEY (assistant_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_finance_manager_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_user_current (user_id, is_current),
      
      INDEX idx_is_current (is_current),
      INDEX idx_authorization_level (authorization_level),
      INDEX idx_user_id (user_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ finance_manager table created");

  // Bank Accounts
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS bank_accounts (
      account_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      bank_name_arabic VARCHAR(255) NOT NULL,
      bank_name_english VARCHAR(255),
      account_number VARCHAR(100) NOT NULL,
      iban VARCHAR(50),
      account_type ENUM('CURRENT', 'SAVINGS', 'INVESTMENT', 'FIXED_DEPOSIT', 'OTHER') DEFAULT 'CURRENT',
      currency CHAR(3) DEFAULT 'SAR',
      current_balance DECIMAL(15,2) DEFAULT 0,
      available_balance DECIMAL(15,2) DEFAULT 0,
      opening_date DATE,
      branch_name VARCHAR(255),
      branch_address TEXT,
      swift_code VARCHAR(20),
      account_holders JSON COMMENT 'Authorized signatories',
      purpose_arabic TEXT,
      purpose_english TEXT,
      monthly_statement_day INT COMMENT 'Day of month for statement generation',
      is_active BOOLEAN DEFAULT TRUE,
      access_permissions JSON COMMENT 'Who can access this account',
      risk_level ENUM('LOW', 'MEDIUM', 'HIGH') DEFAULT 'MEDIUM',
      interest_rate DECIMAL(5,2) COMMENT 'Annual interest rate if applicable',
      minimum_balance DECIMAL(15,2),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_bank_account_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_account_number (account_number),
      UNIQUE KEY uk_iban (iban),
      
      INDEX idx_bank_name (bank_name_arabic),
      INDEX idx_account_type (account_type),
      INDEX idx_is_active (is_active),
      INDEX idx_current_balance (current_balance),
      INDEX idx_risk_level (risk_level),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ bank_accounts table created");

  // Financial Transactions
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS financial_transactions (
      transaction_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      account_id CHAR(36) NOT NULL,
      transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'INTEREST', 'FEE', 'SALARY', 'DONATION', 'INVESTMENT', 'OTHER') NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      currency CHAR(3) DEFAULT 'SAR',
      description_arabic TEXT,
      description_english TEXT,
      reference_number VARCHAR(100),
      bank_reference VARCHAR(100),
      transaction_date DATE NOT NULL,
      value_date DATE,
      beneficiary_name VARCHAR(255),
      beneficiary_account VARCHAR(100),
      beneficiary_bank VARCHAR(255),
      category ENUM('SALARIES', 'UTILITIES', 'RENT', 'MAINTENANCE', 'DONATIONS', 'INVESTMENTS', 'EVENTS', 'TRAVEL', 'SUPPLIES', 'OTHER') NOT NULL,
      subcategory VARCHAR(100),
      project_id CHAR(36) COMMENT 'Related project/campaign',
      invoice_number VARCHAR(100),
      invoice_date DATE,
      approved_by CHAR(36),
      approval_date DATE,
      status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED', 'CANCELLED') DEFAULT 'PENDING',
      receipt_path VARCHAR(500),
      payment_method ENUM('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CREDIT_CARD', 'ONLINE') DEFAULT 'BANK_TRANSFER',
      reconciliation_status ENUM('UNRECONCILED', 'RECONCILED', 'DISPUTED') DEFAULT 'UNRECONCILED',
      reconciliation_date DATE,
      reconciliation_notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_transaction_account 
        FOREIGN KEY (account_id) 
        REFERENCES bank_accounts(account_id) 
        ON DELETE RESTRICT 
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

      INDEX idx_account_id (account_id),
      INDEX idx_transaction_type (transaction_type),
      INDEX idx_transaction_date (transaction_date),
      INDEX idx_amount (amount),
      INDEX idx_status (status),
      INDEX idx_category (category),
      INDEX idx_reference_number (reference_number),
      INDEX idx_approved_by (approved_by),
      INDEX idx_created_by (created_by),
      INDEX idx_reconciliation_status (reconciliation_status)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ financial_transactions table created");

  // Financial Reports
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS financial_reports (
      report_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      report_type ENUM('BALANCE_SHEET', 'INCOME_STATEMENT', 'CASH_FLOW', 'BUDGET_VS_ACTUAL', 'DONATION_SUMMARY', 'EXPENSE_SUMMARY', 'AUDIT') NOT NULL,
      period_type ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'QUARTERLY', 'ANNUAL', 'AD_HOC') DEFAULT 'MONTHLY',
      period_start DATE NOT NULL,
      period_end DATE NOT NULL,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      generated_by CHAR(36) NOT NULL,
      generation_date DATE NOT NULL,
      file_path VARCHAR(500),
      summary_data JSON COMMENT 'Key metrics and summary',
      detailed_data JSON COMMENT 'Detailed report data',
      approval_status ENUM('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
      approved_by CHAR(36),
      approval_date DATE,
      next_report_due DATE,
      notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_report_generated_by 
        FOREIGN KEY (generated_by) 
        REFERENCES users(id) 
        ON DELETE RESTRICT 
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

      UNIQUE KEY uk_report_period (report_type, period_type, period_start, period_end),
      
      INDEX idx_report_type (report_type),
      INDEX idx_period (period_start, period_end),
      INDEX idx_generation_date (generation_date),
      INDEX idx_approval_status (approval_status),
      INDEX idx_generated_by (generated_by),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ financial_reports table created");

  // Budgets
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS budgets (
      budget_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      budget_year YEAR NOT NULL,
      budget_type ENUM('OPERATIONAL', 'CAPITAL', 'PROJECT', 'DEPARTMENTAL', 'EVENT') DEFAULT 'OPERATIONAL',
      department VARCHAR(255),
      category VARCHAR(100),
      subcategory VARCHAR(100),
      allocated_amount DECIMAL(15,2) NOT NULL,
      spent_amount DECIMAL(15,2) DEFAULT 0,
      remaining_amount DECIMAL(15,2) GENERATED ALWAYS AS (allocated_amount - spent_amount) STORED,
      description TEXT,
      approval_status ENUM('DRAFT', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'REJECTED') DEFAULT 'DRAFT',
      approved_by CHAR(36),
      approval_date DATE,
      notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_budget_approved_by 
        FOREIGN KEY (approved_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,

      CONSTRAINT fk_budget_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,

      INDEX idx_budget_year (budget_year),
      INDEX idx_budget_type (budget_type),
      INDEX idx_department (department),
      INDEX idx_category (category),
      INDEX idx_approval_status (approval_status),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ budgets table created");

  // Insert default bank accounts
  await queryInterface.execute(`
    INSERT INTO bank_accounts (
      account_id, bank_name_arabic, bank_name_english, 
      account_number, account_type, currency, 
      current_balance, opening_date, is_active
    ) VALUES (
      UUID(),
      'البنك الأهلي السعودي',
      'Saudi National Bank',
      'SA1234567890123456789012',
      'CURRENT',
      'SAR',
      500000.00,
      '2020-01-01',
      TRUE
    ), (
      UUID(),
      'مصرف الراجحي',
      'Al Rajhi Bank',
      'SA9876543210987654321098',
      'SAVINGS',
      'SAR',
      1000000.00,
      '2020-01-01',
      TRUE
    );
  `);

  console.log("✅ Default bank accounts inserted");

  // Insert default finance manager
  await queryInterface.execute(`
    INSERT INTO finance_manager (
      finance_manager_id, user_id, start_date, 
      authorization_level, authorized_transaction_limit, is_current
    ) VALUES (
      UUID(),
      (SELECT id FROM users WHERE user_type = 'FINANCE_MANAGER' AND status = 'ACTIVE' LIMIT 1),
      CURDATE(),
      'FULL',
      100000.00,
      TRUE
    );
  `);

  console.log("✅ Default finance manager inserted");

  console.log("✅ Section 6 Finance Manager created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping Section 6: Finance Manager tables...");

  // Drop tables in reverse order (child tables first)
  await queryInterface.execute("DROP TABLE IF EXISTS budgets");
  await queryInterface.execute("DROP TABLE IF EXISTS financial_reports");
  await queryInterface.execute("DROP TABLE IF EXISTS financial_transactions");
  await queryInterface.execute("DROP TABLE IF EXISTS bank_accounts");
  await queryInterface.execute("DROP TABLE IF EXISTS finance_manager");

  console.log("✅ Section 6 tables dropped successfully");
};
