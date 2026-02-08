import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
dotenv.config({ path: path.join(__dirname, "../.env") });

const config = {
  // App Configuration
  app: {
    name: process.env.APP_NAME || "Masoud",
    env: process.env.NODE_ENV || "development",
    port: parseInt(process.env.PORT || "4000"),
    url: process.env.APP_URL || "http://localhost:4000",
    debug: process.env.APP_DEBUG === "true",
    key: process.env.APP_KEY,
    locale: process.env.APP_LOCALE || "en",
    fallbackLocale: process.env.APP_FALLBACK_LOCALE || "en",
  },

  // Security
  security: {
    jwtSecret: process.env.JWT_SECRET || "your-default-jwt-secret-change-this",
    jwtExpiresIn: process.env.JWT_EXPIRES_IN || "24h",
    refreshSecret: process.env.JWT_REFRESH_SECRET || "your-refresh-secret",
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d",
    encryptionKey: process.env.ENCRYPTION_KEY,
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || "12"),
  },

  // Database
  database: {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    user: process.env.DB_USER || "root",
    password: process.env.DB_PASSWORD || "",
    name: process.env.DB_NAME || "masoud_db",
    pool: {
      min: parseInt(process.env.DB_POOL_MIN || "2"),
      max: parseInt(process.env.DB_POOL_MAX || "10"),
    },
    ssl: process.env.DB_SSL === "true",
    charset: process.env.DB_CHARSET || "utf8mb4",
    timezone: process.env.DB_TIMEZONE || "+00:00",
    connectionLimit: process.env.DB_CONNECTION_LIMIT || 10,
  },

  // Redis
  redis: {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || "",
    db: parseInt(process.env.REDIS_DB || "0"),
    tls: process.env.REDIS_TLS === "true",
  },

  // Session
  session: {
    driver: process.env.SESSION_DRIVER || "database",
    secret: process.env.SESSION_SECRET || "your-session-secret",
    lifetime: parseInt(process.env.SESSION_LIFETIME || "120"),
    encrypt: process.env.SESSION_ENCRYPT === "true",
    cookie: {
      name: process.env.SESSION_COOKIE_NAME || "masoud_session",
      path: process.env.SESSION_COOKIE_PATH || "/",
      domain: process.env.SESSION_COOKIE_DOMAIN,
      secure: process.env.SESSION_COOKIE_SECURE === "true",
      httpOnly: process.env.SESSION_COOKIE_HTTPONLY !== "true",
      sameSite: process.env.SESSION_COOKIE_SAMESITE || "lax",
    },
  },

  // Cache
  cache: {
    driver: process.env.CACHE_DRIVER || "database",
    prefix: process.env.CACHE_PREFIX || "masoud_cache",
    ttl: parseInt(process.env.CACHE_TTL || "3600"),
  },

  // Mail
  mail: {
    driver: process.env.MAIL_DRIVER || "smtp",
    host: process.env.MAIL_HOST || "smtp.gmail.com",
    port: parseInt(process.env.MAIL_PORT || "587"),
    username: process.env.MAIL_USERNAME,
    password: process.env.MAIL_PASSWORD,
    encryption: process.env.MAIL_ENCRYPTION || "tls",
    from: {
      address: process.env.MAIL_FROM_ADDRESS || "hello@masoud.com",
      name: process.env.MAIL_FROM_NAME || "Masoud Family Association",
    },
    verifySSL: process.env.MAIL_VERIFY_SSL !== "false",
  },

  // Storage
  storage: {
    driver: process.env.STORAGE_DRIVER || "local",
    uploadMaxSize: parseInt(process.env.UPLOAD_MAX_SIZE || "10485760"),
    allowedFileTypes: (
      process.env.ALLOWED_FILE_TYPES ||
      "image/jpeg,image/png,image/gif,application/pdf"
    ).split(","),
  },

  // AWS S3 (if using)
  aws: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_DEFAULT_REGION || "us-east-1",
    bucket: process.env.AWS_BUCKET,
    endpoint: process.env.AWS_ENDPOINT,
    usePathStyleEndpoint: process.env.AWS_USE_PATH_STYLE_ENDPOINT === "true",
  },

  // Logging
  logging: {
    level: process.env.LOG_LEVEL || "info",
    channel: process.env.LOG_CHANNEL || "console",
    filePath: process.env.LOG_FILE_PATH || "logs/app.log",
    maxSize: parseInt(process.env.LOG_MAX_SIZE || "10485760"),
    maxFiles: parseInt(process.env.LOG_MAX_FILES || "5"),
    datePattern: process.env.LOG_DATE_PATTERN || "YYYY-MM-DD",
    compress: process.env.LOG_COMPRESS !== "false",
  },

  // Rate Limiting
  rateLimit: {
    enabled: process.env.RATE_LIMIT_ENABLED !== "false",
    window: parseInt(process.env.RATE_LIMIT_WINDOW || "15"),
    max: parseInt(process.env.RATE_LIMIT_MAX || "100"),
    skipSuccessfulLogins:
      process.env.RATE_LIMIT_SKIP_SUCCESSFUL_LOGINS === "true",
  },

  // CORS
  cors: {
    enabled: process.env.CORS_ENABLED !== "false",
    origin: (
      process.env.CORS_ORIGIN || "http://localhost:3000,http://localhost:4000"
    ).split(","),
    methods: (
      process.env.CORS_METHODS || "GET,POST,PUT,PATCH,DELETE,OPTIONS"
    ).split(","),
    allowedHeaders: (
      process.env.CORS_ALLOWED_HEADERS ||
      "Content-Type,Authorization,X-Requested-With"
    ).split(","),
    exposedHeaders: (
      process.env.CORS_EXPOSED_HEADERS || "Content-Range,X-Content-Range"
    ).split(","),
    credentials: process.env.CORS_CREDENTIALS === "true",
    maxAge: parseInt(process.env.CORS_MAX_AGE || "86400"),
  },

  // API
  api: {
    prefix: process.env.API_PREFIX || "api",
    version: process.env.API_VERSION || "v1",
    rateLimit: parseInt(process.env.API_RATE_LIMIT || "60"),
    cacheTtl: parseInt(process.env.API_CACHE_TTL || "300"),
  },

  // Authentication
  auth: {
    tokenExpiry: parseInt(process.env.AUTH_TOKEN_EXPIRY || "86400"),
    refreshTokenExpiry: parseInt(
      process.env.AUTH_REFRESH_TOKEN_EXPIRY || "604800",
    ),
    maxDevices: parseInt(process.env.AUTH_MAX_DEVICES || "5"),
    passwordResetExpiry: parseInt(
      process.env.AUTH_PASSWORD_RESET_EXPIRY || "3600",
    ),
    emailVerificationExpiry: parseInt(
      process.env.AUTH_EMAIL_VERIFICATION_EXPIRY || "86400",
    ),
    phoneVerificationExpiry: parseInt(
      process.env.AUTH_PHONE_VERIFICATION_EXPIRY || "300",
    ),
    maxLoginAttempts: parseInt(process.env.AUTH_MAX_LOGIN_ATTEMPTS || "5"),
    lockoutTime: parseInt(process.env.AUTH_LOCKOUT_TIME || "900"),
    mfaEnabled: process.env.AUTH_MFA_ENABLED === "true",
    mfaExpiry: parseInt(process.env.AUTH_MFA_EXPIRY || "300"),
  },

  // Family Association Specific
  family: {
    name: process.env.FAMILY_ASSOCIATION_NAME || "Masoud Family Association",
    locale: process.env.FAMILY_ASSOCIATION_LOCALE || "ar",
    currency: process.env.FAMILY_ASSOCIATION_CURRENCY || "SAR",
    timezone: process.env.FAMILY_ASSOCIATION_TIMEZONE || "Asia/Riyadh",
    country: process.env.FAMILY_ASSOCIATION_COUNTRY || "SA",
    defaultLanguage: process.env.FAMILY_ASSOCIATION_DEFAULT_LANGUAGE || "ar",
    supportEmail:
      process.env.FAMILY_ASSOCIATION_SUPPORT_EMAIL || "support@masoud.com",
    supportPhone:
      process.env.FAMILY_ASSOCIATION_SUPPORT_PHONE || "+966500000000",
  },

  // Donation
  donation: {
    minAmount: parseFloat(process.env.DONATION_MIN_AMOUNT || "10"),
    maxAmount: parseFloat(process.env.DONATION_MAX_AMOUNT || "100000"),
    defaultCurrency: process.env.DONATION_DEFAULT_CURRENCY || "SAR",
    allowAnonymous: process.env.DONATION_ALLOW_ANONYMOUS !== "false",
    receiptEnabled: process.env.DONATION_RECEIPT_ENABLED === "true",
  },

  // Member
  member: {
    autoApprove: process.env.MEMBER_AUTO_APPROVE === "true",
    requireNationalId: process.env.MEMBER_REQUIRE_NATIONAL_ID !== "false",
    requireFamilyProof: process.env.MEMBER_REQUIRE_FAMILY_PROOF === "true",
    maxFamilySize: parseInt(process.env.MEMBER_MAX_FAMILY_SIZE || "50"),
    defaultStatus: process.env.MEMBER_DEFAULT_STATUS || "active",
  },

  // email
  // email: {
  //   apiKey: process.env.EMAIL_API_KEY || "",
  //   mailtrapHost: process.env.MAILTRAP_HOST || "",
  //   mailtrapPort: parseInt(process.env.MAILTRAP_PORT || "2525"),
  //   mailtrapUser: process.env.MAILTRAP_USERNAME || "",
  //   mailtrapPass: process.env.MAILTRAP_PASSWORD || "",
  //   mailtrapMail: process.env.MAILTRAP_SENDER_EMAIL || "",
  // },

  email: {
    apiKey: process.env.SENDGRID_API_KEY,
    mailtrapHost: process.env.MAILTRAP_HOST || "smtp.mailtrap.io",
    mailtrapPort: parseInt(process.env.MAILTRAP_PORT || "2525"),
    mailtrapUser: process.env.MAILTRAP_USERNAME,
    mailtrapPass: process.env.MAILTRAP_PASSWORD,
    mailtrapMail: process.env.MAILTRAP_SENDER_EMAIL || "noreply@example.com",
    from: process.env.EMAIL_FROM || "",
  },

  // Validate required environment variables
  validate: () => {
    const required = [
      "APP_KEY",
      "JWT_SECRET",
      "DB_HOST",
      "DB_USER",
      "DB_PASSWORD",
      "DB_NAME",
    ];

    const missing = required.filter((key) => !process.env[key]);

    if (missing.length > 0) {
      console.error("❌ Missing required environment variables:", missing);
      console.error("Please check your .env file");
      process.exit(1);
    }

    // Validate JWT secret length
    if (process.env.JWT_SECRET && process.env.JWT_SECRET.length < 32) {
      console.warn(
        "⚠️  Warning: JWT_SECRET is less than 32 characters. Consider using a longer secret for production.",
      );
    }

    console.log("✅ Environment variables loaded successfully");
  },
};

// Validate on load
config.validate();
export default config;
