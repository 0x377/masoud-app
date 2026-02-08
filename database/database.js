import mysql from "mysql2/promise";
import config from "../config/index.js";

class Database {
  constructor() {
    this.pool = null;
    this.config = {
      host: config.database.host,
      port: config.database.port,
      user: config.database.user,
      password: config.database.password,
      database: config.database.name,
      waitForConnections: true,
      connectionLimit: config.database.connectionLimit,
      queueLimit: 0,
      enableKeepAlive: true,
      keepAliveInitialDelay: 0,
      timezone: config.database.timezone,
      charset: config.database.charset,
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
      const [rows, fields] = await this.pool.execute(sql, params);
      return rows;
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

      // Create a wrapped connection with query method
      const wrappedConnection = {
        query: async (sql, params) => {
          const [results] = await connection.execute(sql, params);
          return results;
        },
        execute: async (sql, params) => {
          return await connection.execute(sql, params);
        },
        // Don't expose release method to prevent double release
      };

      const result = await callback(wrappedConnection);
      await connection.commit();
      return result;
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }

  // async transaction(callback) {
  //   if (!this.pool) {
  //     await this.connect();
  //   }

  //   const connection = await this.pool.getConnection();

  //   try {
  //     await connection.beginTransaction();

  //     // Create a wrapped connection with query method
  //     const wrappedConnection = {
  //       query: async (sql, params) => {
  //         const [results] = await connection.execute(sql, params);
  //         return results;
  //       },
  //       execute: async (sql, params) => {
  //         return await connection.execute(sql, params);
  //       },
  //       release: () => connection.release(),
  //     };

  //     const result = await callback(wrappedConnection);
  //     await connection.commit();
  //     return result;
  //   } catch (error) {
  //     await connection.rollback();
  //     throw error;
  //   } finally {
  //     connection.release();
  //   }
  // }

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log("Database connection closed");
    }
  }
}

const db = new Database();

export { Database };
export default db;
