import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import mysql from "mysql2/promise";

// ES Module fix for __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

class MigrationRunner {
  constructor() {
    this.migrationsDir = path.join(__dirname, "migrations");
    this.seedersDir = path.join(__dirname, "seeders");
    this.db = null;
    this.failedMigrations = [];
  }

  async initializeDatabase() {
    try {
      this.db = await mysql.createPool({
        host: process.env.DB_HOST || "localhost",
        port: process.env.DB_PORT || 3306,
        user: process.env.DB_USER || "manage",
        password: process.env.DB_PASSWORD || "Master@123",
        database: process.env.DB_NAME || "masoud",
        waitForConnections: true,
        connectionLimit: process.env.DB_POOL_LIMIT || 10,
        queueLimit: 0,
        timezone: "UTC",
        charset: "utf8mb4",
        multipleStatements: true, // Allow multiple statements
      });

      console.log("✅ Database connected successfully");
      return this.db;
    } catch (error) {
      console.error("❌ Database connection failed:", error.message);
      throw error;
    }
  }

  async initialize() {
    if (!this.db) {
      await this.initializeDatabase();
    }

    // Create migrations table if not exists
    await this.db.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        batch INT NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
  }

  async getExecutedMigrations() {
    try {
      const [migrations] = await this.db.execute(
        "SELECT name FROM migrations ORDER BY id ASC",
      );
      return migrations.map((m) => m.name);
    } catch (error) {
      console.error("❌ Error getting executed migrations:", error.message);
      return [];
    }
  }

  async getMigrationFiles() {
    try {
      await fs.access(this.migrationsDir);
    } catch {
      await fs.mkdir(this.migrationsDir, { recursive: true });
    }

    try {
      const files = await fs.readdir(this.migrationsDir);
      return files
        .filter((file) => file.endsWith(".js"))
        .map((file) => ({
          name: file.replace(".js", ""),
          path: path.join(this.migrationsDir, file),
        }))
        .sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
      console.error("❌ Error reading migration files:", error.message);
      return [];
    }
  }

  async getNextBatchNumber() {
    try {
      const [[result]] = await this.db.execute(
        "SELECT COALESCE(MAX(batch), 0) as max_batch FROM migrations",
      );
      return result.max_batch + 1;
    } catch (error) {
      console.error("❌ Error getting batch number:", error.message);
      return 1;
    }
  }

  async getCurrentBatchNumber() {
    try {
      const [[result]] = await this.db.execute(
        "SELECT COALESCE(MAX(batch), 0) as max_batch FROM migrations",
      );
      return result.max_batch;
    } catch (error) {
      console.error("❌ Error getting current batch:", error.message);
      return 0;
    }
  }

  async createMigration(name) {
    try {
      await fs.access(this.migrationsDir);
    } catch {
      await fs.mkdir(this.migrationsDir, { recursive: true });
    }

    const timestamp = new Date()
      .toISOString()
      .replace(/[^0-9]/g, "")
      .slice(0, 14);

    const fileName = `${timestamp}_${name}.js`;
    const filePath = path.join(this.migrationsDir, fileName);

    const template = `/**
 * Migration: ${name}
 */

export const up = async (queryInterface) => {
  // Write your migration UP logic here
  // Example:
  // await queryInterface.execute(\`
  //   CREATE TABLE users (
  //     id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  //     name VARCHAR(255) NOT NULL,
  //     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  //   )
  // \`);
};

export const down = async (queryInterface) => {
  // Write your migration DOWN logic here
  // This should reverse what up() does
  // Example:
  // await queryInterface.execute('DROP TABLE IF EXISTS users');
};
`;

    await fs.writeFile(filePath, template);
    console.log(`✅ Migration file created: ${fileName}`);
    console.log(`📁 Location: ${filePath}`);
  }

  async executeSafe(queryInterface, sql, migrationName) {
    try {
      console.log(`  Executing: ${sql.substring(0, 100)}...`);
      await queryInterface.execute(sql);
      return true;
    } catch (error) {
      // Check if it's a "already exists" error
      if (
        error.message.includes("already exists") ||
        error.message.includes("Duplicate") ||
        error.message.includes("exists")
      ) {
        console.warn(`  ⚠️  Warning (non-critical): ${error.message}`);
        return true; // Continue despite this error
      } else {
        console.error(`  ❌ Error in migration ${migrationName}:`, error.message);
        throw error;
      }
    }
  }

  async runMigrations(direction = "up", { skipErrors = false, specificMigration = null } = {}) {
    await this.initialize();

    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();

    let migrationsToRun;

    if (specificMigration) {
      // Run specific migration only
      const migrationFile = files.find(f => f.name === specificMigration);
      if (!migrationFile) {
        console.error(`❌ Migration not found: ${specificMigration}`);
        return [];
      }
      migrationsToRun = [migrationFile];
    } else if (direction === "up") {
      migrationsToRun = files.filter((file) => !executed.includes(file.name));
    } else {
      migrationsToRun = files
        .filter((file) => executed.includes(file.name))
        .reverse();
    }

    if (migrationsToRun.length === 0) {
      console.log(`📭 No migrations to ${direction}`);
      return [];
    }

    const batch =
      direction === "up"
        ? await this.getNextBatchNumber()
        : await this.getCurrentBatchNumber();

    const results = [];
    this.failedMigrations = [];

    console.log(`🚀 Starting migrations (${direction.toUpperCase()})...`);
    console.log(`📋 Total migrations to run: ${migrationsToRun.length}`);

    for (const migration of migrationsToRun) {
      console.log(`\n═══════════════════════════════════════════════════`);
      console.log(`🔄 Processing: ${migration.name}`);

      try {
        // Import the migration module
        const migrationUrl = new URL(`file://${migration.path}`);
        const migrationModule = await import(migrationUrl.href);

        const connection = await this.db.getConnection();

        try {
          await connection.beginTransaction();

          // Create a query interface with error handling
          const safeQueryInterface = {
            execute: async (sql, params) => {
              if (skipErrors) {
                try {
                  console.log(`  Executing: ${sql.substring(0, 100)}...`);
                  const result = await connection.execute(sql, params);
                  return result;
                } catch (error) {
                  // Check if it's a "already exists" or similar non-critical error
                  const errorMsg = error.message.toLowerCase();
                  const isNonCritical = 
                    errorMsg.includes("already exists") ||
                    errorMsg.includes("duplicate") ||
                    errorMsg.includes("exists") ||
                    errorMsg.includes("drop table if exists") ||
                    errorMsg.includes("drop procedure if exists") ||
                    errorMsg.includes("drop view if exists") ||
                    errorMsg.includes("drop trigger if exists") ||
                    errorMsg.includes("create table if not exists") ||
                    errorMsg.includes("create or replace");

                  if (isNonCritical) {
                    console.warn(`  ⚠️  Warning (non-critical): ${error.message}`);
                    return [[]]; // Return empty result to continue
                  } else {
                    throw error;
                  }
                }
              } else {
                return await connection.execute(sql, params);
              }
            }
          };

          if (direction === "up") {
            if (typeof migrationModule.up === "function") {
              console.log(`  Running UP function...`);
              await migrationModule.up(safeQueryInterface);
              
              // Only mark as executed if no errors occurred
              await connection.execute(
                "INSERT IGNORE INTO migrations (name, batch) VALUES (?, ?)",
                [migration.name, batch],
              );
            } else {
              throw new Error('Migration module must export an "up" function');
            }
          } else {
            if (typeof migrationModule.down === "function") {
              console.log(`  Running DOWN function...`);
              await migrationModule.down(safeQueryInterface);
              
              await connection.execute(
                "DELETE FROM migrations WHERE name = ?",
                [migration.name],
              );
            } else {
              throw new Error('Migration module must export a "down" function');
            }
          }

          await connection.commit();
          results.push({ name: migration.name, status: "success" });
          console.log(`✅ Migration ${direction} completed: ${migration.name}`);
        } catch (error) {
          await connection.rollback();
          
          if (skipErrors) {
            console.error(`  ⚠️  Migration failed but skipping: ${migration.name}`, error.message);
            results.push({
              name: migration.name,
              status: "skipped",
              error: error.message,
            });
            this.failedMigrations.push({
              name: migration.name,
              error: error.message
            });
            
            // Try to continue with next migration
            continue;
          } else {
            throw error;
          }
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error(`❌ Migration failed: ${migration.name}`, error.message);
        results.push({
          name: migration.name,
          status: "failed",
          error: error.message,
        });
        this.failedMigrations.push({
          name: migration.name,
          error: error.message
        });
        
        if (!skipErrors) {
          throw error;
        }
      }
    }

    // Print summary
    console.log("\n═══════════════════════════════════════════════════");
    console.log("📊 MIGRATION SUMMARY:");
    console.log(`✅ Successful: ${results.filter(r => r.status === "success").length}`);
    console.log(`⚠️  Skipped: ${results.filter(r => r.status === "skipped").length}`);
    console.log(`❌ Failed: ${results.filter(r => r.status === "failed").length}`);
    
    if (this.failedMigrations.length > 0) {
      console.log("\n📋 Failed Migrations:");
      this.failedMigrations.forEach(fm => {
        console.log(`   ❌ ${fm.name}: ${fm.error}`);
      });
    }

    return results;
  }

  async runSeeders() {
    try {
      await fs.access(this.seedersDir);
    } catch {
      console.log("📭 No seeders directory found");
      return;
    }

    const files = await fs.readdir(this.seedersDir);
    const seeders = files
      .filter((file) => file.endsWith(".js"))
      .map((file) => ({
        name: file.replace(".js", ""),
        path: path.join(this.seedersDir, file),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (seeders.length === 0) {
      console.log("📭 No seeders found");
      return;
    }

    console.log("🌱 Running seeders...");

    for (const seeder of seeders) {
      try {
        console.log(`  Processing: ${seeder.name}`);

        const seederUrl = new URL(`file://${seeder.path}`);
        const seederModule = await import(seederUrl.href);

        const connection = await this.db.getConnection();

        try {
          await connection.beginTransaction();

          if (typeof seederModule.up === "function") {
            await seederModule.up(connection);
            await connection.commit();
            console.log(`  ✅ Seeder completed: ${seeder.name}`);
          } else {
            throw new Error('Seeder module must export an "up" function');
          }
        } catch (error) {
          await connection.rollback();
          console.error(`  ❌ Seeder failed: ${seeder.name}`, error.message);
          throw error;
        } finally {
          connection.release();
        }
      } catch (error) {
        console.error(`❌ Seeder failed: ${seeder.name}`, error.message);
        throw error;
      }
    }
  }

  async getStatus() {
    await this.initialize();

    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();

    const status = [];
    for (const file of files) {
      let appliedAt = null;
      if (executed.includes(file.name)) {
        try {
          const [[result]] = await this.db.execute(
            "SELECT executed_at FROM migrations WHERE name = ?",
            [file.name],
          );
          appliedAt = result?.executed_at || null;
        } catch (error) {
          console.error(`Error getting execution time for ${file.name}:`, error.message);
        }
      }

      status.push({
        name: file.name,
        status: executed.includes(file.name) ? "applied" : "pending",
        appliedAt,
      });
    }

    return {
      total: files.length,
      applied: executed.length,
      pending: files.length - executed.length,
      migrations: status,
    };
  }

  async close() {
    if (this.db) {
      await this.db.end();
      console.log("🔌 Database connection closed");
    }
  }
}

// CLI Interface
async function main() {
  const command = process.argv[2];
  const arg = process.argv[3];
  const option = process.argv[4];

  const runner = new MigrationRunner();

  try {
    switch (command) {
      case "up":
        if (arg === "--skip-errors" || arg === "-s") {
          await runner.runMigrations("up", { skipErrors: true });
        } else if (arg) {
          // Run specific migration
          await runner.runMigrations("up", { specificMigration: arg });
        } else {
          await runner.runMigrations("up");
        }
        break;

      case "down":
        if (arg === "--skip-errors" || arg === "-s") {
          await runner.runMigrations("down", { skipErrors: true });
        } else if (arg) {
          // Rollback specific migration
          await runner.runMigrations("down", { specificMigration: arg });
        } else {
          await runner.runMigrations("down");
        }
        break;

      case "create":
        if (!arg) {
          console.error("❌ Please provide a migration name");
          process.exit(1);
        }
        await runner.createMigration(arg);
        break;

      case "seed":
        await runner.runSeeders();
        break;

      case "status":
        const status = await runner.getStatus();
        console.log("\n📊 Migration Status:");
        console.log(`Total migrations: ${status.total}`);
        console.log(`Applied: ${status.applied}`);
        console.log(`Pending: ${status.pending}\n`);

        console.log("📋 Migration List:");
        status.migrations.forEach((migration) => {
          const statusIcon = migration.status === "applied" ? "✅" : "⏳";
          const date = migration.appliedAt ? new Date(migration.appliedAt).toLocaleString() : "Not applied";
          console.log(`${statusIcon} ${migration.name} - ${migration.status} (${date})`);
        });
        break;

      case "reset":
        console.log("⚠️  Resetting all migrations...");
        const confirm = option === "--force" || option === "-f";
        if (!confirm) {
          console.log("🔒 Use --force or -f to confirm reset");
          const readline = (await import('readline')).createInterface({
            input: process.stdin,
            output: process.stdout
          });
          
          const answer = await new Promise(resolve => {
            readline.question('Are you sure you want to reset ALL migrations? (yes/no): ', resolve);
          });
          readline.close();
          
          if (answer.toLowerCase() !== 'yes') {
            console.log('Reset cancelled');
            break;
          }
        }
        
        await runner.runMigrations("down", { skipErrors: true });
        console.log("✅ All migrations rolled back");
        break;

      case "rerun":
        if (!arg) {
          console.error("❌ Please provide a migration name to rerun");
          process.exit(1);
        }
        console.log(`🔄 Rerunning migration: ${arg}`);
        // First rollback
        await runner.runMigrations("down", { specificMigration: arg, skipErrors: true });
        // Then run again
        await runner.runMigrations("up", { specificMigration: arg, skipErrors: true });
        break;

      default:
        console.log("🚀 Migration Runner Commands:");
        console.log("  npm run migrate:up                    Run pending migrations");
        console.log("  npm run migrate:up --skip-errors      Run migrations, skip errors");
        console.log("  npm run migrate:up <migration_name>   Run specific migration");
        console.log("  npm run migrate:down                  Rollback last migration");
        console.log("  npm run migrate:down --skip-errors    Rollback, skip errors");
        console.log("  npm run migrate:create <name>         Create new migration");
        console.log("  npm run migrate:seed                  Run seeders");
        console.log("  npm run migrate:status                Show migration status");
        console.log("  npm run migrate:reset                 Rollback all migrations");
        console.log("  npm run migrate:rerun <name>          Rerun specific migration");
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});

main();
