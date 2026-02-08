/**
 * Migration: create_donation_tables
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Donation Platform Tables...");

  // 1. Create donation_campaigns FIRST (referenced by donations)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS donation_campaigns (
      campaign_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      description TEXT,
      category_id CHAR(36),
      target_amount DECIMAL(15,2) NOT NULL,
      current_amount DECIMAL(15,2) DEFAULT 0,
      start_date DATE,
      end_date DATE,
      status ENUM('DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED') DEFAULT 'DRAFT',
      cover_image VARCHAR(500),
      is_featured BOOLEAN DEFAULT FALSE,
      allow_anonymous BOOLEAN DEFAULT TRUE,
      allow_dedications BOOLEAN DEFAULT TRUE,
      bank_account VARCHAR(100),
      payment_methods JSON,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_campaign_category 
        FOREIGN KEY (category_id) 
        REFERENCES donation_categories(category_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_campaign_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_status (status),
      INDEX idx_dates (start_date, end_date),
      INDEX idx_target_amount (target_amount),
      INDEX idx_is_featured (is_featured),
      FULLTEXT idx_campaign_search (name_arabic, name_english, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ donation_campaigns table created");

  // 1.1 Donation Categories
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS donation_categories (
      category_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      description TEXT,
      bank_account VARCHAR(100),
      sort_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_is_active (is_active),
      INDEX idx_sort_order (sort_order),
      FULLTEXT idx_search (name_arabic, name_english, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ donation_categories table created");

  // 1.3 Donations
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS donations (
      donation_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      campaign_id CHAR(36) NOT NULL,
      donor_id CHAR(36) COMMENT 'Can be null for anonymous donations',
      transaction_id VARCHAR(100) UNIQUE,
      amount DECIMAL(15,2) NOT NULL,
      donation_method ENUM('BANK_TRANSFER', 'CREDIT_CARD', 'PAYPAL', 'APPLE_PAY', 'CASH') NOT NULL,
      currency CHAR(3) DEFAULT 'SAR',
      status ENUM('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED', 'CANCELLED') DEFAULT 'PENDING',
      is_anonymous BOOLEAN DEFAULT FALSE,
      donor_name VARCHAR(255) COMMENT 'For anonymous donations',
      donor_email VARCHAR(255),
      donor_phone VARCHAR(20),
      dedication_name VARCHAR(255) COMMENT 'Name to dedicate donation to',
      dedication_message TEXT,
      payment_proof_path VARCHAR(500),
      bank_reference VARCHAR(100),
      receipt_sent BOOLEAN DEFAULT FALSE,
      receipt_sent_at TIMESTAMP NULL,
      tax_deductible BOOLEAN DEFAULT TRUE,
      tax_certificate_path VARCHAR(500),
      metadata JSON,
      ip_address VARCHAR(45),
      user_agent TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_donation_campaign 
        FOREIGN KEY (campaign_id) 
        REFERENCES donation_campaigns(campaign_id) 
        ON DELETE RESTRICT 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_donation_donor 
        FOREIGN KEY (donor_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_campaign_id (campaign_id),
      INDEX idx_donor_id (donor_id),
      INDEX idx_status (status),
      INDEX idx_created_at (created_at),
      INDEX idx_amount (amount),
      INDEX idx_donation_method (donation_method),
      INDEX idx_transaction_id (transaction_id),
      INDEX idx_is_anonymous (is_anonymous)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ donations table created");

  // 1.4 Donation Statistics
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS donation_statistics (
      stat_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      campaign_id CHAR(36),
      category_id CHAR(36),
      total_donations INT DEFAULT 0,
      total_amount DECIMAL(15,2) DEFAULT 0,
      average_donation DECIMAL(15,2) DEFAULT 0,
      max_donation DECIMAL(15,2) DEFAULT 0,
      min_donation DECIMAL(15,2) DEFAULT 0,
      anonymous_count INT DEFAULT 0,
      top_donors JSON,
      donation_trend JSON COMMENT 'Daily/weekly trend data',
      last_donation_at TIMESTAMP NULL,
      period_type ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL_TIME') DEFAULT 'ALL_TIME',
      period_start DATE,
      period_end DATE,
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_campaign_period (campaign_id, period_type, period_start),
      
      CONSTRAINT fk_stats_campaign 
        FOREIGN KEY (campaign_id) 
        REFERENCES donation_campaigns(campaign_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_stats_category 
        FOREIGN KEY (category_id) 
        REFERENCES donation_categories(category_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      INDEX idx_period (period_type, period_start),
      INDEX idx_calculated_at (calculated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ donation_statistics table created");

  // 1.5 Donation Receipts
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS donation_receipts (
      receipt_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      donation_id CHAR(36) NOT NULL,
      receipt_number VARCHAR(50) UNIQUE NOT NULL,
      receipt_date DATE NOT NULL,
      issued_by CHAR(36),
      issued_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      template_path VARCHAR(500),
      file_path VARCHAR(500),
      sent_via ENUM('EMAIL', 'SMS', 'WHATSAPP', 'DOWNLOAD') DEFAULT 'EMAIL',
      sent_at TIMESTAMP NULL,
      sent_to VARCHAR(255) COMMENT 'Email or phone number',
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_receipt_donation 
        FOREIGN KEY (donation_id) 
        REFERENCES donations(donation_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,

      CONSTRAINT fk_receipt_issued_by 
        FOREIGN KEY (issued_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,

      INDEX idx_receipt_number (receipt_number),
      INDEX idx_donation_id (donation_id),
      INDEX idx_receipt_date (receipt_date),
      INDEX idx_sent_at (sent_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ donation_receipts table created");

  // 1.6 Payment Gateways
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS payment_gateways (
      gateway_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name VARCHAR(100) NOT NULL,
      type ENUM('BANK', 'ONLINE', 'MOBILE', 'CASH') NOT NULL,
      is_active BOOLEAN DEFAULT TRUE,
      credentials JSON COMMENT 'Encrypted credentials',
      config JSON COMMENT 'Gateway configuration',
      test_mode BOOLEAN DEFAULT TRUE,
      sort_order INT DEFAULT 0,
      supported_currencies JSON,
      processing_fee_percentage DECIMAL(5,2) DEFAULT 0,
      processing_fee_fixed DECIMAL(10,2) DEFAULT 0,
      min_amount DECIMAL(10,2),
      max_amount DECIMAL(15,2),
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_is_active (is_active),
      INDEX idx_type (type),
      INDEX idx_sort_order (sort_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ payment_gateways table created");

  // Insert default donation categories
  await queryInterface.execute(`
    INSERT INTO donation_categories (category_id, name_arabic, name_english, bank_account, description, sort_order) VALUES
    (UUID(), 'عام', 'General', 'SA3180000252608013271122', 'General donations', 12),
    (UUID(), 'الزكاة', 'Zakat', 'SA1380000252608018635255', 'Donations for Zakat purposes', 1),
    (UUID(), 'وقف', 'Waqf', 'SA2080000121608017406772', 'Endowment donations', 4);
  `);

  console.log("✅ Default donation categories inserted");

  // Insert default payment gateways
  await queryInterface.execute(`
    INSERT INTO payment_gateways (gateway_id, name, type, is_active, sort_order) VALUES
    (UUID(), 'البنك الأهلي', 'BANK', TRUE, 1),
    (UUID(), 'البنك السعودي الفرنسي', 'BANK', TRUE, 2),
    (UUID(), 'الراجحي', 'BANK', TRUE, 3),
    (UUID(), 'STC Pay', 'MOBILE', TRUE, 4),
    (UUID(), 'مصرف الراجحي - التحويل البنكي', 'ONLINE', TRUE, 5),
    (UUID(), 'نقداً', 'CASH', TRUE, 6),
    (UUID(), 'بطاقة ائتمان', 'ONLINE', FALSE, 7);
  `);

  console.log("✅ Default payment gateways inserted");

  // Create triggers for auto-updating campaign amounts
  await queryInterface.execute(`
    CREATE TRIGGER after_donation_insert
    AFTER INSERT ON donations
    FOR EACH ROW
    BEGIN
      -- Update campaign current amount
      UPDATE donation_campaigns 
      SET current_amount = current_amount + NEW.amount,
          updated_at = NOW()
      WHERE campaign_id = NEW.campaign_id
      AND NEW.status = 'COMPLETED';
    END;
  `);

  await queryInterface.execute(`
    CREATE TRIGGER after_donation_update
    AFTER UPDATE ON donations
    FOR EACH ROW
    BEGIN
      IF OLD.status != NEW.status AND NEW.status = 'COMPLETED' THEN
        -- Add amount when status changes to COMPLETED
        UPDATE donation_campaigns 
        SET current_amount = current_amount + NEW.amount,
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id;
      ELSEIF OLD.status = 'COMPLETED' AND NEW.status != 'COMPLETED' THEN
        -- Subtract amount when status changes from COMPLETED
        UPDATE donation_campaigns 
        SET current_amount = current_amount - OLD.amount,
            updated_at = NOW()
        WHERE campaign_id = NEW.campaign_id;
      END IF;
    END;
  `);

  console.log("✅ Donation triggers created");

  console.log("🎉 All donation tables created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping donation tables...");

  // Drop in reverse order (due to foreign key constraints)
  await queryInterface.execute("DROP TRIGGER IF EXISTS after_donation_update");
  await queryInterface.execute("DROP TRIGGER IF EXISTS after_donation_insert");
  await queryInterface.execute("DROP TABLE IF EXISTS payment_gateways");
  await queryInterface.execute("DROP TABLE IF EXISTS donation_receipts");
  await queryInterface.execute("DROP TABLE IF EXISTS donation_statistics");
  await queryInterface.execute("DROP TABLE IF EXISTS donations");
  await queryInterface.execute("DROP TABLE IF EXISTS donation_categories");
  await queryInterface.execute("DROP TABLE IF EXISTS donation_campaigns");

  console.log("✅ All donation tables dropped successfully");
};
