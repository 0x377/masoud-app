// utils/securityLogger.js
import SecurityLog from "../models/SecurityLog.js";
import config from "../config/index.js";

// Security event types
export const SECURITY_EVENTS = {
  // Authentication events
  LOGIN_SUCCESS: "LOGIN_SUCCESS",
  LOGIN_FAILED: "LOGIN_FAILED",
  LOGOUT: "LOGOUT",
  SESSION_CREATED: "SESSION_CREATED",
  SESSION_EXPIRED: "SESSION_EXPIRED",
  SESSION_TERMINATED: "SESSION_TERMINATED",

  // Registration events
  REGISTRATION_SUCCESS: "REGISTRATION_SUCCESS",
  REGISTRATION_FAILED: "REGISTRATION_FAILED",
  REGISTRATION_VALIDATION_FAILED: "REGISTRATION_VALIDATION_FAILED",

  // Password events
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_SUCCESS: "PASSWORD_RESET_SUCCESS",
  PASSWORD_RESET_FAILED: "PASSWORD_RESET_FAILED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_CHANGE_FAILED: "PASSWORD_CHANGE_FAILED",

  // Verification events
  VERIFICATION_SUCCESS: "VERIFICATION_SUCCESS",
  VERIFICATION_FAILED: "VERIFICATION_FAILED",
  VERIFICATION_CODE_SENT: "VERIFICATION_CODE_SENT",
  VERIFICATION_CODE_INVALID: "VERIFICATION_CODE_INVALID",

  // 2FA/MFA events
  MFA_ENABLED: "MFA_ENABLED",
  MFA_DISABLED: "MFA_DISABLED",
  MFA_VERIFICATION_SUCCESS: "MFA_VERIFICATION_SUCCESS",
  MFA_VERIFICATION_FAILED: "MFA_VERIFICATION_FAILED",

  // Authorization events
  UNAUTHORIZED_ACCESS: "UNAUTHORIZED_ACCESS",
  PERMISSION_DENIED: "PERMISSION_DENIED",
  ROLE_CHANGED: "ROLE_CHANGED",

  // API events
  API_RATE_LIMIT_EXCEEDED: "API_RATE_LIMIT_EXCEEDED",
  API_VALIDATION_FAILED: "API_VALIDATION_FAILED",
  API_ERROR: "API_ERROR",

  // System events
  CONFIGURATION_CHANGE: "CONFIGURATION_CHANGE",
  SYSTEM_ERROR: "SYSTEM_ERROR",
  DATABASE_ERROR: "DATABASE_ERROR",

  // Suspicious activities
  SUSPICIOUS_LOGIN_ATTEMPT: "SUSPICIOUS_LOGIN_ATTEMPT",
  BRUTE_FORCE_ATTEMPT: "BRUTE_FORCE_ATTEMPT",
  IP_BLOCKED: "IP_BLOCKED",
  USER_BLOCKED: "USER_BLOCKED",

  // Data access events
  DATA_ACCESS: "DATA_ACCESS",
  DATA_MODIFICATION: "DATA_MODIFICATION",
  DATA_DELETION: "DATA_DELETION",
  DATA_EXPORT: "DATA_EXPORT",

  // User management events
  USER_CREATED: "USER_CREATED",
  USER_UPDATED: "USER_UPDATED",
  USER_DELETED: "USER_DELETED",
  USER_STATUS_CHANGED: "USER_STATUS_CHANGED",

  // Account events
  ACCOUNT_LOCKED: "ACCOUNT_LOCKED",
  ACCOUNT_UNLOCKED: "ACCOUNT_UNLOCKED",
  ACCOUNT_SUSPENDED: "ACCOUNT_SUSPENDED",

  // Token events
  TOKEN_GENERATED: "TOKEN_GENERATED",
  TOKEN_REVOKED: "TOKEN_REVOKED",
  TOKEN_EXPIRED: "TOKEN_EXPIRED",
  TOKEN_TAMPERED: "TOKEN_TAMPERED",
};

// Security levels
export const SECURITY_LEVELS = {
  LOW: "LOW",
  MEDIUM: "MEDIUM",
  HIGH: "HIGH",
  CRITICAL: "CRITICAL",
};

// Helper function to extract IP address from request
export const getClientIP = (req) => {
  if (!req) return "unknown";

  // Check for forwarded IP (when behind proxy)
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) {
    const ips = forwarded.split(",");
    return ips[0].trim();
  }

  // Check for real IP header
  const realIP = req.headers["x-real-ip"];
  if (realIP) return realIP;

  // Get connection remote address
  return req.ip || req.connection?.remoteAddress || "unknown";
};

// Helper function to extract user agent details
export const getUserAgentDetails = (userAgent) => {
  if (!userAgent)
    return { browser: "unknown", os: "unknown", device: "unknown" };

  // Simple parsing (consider using a library like ua-parser-js for production)
  const ua = userAgent.toLowerCase();

  const details = {
    browser: "unknown",
    os: "unknown",
    device: "unknown",
    isMobile: false,
    isBot: false,
  };

  // Browser detection
  if (ua.includes("chrome") && !ua.includes("edg")) details.browser = "chrome";
  else if (ua.includes("firefox")) details.browser = "firefox";
  else if (ua.includes("safari") && !ua.includes("chrome"))
    details.browser = "safari";
  else if (ua.includes("edge")) details.browser = "edge";
  else if (ua.includes("opera")) details.browser = "opera";
  else if (ua.includes("msie") || ua.includes("trident"))
    details.browser = "ie";

  // OS detection
  if (ua.includes("windows")) details.os = "windows";
  else if (ua.includes("mac os")) details.os = "macos";
  else if (ua.includes("linux")) details.os = "linux";
  else if (ua.includes("android")) details.os = "android";
  else if (ua.includes("ios") || ua.includes("iphone") || ua.includes("ipad"))
    details.os = "ios";

  // Device type
  if (ua.includes("mobile")) {
    details.device = "mobile";
    details.isMobile = true;
  } else if (ua.includes("tablet")) {
    details.device = "tablet";
    details.isMobile = true;
  } else {
    details.device = "desktop";
  }

  // Bot detection
  if (ua.includes("bot") || ua.includes("crawler") || ua.includes("spider")) {
    details.isBot = true;
  }

  return details;
};

// Helper function to determine security level based on event type
const getSecurityLevel = (eventType, details = {}) => {
  const criticalEvents = [
    SECURITY_EVENTS.UNAUTHORIZED_ACCESS,
    SECURITY_EVENTS.BRUTE_FORCE_ATTEMPT,
    SECURITY_EVENTS.IP_BLOCKED,
    SECURITY_EVENTS.USER_BLOCKED,
    SECURITY_EVENTS.TOKEN_TAMPERED,
    SECURITY_EVENTS.SYSTEM_ERROR,
    SECURITY_EVENTS.DATABASE_ERROR,
  ];

  const highEvents = [
    SECURITY_EVENTS.PASSWORD_RESET_FAILED,
    SECURITY_EVENTS.PASSWORD_CHANGE_FAILED,
    SECURITY_EVENTS.MFA_VERIFICATION_FAILED,
    SECURITY_EVENTS.SUSPICIOUS_LOGIN_ATTEMPT,
    SECURITY_EVENTS.ACCOUNT_LOCKED,
    SECURITY_EVENTS.ACCOUNT_SUSPENDED,
    SECURITY_EVENTS.DATA_DELETION,
    SECURITY_EVENTS.DATA_EXPORT,
  ];

  const mediumEvents = [
    SECURITY_EVENTS.LOGIN_FAILED,
    SECURITY_EVENTS.REGISTRATION_FAILED,
    SECURITY_EVENTS.VERIFICATION_FAILED,
    SECURITY_EVENTS.API_RATE_LIMIT_EXCEEDED,
    SECURITY_EVENTS.PERMISSION_DENIED,
    SECURITY_EVENTS.DATA_MODIFICATION,
  ];

  if (criticalEvents.includes(eventType)) return SECURITY_LEVELS.CRITICAL;
  if (highEvents.includes(eventType)) return SECURITY_LEVELS.HIGH;
  if (mediumEvents.includes(eventType)) return SECURITY_LEVELS.MEDIUM;

  return SECURITY_LEVELS.LOW;
};

// Helper function to sanitize sensitive data in logs
const sanitizeLogData = (data) => {
  if (!data || typeof data !== "object") return data;

  const sensitiveFields = [
    "password",
    "token",
    "secret",
    "key",
    "auth",
    "credential",
    "ssn",
    "national_id",
    "passport",
    "credit_card",
    "cvv",
    "phone",
    "email",
    "address",
    "dob",
    "signature",
    "private_key",
    "api_key",
    "access_token",
    "refresh_token",
    "mfa_secret",
    "otp",
    "pin",
    "verification_code",
  ];

  const sanitized = { ...data };

  sensitiveFields.forEach((field) => {
    if (sanitized[field] !== undefined) {
      sanitized[field] = "[REDACTED]";
    }
  });

  // Recursively sanitize nested objects
  Object.keys(sanitized).forEach((key) => {
    if (typeof sanitized[key] === "object" && sanitized[key] !== null) {
      sanitized[key] = sanitizeLogData(sanitized[key]);
    }
  });

  return sanitized;
};

// Helper function to format log details
const formatLogDetails = (details = {}) => {
  try {
    return JSON.stringify(sanitizeLogData(details));
  } catch (error) {
    console.error("Failed to format log details:", error);
    return JSON.stringify({ error: "Failed to format details" });
  }
};

// Main security logging function
export const logSecurityEvent = async (
  userId = null,
  eventType,
  req = null,
  additionalDetails = {},
  options = {},
) => {
  const startTime = Date.now();

  try {
    // Skip logging in test environment if configured
    if (config.env === "test" && !options.forceLog) {
      return true;
    }

    // Prepare log data
    const logData = {
      event_type: eventType,
      user_id: userId,
      security_level: getSecurityLevel(eventType, additionalDetails),
      ip_address: req ? getClientIP(req) : "system",
      user_agent: req?.headers?.["user-agent"] || "system",
      user_agent_details: req?.headers?.["user-agent"]
        ? JSON.stringify(getUserAgentDetails(req.headers["user-agent"]))
        : null,
      details: formatLogDetails({
        ...additionalDetails,
        timestamp: new Date().toISOString(),
        environment: config.env,
        service: options.service || "api",
        requestId: req?.requestId || additionalDetails.requestId,
        correlationId: req?.correlationId || additionalDetails.correlationId,
      }),
      metadata: JSON.stringify({
        source: options.source || "security-logger",
        logVersion: "1.0",
        processingTime: Date.now() - startTime,
      }),
    };

    // Log to console in development
    if (config.env === "development") {
      console.log(
        `[SECURITY] ${eventType} - User: ${userId || "system"} - IP: ${logData.ip_address}`,
      );
      if (options.verbose) {
        console.log("Security Log Details:", logData);
      }
    }

    // Save to database if SecurityLog model exists
    if (SecurityLog && typeof SecurityLog.create === "function") {
      await SecurityLog.create(logData);

      // Check if we need to trigger alerts
      if (
        logData.security_level === SECURITY_LEVELS.CRITICAL ||
        logData.security_level === SECURITY_LEVELS.HIGH
      ) {
        await triggerSecurityAlert(logData, options);
      }

      // Check if we need to perform automatic actions
      await performAutomaticActions(logData, options);
    }

    return true;
  } catch (error) {
    // Use console.error for logging errors to prevent infinite loops
    console.error("Failed to log security event:", {
      eventType,
      userId,
      error: error.message,
      stack: config.env === "development" ? error.stack : undefined,
    });

    // Fallback: log to error log file or external service
    await logToFallback({
      eventType,
      userId,
      error: error.message,
      timestamp: new Date().toISOString(),
    });

    return false;
  }
};

// Trigger security alerts for critical events
const triggerSecurityAlert = async (logData, options = {}) => {
  try {
    // Check if alerts are enabled in config
    if (!config.security?.alerts?.enabled) return;

    const alertConfig = config.security.alerts;

    // Skip if event type is in excluded list
    if (alertConfig.excludedEvents?.includes(logData.event_type)) return;

    // Prepare alert data
    const alertData = {
      event: logData.event_type,
      level: logData.security_level,
      userId: logData.user_id,
      ipAddress: logData.ip_address,
      timestamp: new Date().toISOString(),
      details: logData.details,
      source: "security-logger",
    };

    // Send to external alerting service (implement based on your needs)
    // Example: Send to Slack, Email, PagerDuty, etc.
    if (alertConfig.slackWebhook) {
      await sendSlackAlert(alertData, alertConfig.slackWebhook);
    }

    if (alertConfig.emailRecipients?.length > 0) {
      await sendEmailAlert(alertData, alertConfig.emailRecipients);
    }

    // Log that alert was triggered
    if (config.env === "development") {
      console.log(`[ALERT] Security alert triggered: ${logData.event_type}`);
    }
  } catch (error) {
    console.error("Failed to trigger security alert:", error);
  }
};

// Perform automatic actions based on security events
const performAutomaticActions = async (logData, options = {}) => {
  try {
    const autoActions = config.security?.autoActions || {};

    // Automatic IP blocking for brute force attempts
    if (
      logData.event_type === SECURITY_EVENTS.BRUTE_FORCE_ATTEMPT &&
      autoActions.blockIpOnBruteForce
    ) {
      await blockIPAddress(logData.ip_address, "BRUTE_FORCE_ATTEMPT");
    }

    // Automatic user blocking for multiple failed logins
    if (
      logData.event_type === SECURITY_EVENTS.LOGIN_FAILED &&
      autoActions.blockUserAfterFailedAttempts
    ) {
      const failedCount = await getFailedLoginCount(
        logData.user_id,
        logData.ip_address,
      );
      if (failedCount >= (autoActions.maxFailedAttempts || 5)) {
        await blockUserAccount(logData.user_id, "TOO_MANY_FAILED_LOGINS");
      }
    }

    // Automatic session termination for suspicious activities
    if (
      logData.event_type === SECURITY_EVENTS.SUSPICIOUS_LOGIN_ATTEMPT &&
      autoActions.terminateSessionsOnSuspicion
    ) {
      await terminateUserSessions(logData.user_id);
    }
  } catch (error) {
    console.error("Failed to perform automatic actions:", error);
  }
};

// Fallback logging method
const logToFallback = async (data) => {
  try {
    // Log to file system
    const fs = await import("fs");
    const path = await import("path");

    const logDir = path.join(process.cwd(), "logs", "security");
    const logFile = path.join(
      logDir,
      `${new Date().toISOString().split("T")[0]}.log`,
    );

    // Create directory if it doesn't exist
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    const logEntry = `${new Date().toISOString()} - ${JSON.stringify(data)}\n`;
    fs.appendFileSync(logFile, logEntry, "utf8");
  } catch (error) {
    // Last resort: log to stderr
    console.error("SECURITY LOG FALLBACK FAILED:", data);
  }
};

// Helper functions for automatic actions (implement based on your needs)
const blockIPAddress = async (ipAddress, reason) => {
  // Implement IP blocking logic
  console.log(`[AUTO ACTION] Blocking IP ${ipAddress}: ${reason}`);
  // Example: await BlockedIP.create({ ip_address: ipAddress, reason, blocked_until: ... });
};

const getFailedLoginCount = async (userId, ipAddress) => {
  // Implement logic to count recent failed logins
  return 0;
};

const blockUserAccount = async (userId, reason) => {
  // Implement user blocking logic
  console.log(`[AUTO ACTION] Blocking user ${userId}: ${reason}`);
  // Example: await User.update({ status: 'BLOCKED' }, { where: { id: userId } });
};

const terminateUserSessions = async (userId) => {
  // Implement session termination logic
  console.log(`[AUTO ACTION] Terminating sessions for user ${userId}`);
  // Example: await Session.update({ is_active: false }, { where: { user_id: userId } });
};

// Alert sending functions (implement based on your needs)
const sendSlackAlert = async (alertData, webhookUrl) => {
  // Implement Slack webhook integration
  console.log(`[SLACK ALERT] ${alertData.event} - ${alertData.level}`);
};

const sendEmailAlert = async (alertData, recipients) => {
  // Implement email alert integration
  console.log(`[EMAIL ALERT] ${alertData.event} to ${recipients.join(", ")}`);
};

// Additional utility functions

// Batch log multiple events
export const logBatchSecurityEvents = async (events) => {
  try {
    const results = await Promise.allSettled(
      events.map((event) => logSecurityEvent(...event)),
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.warn(`Failed to log ${failed.length} security events`);
    }

    return {
      success: results.length - failed.length,
      failed: failed.length,
      results,
    };
  } catch (error) {
    console.error("Batch security logging failed:", error);
    return { success: 0, failed: events.length, error: error.message };
  }
};

// Query security logs
export const querySecurityLogs = async (filters = {}, options = {}) => {
  try {
    if (!SecurityLog || typeof SecurityLog.findAndCountAll !== "function") {
      throw new Error("SecurityLog model not available");
    }

    const whereClause = {};

    // Apply filters
    if (filters.userId) whereClause.user_id = filters.userId;
    if (filters.eventType) whereClause.event_type = filters.eventType;
    if (filters.securityLevel)
      whereClause.security_level = filters.securityLevel;
    if (filters.ipAddress) whereClause.ip_address = filters.ipAddress;

    // Date range filter
    if (filters.startDate || filters.endDate) {
      whereClause.created_at = {};
      if (filters.startDate)
        whereClause.created_at[Op.gte] = new Date(filters.startDate);
      if (filters.endDate)
        whereClause.created_at[Op.lte] = new Date(filters.endDate);
    }

    const queryOptions = {
      where: whereClause,
      order: [["created_at", "DESC"]],
      limit: options.limit || 100,
      offset: options.offset || 0,
    };

    const { rows, count } = await SecurityLog.findAndCountAll(queryOptions);

    return {
      success: true,
      data: rows,
      total: count,
      limit: queryOptions.limit,
      offset: queryOptions.offset,
    };
  } catch (error) {
    console.error("Failed to query security logs:", error);
    return { success: false, error: error.message };
  }
};

// Export summary statistics
export const getSecurityStats = async (period = "24h") => {
  try {
    const periods = {
      "24h": 24 * 60 * 60 * 1000,
      "7d": 7 * 24 * 60 * 60 * 1000,
      "30d": 30 * 24 * 60 * 60 * 1000,
    };

    const timeAgo = new Date(Date.now() - (periods[period] || periods["24h"]));

    const stats = await SecurityLog.findAll({
      attributes: [
        "event_type",
        "security_level",
        [Sequelize.fn("COUNT", Sequelize.col("id")), "count"],
      ],
      where: {
        created_at: {
          [Op.gte]: timeAgo,
        },
      },
      group: ["event_type", "security_level"],
      raw: true,
    });

    // Transform to a more usable format
    const result = {
      period,
      startTime: timeAgo.toISOString(),
      endTime: new Date().toISOString(),
      totalEvents: stats.reduce((sum, item) => sum + parseInt(item.count), 0),
      byEventType: {},
      bySecurityLevel: {
        [SECURITY_LEVELS.CRITICAL]: 0,
        [SECURITY_LEVELS.HIGH]: 0,
        [SECURITY_LEVELS.MEDIUM]: 0,
        [SECURITY_LEVELS.LOW]: 0,
      },
    };

    stats.forEach((item) => {
      // Group by event type
      if (!result.byEventType[item.event_type]) {
        result.byEventType[item.event_type] = 0;
      }
      result.byEventType[item.event_type] += parseInt(item.count);

      // Group by security level
      if (result.bySecurityLevel[item.security_level] !== undefined) {
        result.bySecurityLevel[item.security_level] += parseInt(item.count);
      }
    });

    return { success: true, data: result };
  } catch (error) {
    console.error("Failed to get security stats:", error);
    return { success: false, error: error.message };
  }
};

// Export the module
export default {
  logSecurityEvent,
  logBatchSecurityEvents,
  querySecurityLogs,
  getSecurityStats,
  SECURITY_EVENTS,
  SECURITY_LEVELS,
  getClientIP,
  getUserAgentDetails,
};
