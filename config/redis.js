import redis from "redis";
import dotenv from "dotenv";

dotenv.config();

class Redis {
  constructor() {
    this.redisClient = null;
    this.redisAsync = null;
  }

  async initializeRedis() {
    try {
      this.redisClient = redis.createClient({
        socket: {
          host: process.env.REDIS_HOST,
          port: parseInt(process.env.REDIS_PORT),
          tls: process.env.REDIS_TLS === "true",
        },
        password: process.env.REDIS_PASSWORD || undefined,
        database: parseInt(process.env.REDIS_DB),
      });

      this.redisClient.on("error", (err) => {
        console.error("Redis Client Error:", err);
      });

      this.redisClient.on("connect", () => {
        console.log("✅ Redis connected successfully");
      });

      await this.redisClient.connect();

      // Promisify Redis commands
      this.redisAsync = {
        get: this.redisClient.get.bind(this.redisClient),
        set: this.redisClient.set.bind(this.redisClient),
        setEx: this.redisClient.setEx.bind(this.redisClient),
        del: this.redisClient.del.bind(this.redisClient),
        exists: this.redisClient.exists.bind(this.redisClient),
        keys: this.redisClient.keys.bind(this.redisClient),
        expire: this.redisClient.expire.bind(this.redisClient),
        hSet: this.redisClient.hSet.bind(this.redisClient),
        hGet: this.redisClient.hGet.bind(this.redisClient),
        hGetAll: this.redisClient.hGetAll.bind(this.redisClient),
        flushDb: this.redisClient.flushDb.bind(this.redisClient),
        quit: this.redisClient.quit.bind(this.redisClient),
      };

      return this.redisAsync;
    } catch (error) {
      console.error("❌ Redis connection failed:", error);
      throw error;
    }
  }

  async closeConnections() {
    try {
      if (this.redisClient) {
        await this.redisAsync.quit();
        console.log("✅ Redis connection closed");
      }
    } catch (error) {
      console.error("Error closing connections:", error);
    }
  }

  getRedis() {
    if (!this.redisAsync) {
      throw new Error("Redis client not initialized");
    }
    return this.redisAsync;
  }
}

export default new Redis();
