/**
 * Migration: create_finance_table
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 6: Finance Manager...");

  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS finance_manager (
      finance_manager_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      person_id CHAR(36) NOT NULL,
      start_date DATE NOT NULL,
      end_date DATE,
      is_current BOOLEAN DEFAULT TRUE,
      authorization_level ENUM('FULL', 'PARTIAL', 'VIEW_ONLY') DEFAULT 'FULL',
      authorized_transaction_limit DECIMAL(15,2) COMMENT 'Maximum transaction amount authorized',
      bank_accounts_access JSON COMMENT 'Which bank accounts they can access',
      financial_reports_access JSON COMMENT 'Which reports they can access',
      signature_path VARCHAR(500),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_finance_manager_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(person_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      INDEX idx_is_current (is_current),
      INDEX idx_authorization_level (authorization_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

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
      purpose TEXT COMMENT 'Purpose of this account',
      monthly_statement_day INT COMMENT 'Day of month for statement generation',
      is_active BOOLEAN DEFAULT TRUE,
      access_permissions JSON COMMENT 'Who can access this account',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_account_number (account_number),
      UNIQUE KEY uk_iban (iban),
      
      INDEX idx_bank_name (bank_name_arabic),
      INDEX idx_account_type (account_type),
      INDEX idx_is_active (is_active),
      INDEX idx_current_balance (current_balance)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Financial Transactions
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS financial_transactions (
      transaction_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      account_id CHAR(36) NOT NULL,
      transaction_type ENUM('DEPOSIT', 'WITHDRAWAL', 'TRANSFER', 'INTEREST', 'FEE') NOT NULL,
      amount DECIMAL(15,2) NOT NULL,
      currency CHAR(3) DEFAULT 'SAR',
      description TEXT,
      reference_number VARCHAR(100),
      bank_reference VARCHAR(100),
      transaction_date DATE NOT NULL,
      value_date DATE,
      beneficiary_name VARCHAR(255),
      beneficiary_account VARCHAR(100),
      beneficiary_bank VARCHAR(255),
      category VARCHAR(100),
      subcategory VARCHAR(100),
      project_id CHAR(36) COMMENT 'Related project/campaign',
      approved_by CHAR(36),
      approval_date DATE,
      status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REVERSED') DEFAULT 'COMPLETED',
      receipt_path VARCHAR(500),
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
        REFERENCES persons(person_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_account_id (account_id),
      INDEX idx_transaction_type (transaction_type),
      INDEX idx_transaction_date (transaction_date),
      INDEX idx_amount (amount),
      INDEX idx_status (status),
      INDEX idx_category (category),
      INDEX idx_reference (reference_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Section 6 created");
};

export const down = async (queryInterface) => {
  // Write your migration DOWN logic here
  // This should reverse what up() does
  // Example:
  // await queryInterface.execute('DROP TABLE IF EXISTS users');
};
