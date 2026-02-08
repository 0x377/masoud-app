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
        release: () => connection.release(),
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

  async close() {
    if (this.pool) {
      await this.pool.end();
      console.log("Database connection closed");
    }
  }

  /**
   * اختبار الاتصال مع قاعدة البيانات
   */
  async testConnection() {
    try {
      console.log("🔄 Testing database connection...");

      if (!this.pool) {
        await this.connect();
      }

      const connection = await this.pool.getConnection();

      // اختبار استعلام بسيط
      const [result] = await connection.execute("SELECT 1 + 1 AS result");
      console.log(`✅ Database test query result: ${result[0].result}`);

      connection.release();

      return {
        success: true,
        message: "Database connection test successful",
        result: result[0].result,
      };
    } catch (error) {
      console.error("❌ Database connection test failed:", error.message);
      return {
        success: false,
        message: "Database connection test failed",
        error: error.message,
      };
    }
  }

  /**
   * الحصول على معلومات قاعدة البيانات
   */
  async getDatabaseInfo() {
    try {
      console.log("📊 Getting database information...");

      if (!this.pool) {
        await this.connect();
      }

      const queries = [
        { name: "Database Version", sql: "SELECT VERSION() as version" },
        { name: "Current Database", sql: "SELECT DATABASE() as db" },
        {
          name: "Connection Count",
          sql: 'SHOW STATUS LIKE "Threads_connected"',
        },
        {
          name: "Tables Count",
          sql: `SELECT COUNT(*) as count FROM information_schema.tables WHERE table_schema = ?`,
        },
      ];

      const results = {};

      for (const query of queries) {
        try {
          const rows = await this.query(
            query.sql,
            query.sql.includes("?") ? [this.config.database] : [],
          );
          results[query.name] = rows[0];
        } catch (err) {
          results[query.name] = { error: err.message };
        }
      }

      console.log("✅ Database information retrieved");
      return results;
    } catch (error) {
      console.error("❌ Failed to get database info:", error);
      throw error;
    }
  }
}

const db = new Database();

// اختبار غير متزامن للاتصال
async function runDatabaseTests() {
  try {
    console.log("🚀 Starting database tests...");

    // 1. اختبار الاتصال
    console.log("\n📡 Test 1: Testing connection...");
    const connectionTest = await db.testConnection();
    console.log(
      "Connection test result:",
      connectionTest.success ? "✅ PASSED" : "❌ FAILED",
    );

    // 2. الحصول على معلومات قاعدة البيانات
    console.log("\n📊 Test 2: Getting database info...");
    const dbInfo = await db.getDatabaseInfo();
    console.log("Database Info:");
    Object.entries(dbInfo).forEach(([key, value]) => {
      console.log(
        `  ${key}:`,
        value.error ? `Error: ${value.error}` : JSON.stringify(value),
      );
    });

    // 3. اختبار استعلام بسيط
    console.log("\n🔍 Test 3: Simple query test...");
    try {
      const usersCount = await db.query("SELECT COUNT(*) as count FROM users");
      console.log(`✅ Users table count: ${usersCount[0].count}`);
    } catch (error) {
      console.log(
        `⚠️  Users table query: ${error.code === "ER_NO_SUCH_TABLE" ? "Table does not exist yet" : error.message}`,
      );
    }

    // 4. اختبار المعاملة (Transaction)
    console.log("\n💳 Test 4: Transaction test...");
    try {
      await db.transaction(async (connection) => {
        const result = await connection.query("SELECT 1");
        console.log(
          `✅ Transaction test query result: ${JSON.stringify(result)}`,
        );
      });
      console.log("✅ Transaction test passed");
    } catch (error) {
      console.log(`❌ Transaction test failed: ${error.message}`);
    }

    // 5. اختبار الأداء
    console.log("\n⚡ Test 5: Performance test...");
    const startTime = Date.now();
    const promises = [];

    // تنفيذ 5 استعلامات متزامنة
    for (let i = 0; i < 5; i++) {
      promises.push(db.query("SELECT ? as test_value", [i]));
    }

    await Promise.all(promises);
    const endTime = Date.now();
    console.log(`✅ 5 concurrent queries executed in ${endTime - startTime}ms`);

    console.log("\n🎉 All database tests completed successfully!");

    // إغلاق الاتصال بعد الانتهاء
    console.log("\n🔌 Closing database connection...");
    await db.close();
    console.log("✅ Database tests finished!");
  } catch (error) {
    console.error("\n💥 Database tests failed:", error);

    // محاولة إغلاق الاتصال في حالة الخطأ
    try {
      await db.close();
    } catch (closeError) {
      console.error("Error closing database:", closeError);
    }

    process.exit(1);
  }
}

// إذا تم تشغيل الملف مباشرة
if (import.meta.url === `file://${process.argv[1]}`) {
  runDatabaseTests().catch(console.error);
}

export { db, Database };
export default db;

// import mysql from "mysql2/promise";
// import config from "../config/index.js";

// class Database {
//   constructor() {
//     this.pool = null;
//     this.config = {
//       host: config.database.host,
//       port: config.database.port,
//       user: config.database.user,
//       password: config.database.password,
//       database: config.database.name,
//       waitForConnections: true,
//       connectionLimit: config.database.connectionLimit,
//       queueLimit: 0,
//       enableKeepAlive: true,
//       keepAliveInitialDelay: 0,
//       timezone: config.database.timezone,
//       charset: config.database.charset,
//       dateStrings: true,
//     };
//   }

//   async connect() {
//     try {
//       this.pool = mysql.createPool(this.config);

//       // Test connection
//       const connection = await this.pool.getConnection();
//       console.log("✅ Database connected successfully");
//       connection.release();

//       return this.pool;
//     } catch (error) {
//       console.error("❌ Database connection failed:", error);
//       throw error;
//     }
//   }

//   async query(sql, params = []) {
//     if (!this.pool) {
//       await this.connect();
//     }

//     try {
//       const [rows, fields] = await this.pool.execute(sql, params);
//       return rows;
//     } catch (error) {
//       console.error("Database query error:", error);
//       throw error;
//     }
//   }

//   async transaction(callback) {
//     if (!this.pool) {
//       await this.connect();
//     }

//     const connection = await this.pool.getConnection();

//     try {
//       await connection.beginTransaction();

//       // Create a wrapped connection with query method
//       const wrappedConnection = {
//         query: async (sql, params) => {
//           const [results] = await connection.execute(sql, params);
//           return results;
//         },
//         execute: async (sql, params) => {
//           return await connection.execute(sql, params);
//         },
//         release: () => connection.release(),
//         // Add other methods you might need
//       };

//       const result = await callback(wrappedConnection);
//       await connection.commit();
//       return result;
//     } catch (error) {
//       await connection.rollback();
//       throw error;
//     } finally {
//       connection.release();
//     }
//   }

//   // async transaction(callback) {
//   //   if (!this.pool) {
//   //     await this.connect();
//   //   }

//   //   const connection = await this.pool.getConnection();

//   //   try {
//   //     await connection.beginTransaction();
//   //     const result = await callback(connection);
//   //     await connection.commit();
//   //     return result;
//   //   } catch (error) {
//   //     await connection.rollback();
//   //     throw error;
//   //   } finally {
//   //     connection.release();
//   //   }
//   // }

//   async close() {
//     if (this.pool) {
//       await this.pool.end();
//       console.log("Database connection closed");
//     }
//   }
// }

// const db = new Database();

// console.log(`Database Connection: ${db.connect()}`);

// console.log(`Database Close: ${db.close()}`);
