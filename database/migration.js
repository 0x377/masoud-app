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
    const [migrations] = await this.db.execute(
      "SELECT name FROM migrations ORDER BY id ASC",
    );
    return migrations.map((m) => m.name);
  }

  async getMigrationFiles() {
    try {
      await fs.access(this.migrationsDir);
    } catch {
      await fs.mkdir(this.migrationsDir, { recursive: true });
    }

    const files = await fs.readdir(this.migrationsDir);
    return files
      .filter((file) => file.endsWith(".js"))
      .map((file) => ({
        name: file.replace(".js", ""),
        path: path.join(this.migrationsDir, file),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  async getNextBatchNumber() {
    const [[result]] = await this.db.execute(
      "SELECT COALESCE(MAX(batch), 0) as max_batch FROM migrations",
    );
    return result.max_batch + 1;
  }

  async getCurrentBatchNumber() {
    const [[result]] = await this.db.execute(
      "SELECT COALESCE(MAX(batch), 0) as max_batch FROM migrations",
    );
    return result.max_batch;
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

  async runMigrations(direction = "up") {
    await this.initialize();

    const executed = await this.getExecutedMigrations();
    const files = await this.getMigrationFiles();

    let migrationsToRun;

    if (direction === "up") {
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

    for (const migration of migrationsToRun) {
      try {
        console.log(`🔄 Running migration ${direction}: ${migration.name}`);

        // Import the migration module
        const migrationUrl = new URL(`file://${migration.path}`);
        const migrationModule = await import(migrationUrl.href);

        const connection = await this.db.getConnection();

        try {
          await connection.beginTransaction();

          if (direction === "up") {
            if (typeof migrationModule.up === "function") {
              await migrationModule.up(connection);
              await connection.execute(
                "INSERT INTO migrations (name, batch) VALUES (?, ?)",
                [migration.name, batch],
              );
            } else {
              throw new Error('Migration module must export an "up" function');
            }
          } else {
            if (typeof migrationModule.down === "function") {
              await migrationModule.down(connection);
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
          throw error;
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
        throw error;
      }
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

    for (const seeder of seeders) {
      try {
        console.log(`🌱 Running seeder: ${seeder.name}`);

        const seederUrl = new URL(`file://${seeder.path}`);
        const seederModule = await import(seederUrl.href);

        const connection = await this.db.getConnection();

        try {
          await connection.beginTransaction();

          if (typeof seederModule.up === "function") {
            await seederModule.up(connection);
            await connection.commit();
            console.log(`✅ Seeder completed: ${seeder.name}`);
          } else {
            throw new Error('Seeder module must export an "up" function');
          }
        } catch (error) {
          await connection.rollback();
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

  // async getStatus() {
  //   await this.initialize();

  //   const executed = await this.getExecutedMigrations();
  //   const files = await this.getMigrationFiles();

  //   const status = files.map(file => ({
  //     name: file.name,
  //     status: executed.includes(file.name) ? 'applied' : 'pending',
  //     appliedAt: executed.includes(file.name) ?
  //       (await this.db.execute('SELECT executed_at FROM migrations WHERE name = ?', [file.name]))[0][0]?.executed_at :
  //       null
  //   }));

  //   return {
  //     total: files.length,
  //     applied: executed.length,
  //     pending: files.length - executed.length,
  //     migrations: status
  //   };
  // }

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

  const runner = new MigrationRunner();

  try {
    switch (command) {
      case "up":
        await runner.runMigrations("up");
        break;

      case "down":
        await runner.runMigrations("down");
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
          console.log(`${statusIcon} ${migration.name} - ${migration.status}`);
        });
        break;

      case "reset":
        console.log("⚠️  Resetting all migrations...");
        await runner.runMigrations("down");
        console.log("✅ All migrations rolled back");
        break;

      default:
        console.log("🚀 Migration Runner Commands:");
        console.log(
          "  npm run migrate:up                    Run pending migrations",
        );
        console.log(
          "  npm run migrate:down                  Rollback last migration",
        );
        console.log(
          "  npm run migrate:create <name>         Create new migration",
        );
        console.log("  npm run migrate:seed                  Run seeders");
        console.log(
          "  npm run migrate:status                Show migration status",
        );
        console.log(
          "  npm run migrate:reset                 Rollback all migrations",
        );
        break;
    }
  } catch (error) {
    console.error("❌ Error:", error.message);
    process.exit(1);
  } finally {
    await runner.close();
  }
}

main();
