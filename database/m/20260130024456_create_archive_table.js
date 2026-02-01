/**
 * Migration: create_archive_table
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 4: Family Archive...");

  // 4.1 Family Tree Archive
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_tree_archive (
      archive_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tree_version VARCHAR(50),
      description TEXT,
      total_persons INT DEFAULT 0,
      total_families INT DEFAULT 0,
      generations INT DEFAULT 0,
      root_person_id CHAR(36),
      tree_data JSON COMMENT 'Complete tree structure in JSON format',
      tree_image_path VARCHAR(500),
      data_file_path VARCHAR(500),
      export_format ENUM('JSON', 'XML', 'GEDCOM', 'PDF', 'IMAGE') DEFAULT 'JSON',
      is_current BOOLEAN DEFAULT FALSE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_archive_root 
        FOREIGN KEY (root_person_id) 
        REFERENCES persons(person_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_tree_version (tree_version),
      
      INDEX idx_is_current (is_current),
      INDEX idx_created_at (created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4.2 Family Meeting Archive
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_meeting_archive (
      meeting_archive_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      meeting_type ENUM('GENERAL', 'SPECIAL', 'ANNUAL', 'ELECTION', 'EMERGENCY') NOT NULL,
      meeting_date DATE NOT NULL,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      location VARCHAR(500),
      attendees_count INT DEFAULT 0,
      attendees_list JSON,
      agenda_file_path VARCHAR(500),
      minutes_file_path VARCHAR(500),
      decisions JSON,
      voting_results JSON,
      photos JSON,
      videos JSON,
      next_meeting_date DATE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_meeting_date (meeting_date),
      INDEX idx_meeting_type (meeting_type)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4.3 Sports League Archive
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS sports_league_archive (
      league_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      season_year VARCHAR(20) NOT NULL,
      league_name_arabic VARCHAR(255) NOT NULL,
      league_name_english VARCHAR(255),
      sport_type ENUM('FOOTBALL', 'BASKETBALL', 'VOLLEYBALL', 'SWIMMING', 'ATHLETICS', 'OTHER') NOT NULL,
      start_date DATE,
      end_date DATE,
      teams JSON COMMENT 'Teams participating',
      matches JSON COMMENT 'Match schedule and results',
      standings JSON COMMENT 'League standings',
      winner_team VARCHAR(255),
      top_scorer VARCHAR(255),
      photos JSON,
      videos JSON,
      statistics JSON,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_season_sport (season_year, sport_type),
      
      INDEX idx_season_year (season_year),
      INDEX idx_sport_type (sport_type),
      INDEX idx_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4.4 General Archive Categories
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS archive_categories (
      category_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      parent_category_id CHAR(36),
      name_arabic VARCHAR(255) NOT NULL,
      name_english VARCHAR(255),
      description TEXT,
      icon VARCHAR(100),
      sort_order INT DEFAULT 0,
      access_level ENUM('PUBLIC', 'FAMILY_ONLY', 'BOARD_ONLY', 'ADMIN_ONLY') DEFAULT 'FAMILY_ONLY',
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_parent_category 
        FOREIGN KEY (parent_category_id) 
        REFERENCES archive_categories(category_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_parent_category (parent_category_id),
      INDEX idx_sort_order (sort_order),
      INDEX idx_access_level (access_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // 4.5 Archive Items
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS archive_items (
      item_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      category_id CHAR(36),
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      description TEXT,
      item_type ENUM('DOCUMENT', 'PHOTO', 'VIDEO', 'AUDIO', 'NEWSPAPER', 'BOOK', 'OTHER') NOT NULL,
      file_path VARCHAR(500),
      file_type VARCHAR(100),
      file_size BIGINT,
      thumbnail_path VARCHAR(500),
      year INT,
      decade INT,
      century INT,
      tags JSON,
      source VARCHAR(500),
      copyright_info VARCHAR(500),
      access_level ENUM('PUBLIC', 'FAMILY_ONLY', 'BOARD_ONLY', 'ADMIN_ONLY') DEFAULT 'FAMILY_ONLY',
      is_featured BOOLEAN DEFAULT FALSE,
      view_count INT DEFAULT 0,
      download_count INT DEFAULT 0,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_item_category 
        FOREIGN KEY (category_id) 
        REFERENCES archive_categories(category_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_category_id (category_id),
      INDEX idx_item_type (item_type),
      INDEX idx_year (year),
      INDEX idx_access_level (access_level),
      INDEX idx_is_featured (is_featured),
      FULLTEXT idx_item_search (title_arabic, title_english, description, tags)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Section 4 created");
};

export const down = async (queryInterface) => {
  // Write your migration DOWN logic here
  // This should reverse what up() does
  // Example:
  // await queryInterface.execute('DROP TABLE IF EXISTS users');
};
