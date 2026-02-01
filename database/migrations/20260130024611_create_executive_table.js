/**
 * Migration: create_executive_table
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 5: Executive Management...");

  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS executive_management (
      executive_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      person_id CHAR(36) NOT NULL,
      position_arabic VARCHAR(255) NOT NULL,
      position_english VARCHAR(255),
      position_level INT DEFAULT 1 COMMENT '1 = Executive Director, 2 = Secretary, etc.',
      department VARCHAR(255),
      start_date DATE NOT NULL,
      end_date DATE,
      is_current BOOLEAN DEFAULT TRUE,
      responsibilities JSON,
      reporting_to CHAR(36) COMMENT 'Reports to which executive',
      decision_authority JSON COMMENT 'Decision-making authority levels',
      signature_path VARCHAR(500),
      photo_path VARCHAR(500),
      office_location VARCHAR(500),
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      assistant_id CHAR(36),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_executive_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(person_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_executive_reporting 
        FOREIGN KEY (reporting_to) 
        REFERENCES executive_management(executive_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_executive_assistant 
        FOREIGN KEY (assistant_id) 
        REFERENCES persons(person_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_position_level (position_level),
      INDEX idx_is_current (is_current),
      INDEX idx_department (department),
      INDEX idx_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Section 5 created");
};

export const down = async (queryInterface) => {
  // Write your migration DOWN logic here
  // This should reverse what up() does
  // Example:
  // await queryInterface.execute('DROP TABLE IF EXISTS users');
};
