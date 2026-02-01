/**
 * Migration: create_media_table
 */

export const up = async (queryInterface) => {
  console.log("📦 Creating Section 10: Media Center...");

  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS media_center (
      center_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      name_arabic VARCHAR(255) NOT NULL DEFAULT 'المركز الإعلامي',
      name_english VARCHAR(255) DEFAULT 'Media Center',
      description TEXT,
      director_id CHAR(36),
      formation_date DATE,
      members JSON,
      vision TEXT,
      mission TEXT,
      social_media_links JSON,
      contact_email VARCHAR(255),
      contact_phone VARCHAR(20),
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_media_director 
        FOREIGN KEY (director_id) 
        REFERENCES persons(person_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_formation_date (formation_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Media Content
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS media_content (
      content_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      content_type ENUM('NEWS', 'ARTICLE', 'PHOTO_GALLERY', 'VIDEO', 'PODCAST', 'ANNOUNCEMENT', 'EVENT', 'INTERVIEW') NOT NULL,
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      content_arabic LONGTEXT,
      content_english LONGTEXT,
      excerpt_arabic TEXT,
      excerpt_english TEXT,
      author_id CHAR(36),
      publish_date DATE,
      publish_time TIME,
      expiry_date DATE,
      featured_image VARCHAR(500),
      gallery JSON,
      attachments JSON,
      tags JSON,
      category VARCHAR(100),
      status ENUM('DRAFT', 'REVIEW', 'APPROVED', 'PUBLISHED', 'ARCHIVED') DEFAULT 'DRAFT',
      views_count INT DEFAULT 0,
      likes_count INT DEFAULT 0,
      shares_count INT DEFAULT 0,
      comments_count INT DEFAULT 0,
      seo_title VARCHAR(255),
      seo_description TEXT,
      seo_keywords TEXT,
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      CONSTRAINT fk_content_author 
        FOREIGN KEY (author_id) 
        REFERENCES persons(person_id) 
        ON DELETE SET NULL 
        ON UPDATE CASCADE,
      
      INDEX idx_content_type (content_type),
      INDEX idx_status (status),
      INDEX idx_publish_date (publish_date),
      INDEX idx_category (category),
      INDEX idx_author (author_id),
      FULLTEXT idx_content_search (title_arabic, title_english, content_arabic, content_english, tags)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  // Media Campaigns
  await queryInterface.execute(`
    CREATE TABLE IF NOT EXISTS media_campaigns (
      campaign_id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
      title_arabic VARCHAR(255) NOT NULL,
      title_english VARCHAR(255),
      description TEXT,
      campaign_type ENUM('AWARENESS', 'FUNDRAISING', 'EVENT', 'SOCIAL', 'EDUCATIONAL') NOT NULL,
      start_date DATE,
      end_date DATE,
      target_audience JSON,
      channels JSON COMMENT 'Social media channels to use',
      budget DECIMAL(15,2),
      goals JSON,
      kpis JSON COMMENT 'Key Performance Indicators',
      content_calendar JSON,
      results JSON,
      status ENUM('PLANNING', 'ACTIVE', 'COMPLETED', 'CANCELLED') DEFAULT 'PLANNING',
      metadata JSON,
      created_by CHAR(36),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      
      INDEX idx_campaign_type (campaign_type),
      INDEX idx_status (status),
      INDEX idx_dates (start_date, end_date)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
  `);

  console.log("✅ Section 10 created");
};

export const down = async (queryInterface) => {
  // Write your migration DOWN logic here
  // This should reverse what up() does
  // Example:
  // await queryInterface.execute('DROP TABLE IF EXISTS users');
};
