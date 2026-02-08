/**
 * Migration: create_archive_table - FIXED VERSION
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
      root_user_id CHAR(36),
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
        FOREIGN KEY (root_user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_archive_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_tree_version (tree_version),
      
      INDEX idx_is_current (is_current),
      INDEX idx_created_at (created_at),
      INDEX idx_root_user_id (root_user_id),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_tree_archive table created");

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
      
      CONSTRAINT fk_meeting_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_meeting_date (meeting_date),
      INDEX idx_meeting_type (meeting_type),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_meeting_archive table created");

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
      
      CONSTRAINT fk_sports_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      UNIQUE KEY uk_season_sport (season_year, sport_type),
      
      INDEX idx_season_year (season_year),
      INDEX idx_sport_type (sport_type),
      INDEX idx_dates (start_date, end_date),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ sports_league_archive table created");

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
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_parent_category 
        FOREIGN KEY (parent_category_id) 
        REFERENCES archive_categories(category_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_category_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_parent_category (parent_category_id),
      INDEX idx_sort_order (sort_order),
      INDEX idx_access_level (access_level),
      INDEX idx_created_by (created_by)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ archive_categories table created");

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
      
      CONSTRAINT fk_item_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_category_id (category_id),
      INDEX idx_item_type (item_type),
      INDEX idx_year (year),
      INDEX idx_access_level (access_level),
      INDEX idx_is_featured (is_featured),
      INDEX idx_created_by (created_by),
      FULLTEXT idx_item_search (title_arabic, title_english, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ archive_items table created");

  // 4.6 Family History Profiles (new table to store historical family member data)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_history_profiles (
      profile_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      user_id CHAR(36) COMMENT 'Reference to current user if alive',
      full_name_arabic VARCHAR(255) NOT NULL,
      full_name_english VARCHAR(255),
      birth_name_arabic VARCHAR(255),
      birth_name_english VARCHAR(255),
      gender ENUM('M', 'F') NOT NULL,
      birth_date DATE,
      birth_place VARCHAR(255),
      death_date DATE,
      death_place VARCHAR(255),
      cause_of_death VARCHAR(500),
      burial_location VARCHAR(500),
      marital_status ENUM('single', 'married', 'divorced', 'widowed') DEFAULT 'single',
      spouse_names TEXT COMMENT 'Names of spouse(s)',
      children_names TEXT COMMENT 'Names of children',
      father_name VARCHAR(255),
      mother_name VARCHAR(255),
      lineage_arabic TEXT COMMENT 'النسب',
      lineage_english TEXT COMMENT 'Genealogy/Lineage',
      occupation_arabic VARCHAR(255),
      occupation_english VARCHAR(255),
      education_arabic TEXT,
      education_english TEXT,
      achievements_arabic TEXT,
      achievements_english TEXT,
      personality_traits TEXT,
      stories TEXT COMMENT 'Personal stories and anecdotes',
      photos JSON,
      documents JSON,
      is_verified BOOLEAN DEFAULT FALSE,
      verified_by CHAR(36),
      verified_at TIMESTAMP NULL,
      access_level ENUM('PUBLIC', 'FAMILY_ONLY', 'BOARD_ONLY', 'ADMIN_ONLY') DEFAULT 'FAMILY_ONLY',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_history_user 
        FOREIGN KEY (user_id) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_history_verified_by 
        FOREIGN KEY (verified_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_history_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_user_id (user_id),
      INDEX idx_full_name (full_name_arabic, full_name_english),
      INDEX idx_birth_date (birth_date),
      INDEX idx_death_date (death_date),
      INDEX idx_is_verified (is_verified),
      INDEX idx_access_level (access_level),
      FULLTEXT idx_history_search (full_name_arabic, full_name_english, lineage_arabic, lineage_english, stories)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_history_profiles table created");

  // 4.7 Historical Events Timeline
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS historical_events_timeline (
      event_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      description TEXT,
      event_date DATE,
      end_date DATE COMMENT 'For events that span multiple days',
      event_type ENUM('BIRTH', 'DEATH', 'MARRIAGE', 'DIVORCE', 'ACHIEVEMENT', 'EDUCATION', 'TRAVEL', 'BUSINESS', 'SOCIAL', 'OTHER') NOT NULL,
      location VARCHAR(500),
      related_profiles JSON COMMENT 'Array of profile_ids related to this event',
      photos JSON,
      documents JSON,
      significance_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') DEFAULT 'MEDIUM',
      access_level ENUM('PUBLIC', 'FAMILY_ONLY', 'BOARD_ONLY', 'ADMIN_ONLY') DEFAULT 'FAMILY_ONLY',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_event_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_event_date (event_date),
      INDEX idx_event_type (event_type),
      INDEX idx_significance_level (significance_level),
      INDEX idx_access_level (access_level),
      FULLTEXT idx_event_search (title_arabic, title_english, description, location)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ historical_events_timeline table created");

  // Insert default archive categories
  await queryInterface.execute(`
    INSERT INTO archive_categories (category_id, name_arabic, name_english, description, icon, sort_order, access_level) VALUES
    (UUID(), 'الصور القديمة', 'Old Photos', 'Archive of old family photos', 'camera', 1, 'FAMILY_ONLY'),
    (UUID(), 'الوثائق الرسمية', 'Official Documents', 'Birth certificates, marriage contracts, etc.', 'file-text', 2, 'FAMILY_ONLY'),
    (UUID(), 'الأشجار العائلية', 'Family Trees', 'Historical family tree documents', 'tree', 3, 'FAMILY_ONLY'),
    (UUID(), 'مذكرات وقصص', 'Diaries & Stories', 'Personal diaries and family stories', 'book', 4, 'FAMILY_ONLY'),
    (UUID(), 'المراسلات', 'Correspondence', 'Old letters and communications', 'mail', 5, 'FAMILY_ONLY'),
    (UUID(), 'الممتلكات والعقارات', 'Properties & Real Estate', 'Property documents and land deeds', 'home', 6, 'BOARD_ONLY'),
    (UUID(), 'السجلات المالية', 'Financial Records', 'Historical financial records', 'dollar-sign', 7, 'ADMIN_ONLY');
  `);

  console.log("✅ Default archive categories inserted");

  // Create archive statistics view
  await queryInterface.execute(`
    CREATE VIEW vw_archive_statistics AS
    SELECT 
      'إجمالي العناصر' AS metric_name_arabic,
      'Total Items' AS metric_name_english,
      COUNT(*) AS metric_value,
      'archive' AS metric_icon
    FROM archive_items
    WHERE access_level IN ('PUBLIC', 'FAMILY_ONLY')
    
    UNION ALL
    
    SELECT 
      'الملفات المصورة',
      'Photos',
      COUNT(*),
      'image'
    FROM archive_items
    WHERE item_type = 'PHOTO'
      AND access_level IN ('PUBLIC', 'FAMILY_ONLY')
      
    UNION ALL
    
    SELECT 
      'الوثائق',
      'Documents',
      COUNT(*),
      'file-text'
    FROM archive_items
    WHERE item_type = 'DOCUMENT'
      AND access_level IN ('PUBLIC', 'FAMILY_ONLY')
      
    UNION ALL
    
    SELECT 
      'الفيديوهات',
      'Videos',
      COUNT(*),
      'video'
    FROM archive_items
    WHERE item_type = 'VIDEO'
      AND access_level IN ('PUBLIC', 'FAMILY_ONLY');
  `);

  console.log("✅ Archive statistics view created");

  console.log("✅ Section 4 Family Archive created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping Section 4: Family Archive tables...");

  // Drop views first
  await queryInterface.execute("DROP VIEW IF EXISTS vw_archive_statistics");

  // Drop tables in reverse order (child tables first)
  await queryInterface.execute("DROP TABLE IF EXISTS historical_events_timeline");
  await queryInterface.execute("DROP TABLE IF EXISTS family_history_profiles");
  await queryInterface.execute("DROP TABLE IF EXISTS archive_items");
  await queryInterface.execute("DROP TABLE IF EXISTS archive_categories");
  await queryInterface.execute("DROP TABLE IF EXISTS sports_league_archive");
  await queryInterface.execute("DROP TABLE IF EXISTS family_meeting_archive");
  await queryInterface.execute("DROP TABLE IF EXISTS family_tree_archive");

  console.log("✅ Section 4 tables dropped successfully");
};
