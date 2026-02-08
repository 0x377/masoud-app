/**
 * Script: Delete All Tables and Relations from Database
 * WARNING: This will permanently delete ALL data from the database!
 * Usage: node deleteAllTables.js
 */

import db from "../database/database.js";

/**
 * Script to delete all tables and relations from the database
 * WARNING: This is irreversible and will delete ALL data!
 */
async function deleteAllTables() {
  console.log("🚨 WARNING: This will delete ALL tables and data from the database!");
  console.log("🚨 This action is irreversible!");
  console.log("🚨 Type 'DELETE ALL' to continue, or anything else to cancel:");

  // For interactive console input (if running in Node.js with readline)
  const readline = await import('readline').then(rl => rl.createInterface({
    input: process.stdin,
    output: process.stdout
  }));

  return new Promise((resolve) => {
    readline.question("> ", async (answer) => {
      readline.close();

      if (answer !== "DELETE ALL") {
        console.log("❌ Operation cancelled.");
        resolve(false);
        return;
      }

      try {
        console.log("🔄 Starting database cleanup...");

        // Disable foreign key checks to allow dropping tables in any order
        await db.query("SET FOREIGN_KEY_CHECKS = 0");
        console.log("✅ Foreign key checks disabled");

        // Get all tables in the database
        const [tables] = await db.query(`
          SELECT TABLE_NAME 
          FROM INFORMATION_SCHEMA.TABLES 
          WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_TYPE = 'BASE TABLE'
          ORDER BY TABLE_NAME
        `);

        console.log(`📊 Found ${tables.length} tables in the database`);

        // Drop tables in reverse dependency order (where possible)
        // Create a list of table names
        const tableNames = tables.map(row => row.TABLE_NAME);
        
        // Sort tables to try dropping child tables first (based on known structure)
        const knownTables = [
          // Child tables with foreign keys (drop first)
          'family_relationships',
          'user_permissions',
          'password_history',
          'login_histories',
          'verification_codes',
          'sessions',
          'personal_access_tokens',
          'password_reset_tokens',
          
          // Main tables
          'users'
        ];

        // Drop known tables in order
        for (const tableName of knownTables) {
          if (tableNames.includes(tableName)) {
            await dropTable(tableName);
          }
        }

        // Drop any remaining tables
        for (const row of tables) {
          const tableName = row.TABLE_NAME;
          if (!knownTables.includes(tableName)) {
            await dropTable(tableName);
          }
        }

        // Re-enable foreign key checks
        await db.query("SET FOREIGN_KEY_CHECKS = 1");
        console.log("✅ Foreign key checks re-enabled");

        console.log("🎉 All tables have been deleted successfully!");
        console.log("💾 Database is now empty and ready for fresh migrations.");

        resolve(true);

      } catch (error) {
        console.error("❌ Error during database cleanup:", error);
        
        // Try to re-enable foreign key checks even if there was an error
        try {
          await db.query("SET FOREIGN_KEY_CHECKS = 1");
        } catch (e) {
          console.error("Failed to re-enable foreign key checks:", e);
        }
        
        resolve(false);
      }
    });
  });
}

/**
 * Drop a single table with proper error handling
 */
async function dropTable(tableName) {
  try {
    const sql = `DROP TABLE IF EXISTS \`${tableName}\``;
    await db.query(sql);
    console.log(`✅ Dropped table: ${tableName}`);
  } catch (error) {
    console.error(`❌ Failed to drop table ${tableName}:`, error.message);
  }
}

/**
 * Alternative: Clean script without interactive prompt (for automation)
 */
async function deleteAllTablesWithoutPrompt() {
  try {
    console.log("🔄 Starting automatic database cleanup...");

    // Disable foreign key checks
    await db.query("SET FOREIGN_KEY_CHECKS = 0");

    // Get all tables
    const [tables] = await db.query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
    `);

    console.log(`📊 Found ${tables.length} tables to delete`);

    // Drop all tables
    for (const row of tables) {
      const tableName = row.TABLE_NAME;
      const sql = `DROP TABLE IF EXISTS \`${tableName}\``;
      await db.query(sql);
      console.log(`✅ Dropped: ${tableName}`);
    }

    // Re-enable foreign key checks
    await db.query("SET FOREIGN_KEY_CHECKS = 1");

    console.log("🎉 All tables deleted successfully!");
    return true;

  } catch (error) {
    console.error("❌ Error during automatic cleanup:", error);
    // Try to re-enable foreign key checks
    try {
      await db.query("SET FOREIGN_KEY_CHECKS = 1");
    } catch (e) {
      console.error("Failed to re-enable foreign key checks:", e);
    }
    return false;
  }
}

/**
 * List all tables without deleting them
 */
async function listAllTables() {
  try {
    const [tables] = await db.query(`
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        CREATE_TIME,
        UPDATE_TIME,
        TABLE_COMMENT
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);

    console.log("📋 Tables in database:");
    console.log("======================");
    
    if (tables.length === 0) {
      console.log("No tables found in the database.");
      return;
    }

    tables.forEach((table, index) => {
      console.log(`${index + 1}. ${table.TABLE_NAME}`);
      console.log(`   Rows: ${table.TABLE_ROWS}`);
      console.log(`   Created: ${table.CREATE_TIME}`);
      if (table.TABLE_COMMENT) {
        console.log(`   Comment: ${table.TABLE_COMMENT}`);
      }
      console.log("---");
    });

    console.log(`Total: ${tables.length} tables`);
    return tables;

  } catch (error) {
    console.error("❌ Error listing tables:", error);
    return [];
  }
}

/**
 * Show foreign key relationships between tables
 */
async function showTableRelationships() {
  try {
    const [relationships] = await db.query(`
      SELECT 
        TABLE_NAME,
        COLUMN_NAME,
        REFERENCED_TABLE_NAME,
        REFERENCED_COLUMN_NAME,
        CONSTRAINT_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
      AND REFERENCED_TABLE_NAME IS NOT NULL
      ORDER BY TABLE_NAME, CONSTRAINT_NAME
    `);

    console.log("🔗 Foreign Key Relationships:");
    console.log("=============================");
    
    if (relationships.length === 0) {
      console.log("No foreign key relationships found.");
      return;
    }

    relationships.forEach((rel, index) => {
      console.log(`${index + 1}. ${rel.TABLE_NAME}.${rel.COLUMN_NAME}`);
      console.log(`   → ${rel.REFERENCED_TABLE_NAME}.${rel.REFERENCED_COLUMN_NAME}`);
      console.log(`   Constraint: ${rel.CONSTRAINT_NAME}`);
      console.log("---");
    });

    return relationships;

  } catch (error) {
    console.error("❌ Error showing relationships:", error);
    return [];
  }
}

/**
 * Export individual functions for different use cases
 */
export {
  deleteAllTables,
  deleteAllTablesWithoutPrompt,
  listAllTables,
  showTableRelationships
};

/**
 * Main execution (if run directly)
 */
if (import.meta.url === `file://${process.argv[1]}`) {
  // Check for command line arguments
  const args = process.argv.slice(2);
  
  if (args.includes('--list') || args.includes('-l')) {
    listAllTables();
  } else if (args.includes('--relations') || args.includes('-r')) {
    showTableRelationships();
  } else if (args.includes('--force') || args.includes('-f')) {
    // Force delete without prompt
    deleteAllTablesWithoutPrompt()
      .then(success => {
        if (success) {
          process.exit(0);
        } else {
          process.exit(1);
        }
      });
  } else if (args.includes('--help') || args.includes('-h')) {
    console.log(`
Database Cleanup Script
=======================

Usage: node destroy.js [options]

Options:
  --list, -l        List all tables without deleting
  --relations, -r   Show foreign key relationships
  --force, -f       Delete all tables without confirmation prompt
  --help, -h        Show this help message

Without options: Interactive deletion with confirmation prompt

WARNING: This script will delete ALL data from the database!
    `);
    process.exit(0);
  } else {
    // Interactive mode
    deleteAllTables()
      .then(success => {
        if (success) {
          process.exit(0);
        } else {
          process.exit(1);
        }
      });
  }
}
