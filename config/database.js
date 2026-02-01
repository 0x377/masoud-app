import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

class Database {
  constructor() {
    this.pool = null;
    this.config = {
      host: process.env.DB_HOST || "localhost",
      port: process.env.DB_PORT || 3306,
      user: process.env.DB_USER || "manage",
      password: process.env.DB_PASSWORD || "Master@123",
      database: process.env.DB_NAME || "masoud_db",
      waitForConnections: true,
      connectionLimit: process.env.DB_POOL_LIMIT || 10,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: "UTC",
      charset: "utf8mb4",
      dateStrings: true,
    };
  }

  async connect() {
    try {
      this.pool = mysql.createPool(this.config);

      // Test connection
      const connection = await this.pool.getConnection();
      console.log("✅ Database connected successfully");
      connection.release();

      return this.pool;
    } catch (error) {
      console.error("❌ Database connection failed:", error);
      throw error;
    }
  }

  async query(sql, params = []) {
    if (!this.pool) {
      await this.connect();
    }

    try {
      const [results] = await this.pool.execute(sql, params);
      return results;
    } catch (error) {
      console.error("Database query error:", error);
      throw error;
    }
  }

  async transaction(callback) {
    if (!this.pool) {
      await this.connect();
    }

    const connection = await this.pool.getConnection();

    try {
      await connection.beginTransaction();
      const result = await callback(connection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log("Database connection closed");
    }
  }
}

export default new Database();
