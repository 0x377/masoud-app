/**
 * Migration: create_board_table
 */

export const up = async (queryInterface) => {
  console.log("🔄 Creating comprehensive board table...");

  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS board_members (
      board_member_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      person_id CHAR(36) NOT NULL,
      position_arabic VARCHAR(255) NOT NULL,
      position_english VARCHAR(255),
      position_order INT DEFAULT 0,
      start_date DATE NOT NULL,
      end_date DATE,
      term_number INT,
      is_current BOOLEAN DEFAULT TRUE,
      responsibilities JSON,
      committees JSON COMMENT 'Committees they serve on',
      biography_arabic TEXT,
      biography_english TEXT,
      achievements JSON,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      office_hours JSON,
      photo_path VARCHAR(500),
      signature_path VARCHAR(500),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_board_member_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(person_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_person_position (person_id, position_arabic, start_date),
      
      INDEX idx_is_current (is_current),
      INDEX idx_position_order (position_order),
      INDEX idx_dates (start_date, end_date),
      INDEX idx_term_number (term_number)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);
  console.log("✅ Board Members table created");

  // Board Meetings
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS board_meetings (
      meeting_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      meeting_date DATE NOT NULL,
      start_time TIME,
      end_time TIME,
      location VARCHAR(500),
      meeting_type ENUM(  console.log("🔄 Creating comprehensive users table...");
'REGULAR', 'SPECIAL', 'EMERGENCY', 'ANNUAL') DEFAULT 'REGULAR',
      status ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') DEFAULT 'SCHEDULED',
      agenda_file_path VARCHAR(500),
      minutes_file_path VARCHAR(500),
      decisions JSON COMMENT 'Decisions made in the meeting',
      attendees JSON COMMENT 'List of board members who attended',
      absentees JSON COMMENT 'List of absent board members',
      next_meeting_date DATE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_meeting_date (meeting_date),
      INDEX idx_status (status),
      INDEX idx_meeting_type (meeting_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Board Meetings table created");
};

export const down = async (queryInterface) => {
  await queryInterface.execute("DROP TABLE IF EXISTS board_meetings");
  await queryInterface.execute("DROP TABLE IF EXISTS board_members");
};
