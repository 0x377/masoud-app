/**
 * Migration: create_family_tree_tables
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Family Tree Tables...");

  // 1. Family Tree Core Table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_tree_nodes (
      node_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      person_id CHAR(36) NOT NULL,
      family_tree_id CHAR(36) COMMENT 'Multiple family trees support',
      parent_node_id CHAR(36) COMMENT 'Reference to parent node',
      spouse_node_id CHAR(36) COMMENT 'Reference to spouse node',
      node_level INT DEFAULT 0 COMMENT 'Hierarchy level (0 for root)',
      node_order INT DEFAULT 0 COMMENT 'Order among siblings',
      node_position ENUM('LEFT', 'RIGHT', 'CENTER') DEFAULT 'CENTER',
      generation INT DEFAULT 0 COMMENT 'Generation number',
      is_root BOOLEAN DEFAULT FALSE,
      is_primary_line BOOLEAN DEFAULT TRUE COMMENT 'For main family line vs branches',
      display_settings JSON COMMENT 'Custom display settings for this node',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_person_tree (person_id, family_tree_id),
      
      CONSTRAINT fk_node_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_node_parent 
        FOREIGN KEY (parent_node_id) 
        REFERENCES family_tree_nodes(node_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_node_spouse 
        FOREIGN KEY (spouse_node_id) 
        REFERENCES family_tree_nodes(node_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_node_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_family_tree (family_tree_id),
      INDEX idx_parent_node (parent_node_id),
      INDEX idx_spouse_node (spouse_node_id),
      INDEX idx_generation (generation),
      INDEX idx_is_root (is_root),
      INDEX idx_node_level (node_level),
      INDEX idx_person_id (person_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_tree_nodes table created");

  // 2. Family Relationships Table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_relationships (
      relationship_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      person_id CHAR(36) NOT NULL,
      related_person_id CHAR(36) NOT NULL,
      relationship_type ENUM(
        'FATHER', 'MOTHER', 'SON', 'DAUGHTER', 'BROTHER', 'SISTER', 
        'HUSBAND', 'WIFE', 'GRANDFATHER', 'GRANDMOTHER', 'GRANDSON', 
        'GRANDDAUGHTER', 'UNCLE', 'AUNT', 'NEPHEW', 'NIECE', 'COUSIN',
        'FATHER_IN_LAW', 'MOTHER_IN_LAW', 'SON_IN_LAW', 'DAUGHTER_IN_LAW',
        'BROTHER_IN_LAW', 'SISTER_IN_LAW', 'STEP_FATHER', 'STEP_MOTHER',
        'STEP_SON', 'STEP_DAUGHTER', 'ADOPTED_SON', 'ADOPTED_DAUGHTER'
      ) NOT NULL,
      reciprocal_relationship_type VARCHAR(50) COMMENT 'Auto-calculated reciprocal',
      is_biological BOOLEAN DEFAULT TRUE,
      start_date DATE COMMENT 'When relationship started (marriage, adoption, etc.)',
      end_date DATE COMMENT 'When relationship ended (divorce, death, etc.)',
      relationship_status ENUM('ACTIVE', 'DISSOLVED', 'DECEASED') DEFAULT 'ACTIVE',
      proof_documents JSON COMMENT 'Documents proving relationship',
      notes TEXT,
      certainty_level ENUM('CONFIRMED', 'LIKELY', 'POSSIBLE', 'UNCERTAIN') DEFAULT 'CONFIRMED',
      verified_by CHAR(36),
      verified_at TIMESTAMP NULL,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_person_relationship (person_id, related_person_id, relationship_type),
      
      CONSTRAINT fk_relationship_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_relationship_related_person 
        FOREIGN KEY (related_person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_relationship_verified_by 
        FOREIGN KEY (verified_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_relationship_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_person_id (person_id),
      INDEX idx_related_person_id (related_person_id),
      INDEX idx_relationship_type (relationship_type),
      INDEX idx_relationship_status (relationship_status),
      INDEX idx_certainty_level (certainty_level),
      INDEX idx_start_date (start_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_relationships table created");

  // 3. Family Trees Table (Multiple trees support)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_trees (
      tree_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      tree_name_arabic VARCHAR(255) NOT NULL,
      tree_name_english VARCHAR(255),
      description TEXT,
      root_person_id CHAR(36) COMMENT 'Starting ancestor',
      tree_type ENUM('PATERNAL', 'MATERNAL', 'COMBINED', 'BRANCH') DEFAULT 'PATERNAL',
      generation_depth INT DEFAULT 5 COMMENT 'How many generations to show by default',
      is_public BOOLEAN DEFAULT FALSE,
      access_level ENUM('PUBLIC', 'FAMILY_ONLY', 'PRIVATE') DEFAULT 'FAMILY_ONLY',
      cover_image VARCHAR(500),
      tree_settings JSON COMMENT 'Visual settings, colors, layout, etc.',
      statistics JSON COMMENT 'Auto-calculated statistics',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_tree_root_person 
        FOREIGN KEY (root_person_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_tree_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_tree_type (tree_type),
      INDEX idx_access_level (access_level),
      INDEX idx_is_public (is_public),
      INDEX idx_created_by (created_by),
      FULLTEXT idx_tree_search (tree_name_arabic, tree_name_english, description)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_trees table created");

  // 4. Family Branches Table
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_branches (
      branch_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      family_tree_id CHAR(36) NOT NULL,
      branch_name_arabic VARCHAR(255) NOT NULL,
      branch_name_english VARCHAR(255),
      description TEXT,
      ancestor_person_id CHAR(36) COMMENT 'Founder of this branch',
      generation_start INT DEFAULT 0,
      generation_end INT,
      branch_color VARCHAR(7) DEFAULT '#3498db' COMMENT 'Hex color for visualization',
      branch_order INT DEFAULT 0,
      is_active BOOLEAN DEFAULT TRUE,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_branch_family_tree 
        FOREIGN KEY (family_tree_id) 
        REFERENCES family_trees(tree_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_branch_ancestor 
        FOREIGN KEY (ancestor_person_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_branch_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_family_tree_id (family_tree_id),
      INDEX idx_ancestor_person (ancestor_person_id),
      INDEX idx_is_active (is_active),
      INDEX idx_branch_order (branch_order)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_branches table created");

  // 5. Family Events Table (Marriages, Births, Deaths, etc.)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_events (
      event_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      event_type ENUM(
        'BIRTH', 'DEATH', 'MARRIAGE', 'DIVORCE', 'ADOPTION', 
        'WEDDING_ANNIVERSARY', 'EDUCATION', 'CAREER', 'MILITARY_SERVICE',
        'HAJJ', 'UMRAH', 'RELOCATION', 'ILLNESS', 'RECOVERY', 'OTHER'
      ) NOT NULL,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      description TEXT,
      event_date DATE NOT NULL,
      event_end_date DATE COMMENT 'For events spanning multiple days',
      location VARCHAR(500),
      latitude DECIMAL(10, 8),
      longitude DECIMAL(11, 8),
      primary_person_id CHAR(36) COMMENT 'Main person involved',
      secondary_person_id CHAR(36) COMMENT 'Second person (spouse, parent, etc.)',
      family_tree_id CHAR(36),
      branch_id CHAR(36),
      witnesses JSON COMMENT 'List of witness person IDs',
      documents JSON COMMENT 'Event documents',
      photos JSON COMMENT 'Event photos',
      is_verified BOOLEAN DEFAULT FALSE,
      verified_by CHAR(36),
      verified_at TIMESTAMP NULL,
      importance_level ENUM('HIGH', 'MEDIUM', 'LOW') DEFAULT 'MEDIUM',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_event_primary_person 
        FOREIGN KEY (primary_person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_event_secondary_person 
        FOREIGN KEY (secondary_person_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_event_family_tree 
        FOREIGN KEY (family_tree_id) 
        REFERENCES family_trees(tree_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_event_branch 
        FOREIGN KEY (branch_id) 
        REFERENCES family_branches(branch_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_event_verified_by 
        FOREIGN KEY (verified_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_event_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_event_type (event_type),
      INDEX idx_event_date (event_date),
      INDEX idx_primary_person (primary_person_id),
      INDEX idx_family_tree (family_tree_id),
      INDEX idx_branch (branch_id),
      INDEX idx_is_verified (is_verified),
      INDEX idx_importance_level (importance_level)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_events table created");

  // 6. Family Stories & Memories
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_stories (
      story_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      content TEXT NOT NULL,
      story_type ENUM('ANCESTOR_STORY', 'FAMILY_TRADITION', 'HISTORICAL_EVENT', 
                     'PERSONAL_MEMORY', 'LESSON', 'ADVICE', 'OTHER') DEFAULT 'PERSONAL_MEMORY',
      author_person_id CHAR(36),
      related_persons JSON COMMENT 'Array of related person IDs',
      family_tree_id CHAR(36),
      branch_id CHAR(36),
      location VARCHAR(500),
      estimated_date DATE COMMENT 'When story happened approximately',
      century INT COMMENT 'Century when story happened',
      keywords JSON COMMENT 'Search keywords',
      attachments JSON COMMENT 'Photos, documents, audio, video',
      is_verified BOOLEAN DEFAULT FALSE,
      verified_by CHAR(36),
      verified_at TIMESTAMP NULL,
      privacy_level ENUM('PUBLIC', 'FAMILY_ONLY', 'PRIVATE') DEFAULT 'FAMILY_ONLY',
      likes_count INT DEFAULT 0,
      comments_count INT DEFAULT 0,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_story_author 
        FOREIGN KEY (author_person_id) 
        REFERENCES persons(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_story_family_tree 
        FOREIGN KEY (family_tree_id) 
        REFERENCES family_trees(tree_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_story_branch 
        FOREIGN KEY (branch_id) 
        REFERENCES family_branches(branch_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_story_verified_by 
        FOREIGN KEY (verified_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_story_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_story_type (story_type),
      INDEX idx_author (author_person_id),
      INDEX idx_family_tree (family_tree_id),
      INDEX idx_privacy_level (privacy_level),
      INDEX idx_is_verified (is_verified),
      FULLTEXT idx_story_content (title_arabic, title_english, content)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_stories table created");

  // 7. DNA & Genetic Information
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_dna (
      dna_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      person_id CHAR(36) NOT NULL,
      test_company VARCHAR(100) COMMENT '23andMe, AncestryDNA, etc.',
      test_id VARCHAR(100) UNIQUE,
      test_date DATE,
      raw_data_path VARCHAR(500) COMMENT 'Path to raw DNA data file',
      haplogroup_mt VARCHAR(50) COMMENT 'Maternal haplogroup',
      haplogroup_y VARCHAR(50) COMMENT 'Paternal haplogroup',
      ethnicity_estimate JSON COMMENT 'Ethnicity breakdown',
      genetic_matches JSON COMMENT 'DNA matches with other persons',
      health_risks JSON COMMENT 'Genetic health risks',
      traits JSON COMMENT 'Genetic traits',
      privacy_settings ENUM('PUBLIC', 'FAMILY_ONLY', 'PRIVATE') DEFAULT 'PRIVATE',
      is_verified BOOLEAN DEFAULT FALSE,
      verified_by CHAR(36),
      verified_at TIMESTAMP NULL,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      UNIQUE KEY uk_person_test (person_id, test_company),
      
      CONSTRAINT fk_dna_person 
        FOREIGN KEY (person_id) 
        REFERENCES persons(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_dna_verified_by 
        FOREIGN KEY (verified_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_dna_created_by 
        FOREIGN KEY (created_by) 
        REFERENCES users(id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_person_id (person_id),
      INDEX idx_test_company (test_company),
      INDEX idx_privacy_settings (privacy_settings),
      INDEX idx_is_verified (is_verified)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_dna table created");

  // 8. Family Statistics
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_statistics (
      stat_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      family_tree_id CHAR(36),
      branch_id CHAR(36),
      stat_type ENUM('GENERATION_COUNT', 'GENDER_RATIO', 'AGE_DISTRIBUTION', 
                    'MARRIAGE_STATS', 'BIRTH_STATS', 'DEATH_STATS', 
                    'EDUCATION_LEVELS', 'OCCUPATIONS', 'GEOGRAPHIC_DISTRIBUTION') NOT NULL,
      period_type ENUM('DAILY', 'WEEKLY', 'MONTHLY', 'YEARLY', 'ALL_TIME', 'CUSTOM') DEFAULT 'ALL_TIME',
      period_start DATE,
      period_end DATE,
      stat_data JSON NOT NULL COMMENT 'JSON structure with statistics',
      calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      metadata JSON,
      
      CONSTRAINT fk_stats_family_tree 
        FOREIGN KEY (family_tree_id) 
        REFERENCES family_trees(tree_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_stats_branch 
        FOREIGN KEY (branch_id) 
        REFERENCES family_branches(branch_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      INDEX idx_family_tree (family_tree_id),
      INDEX idx_branch (branch_id),
      INDEX idx_stat_type (stat_type),
      INDEX idx_period (period_type, period_start)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_statistics table created");

  // 9. Family Tree Shares (Sharing with others)
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS family_tree_shares (
      share_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      family_tree_id CHAR(36) NOT NULL,
      shared_by CHAR(36) NOT NULL COMMENT 'User who shared',
      shared_with_email VARCHAR(255) COMMENT 'Email of person shared with',
      shared_with_user_id CHAR(36) COMMENT 'User ID if registered',
      access_level ENUM('VIEW_ONLY', 'CONTRIBUTE', 'EDIT', 'ADMIN') DEFAULT 'VIEW_ONLY',
      share_token VARCHAR(255) UNIQUE COMMENT 'Token for external sharing',
      expires_at TIMESTAMP NULL,
      is_active BOOLEAN DEFAULT TRUE,
      permissions JSON COMMENT 'Specific permissions',
      metadata JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_share_family_tree 
        FOREIGN KEY (family_tree_id) 
        REFERENCES family_trees(tree_id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_share_shared_by 
        FOREIGN KEY (shared_by) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      CONSTRAINT fk_share_shared_with_user 
        FOREIGN KEY (shared_with_user_id) 
        REFERENCES users(id) 
        ON DELETE CASCADE 
        ON UPDATE CASCADE,
      
      INDEX idx_family_tree (family_tree_id),
      INDEX idx_shared_by (shared_by),
      INDEX idx_shared_with_email (shared_with_email),
      INDEX idx_share_token (share_token),
      INDEX idx_expires_at (expires_at),
      INDEX idx_is_active (is_active)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ family_tree_shares table created");

  // Triggers for automatic relationship management
  await queryInterface.execute(`
    CREATE TRIGGER after_family_relationship_insert
    AFTER INSERT ON family_relationships
    FOR EACH ROW
    BEGIN
      -- Auto-create reciprocal relationship
      INSERT IGNORE INTO family_relationships (
        relationship_id, person_id, related_person_id, 
        relationship_type, reciprocal_relationship_type,
        is_biological, start_date, end_date, relationship_status,
        certainty_level, created_by, created_at, updated_at
      ) VALUES (
        UUID(),
        NEW.related_person_id,
        NEW.person_id,
        CASE NEW.relationship_type
          WHEN 'FATHER' THEN 'SON'
          WHEN 'MOTHER' THEN 'DAUGHTER'
          WHEN 'SON' THEN 'FATHER'
          WHEN 'DAUGHTER' THEN 'MOTHER'
          WHEN 'HUSBAND' THEN 'WIFE'
          WHEN 'WIFE' THEN 'HUSBAND'
          WHEN 'BROTHER' THEN 'BROTHER'
          WHEN 'SISTER' THEN 'SISTER'
          WHEN 'GRANDFATHER' THEN 'GRANDSON'
          WHEN 'GRANDMOTHER' THEN 'GRANDDAUGHTER'
          WHEN 'GRANDSON' THEN 'GRANDFATHER'
          WHEN 'GRANDDAUGHTER' THEN 'GRANDMOTHER'
          WHEN 'UNCLE' THEN 'NEPHEW'
          WHEN 'AUNT' THEN 'NIECE'
          WHEN 'NEPHEW' THEN 'UNCLE'
          WHEN 'NIECE' THEN 'AUNT'
          WHEN 'COUSIN' THEN 'COUSIN'
          ELSE 'OTHER'
        END,
        NEW.relationship_type,
        NEW.is_biological,
        NEW.start_date,
        NEW.end_date,
        NEW.relationship_status,
        NEW.certainty_level,
        NEW.created_by,
        NOW(),
        NOW()
      );
    END;
  `);

  console.log("✅ Family tree triggers created");

  // Insert default family tree
  await queryInterface.execute(`
    INSERT INTO family_trees (
      tree_id, tree_name_arabic, tree_name_english, description, tree_type, 
      access_level, created_by
    ) VALUES (
      UUID(),
      'شجرة عائلة المسعود',
      'Al Masoud Family Tree',
      'الشجرة الرئيسية لعائلة المسعود',
      'PATERNAL',
      'FAMILY_ONLY',
      (SELECT id FROM users WHERE email = 'admin@example.com' LIMIT 1)
    );
  `);

  console.log("✅ Default family tree created");

  console.log("🎉 All family tree tables created successfully!");
};

export const down = async (queryInterface) => {
  console.log("🔄 Dropping family tree tables...");

  // Drop triggers first
  await queryInterface.execute("DROP TRIGGER IF EXISTS after_family_relationship_insert");

  // Drop tables in reverse order
  await queryInterface.execute("DROP TABLE IF EXISTS family_tree_shares");
  await queryInterface.execute("DROP TABLE IF EXISTS family_statistics");
  await queryInterface.execute("DROP TABLE IF EXISTS family_dna");
  await queryInterface.execute("DROP TABLE IF EXISTS family_stories");
  await queryInterface.execute("DROP TABLE IF EXISTS family_events");
  await queryInterface.execute("DROP TABLE IF EXISTS family_branches");
  await queryInterface.execute("DROP TABLE IF EXISTS family_trees");
  await queryInterface.execute("DROP TABLE IF EXISTS family_relationships");
  await queryInterface.execute("DROP TABLE IF EXISTS family_tree_nodes");

  console.log("✅ All family tree tables dropped successfully");
};
