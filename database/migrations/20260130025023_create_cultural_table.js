/**
 * Migration: create_cultural_table - FIXED VERSION
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 8: Cultural Committee...");

  // Cultural Committee
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS cultural_committee (
      committee_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL DEFAULT 'اللجنة الثقافية',
      name_english VARCHAR(255) DEFAULT 'Cultural Committee',
      description TEXT,
      chairman_id CHAR(36),
      formation_date DATE,
      members JSON,
      vision TEXT,
      mission TEXT,
      annual_plan JSON,
      budget DECIMAL(15,2),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_cultural_chairman 
        FOREIGN KEY (chairman_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_cultural_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_formation_date (formation_date),
      INDEX idx_chairman_id (chairman_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ cultural_committee table created");

  // Cultural Initiatives
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS cultural_initiatives (
      initiative_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      initiative_type ENUM('ADVISOR', 'QURAN_COMPETITION', 'ACADEMIC_EXCELLENCE', 'LITERARY', 'ARTISTIC', 'SCIENTIFIC', 'OTHER') NOT NULL,
      description TEXT,
      start_date DATE,
      end_date DATE,
      target_audience JSON,
      participants JSON,
      budget DECIMAL(15,2),
      actual_cost DECIMAL(15,2),
      outcomes JSON,
      photos JSON,
      reports JSON,
      status ENUM('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNING',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_initiative_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_initiative_type (initiative_type),
      INDEX idx_status (status),
      INDEX idx_dates (start_date, end_date),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ cultural_initiatives table created");

  // Quran Competition Participants
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS quran_competition_participants (
      participant_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      initiative_id CHAR(36) NOT NULL,
      person_id CHAR(36) NOT NULL,
      category ENUM('MEMORIZATION', 'RECITATION', 'TAFSEER', 'TAJWEED') NOT NULL,
      memorization_level VARCHAR(100),
      age_group VARCHAR(50),
      registration_date DATE,
      evaluation_score DECIMAL(5,2),
      ranking INT,
      award_type VARCHAR(100),
      award_amount DECIMAL(15,2),
      certificate_path VARCHAR(500),
      notes TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_quran_initiative 
        FOREIGN KEY (initiative_id) 
        REFERENCES cultural_initiatives(initiative_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_quran_participant 
        FOREIGN KEY (person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_quran_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_initiative_person (initiative_id, person_id, category),
      
      INDEX idx_initiative_id (initiative_id),
      INDEX idx_category (category),
      INDEX idx_age_group (age_group),
      INDEX idx_ranking (ranking),
      INDEX idx_person_id (person_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ quran_competition_participants table created");

  console.log("✅ Section 8 Cultural Committee created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping Section 8: Cultural Committee tables...");

  // Drop tables in reverse order (child tables first)
  await queryInterface.execute("DROP TABLE IF EXISTS quran_competition_participants");
  await queryInterface.execute("DROP TABLE IF EXISTS cultural_initiatives");
  await queryInterface.execute("DROP TABLE IF EXISTS cultural_committee");

  console.log("✅ Section 8 tables dropped successfully");
};
