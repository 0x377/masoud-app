// login.controller.js
import crypto from "crypto";
import userModel from "../../models/User.js";
import Session from "../../models/Session.js";
import LoginHistory from "../../models/LoginHistory.js";
import config from "../../config/index.js";
import { generateTokenPair, verifyToken } from "./token.controller.js";

// Constants
const ERROR_MESSAGES = {
  MISSING_CREDENTIALS: "Email and password are required",
  INVALID_CREDENTIALS: "Invalid email or password",
  ACCOUNT_LOCKED:
    "Account is temporarily locked due to too many failed attempts",
  ACCOUNT_INACTIVE: "Account is not active",
  EMAIL_NOT_VERIFIED: "Please verify your email before logging in",
  TOKEN_GENERATION_FAILED: "Failed to generate authentication token",
  SERVER_ERROR: "Internal server error",
  LOGOUT_FAILED: "Failed to logout properly",
};

const SUCCESS_MESSAGES = {
  LOGIN_SUCCESS: "Login successful",
  LOGOUT_SUCCESS: "Logged out successfully",
  MFA_REQUIRED: "Multi-factor authentication required",
};

const LOGIN_EVENTS = {
  SUCCESS: "LOGIN_SUCCESS",
  FAILED: "LOGIN_FAILED",
  MFA_REQUIRED: "MFA_REQUIRED",
  MFA_SUCCESS: "MFA_SUCCESS",
  LOGOUT: "LOGOUT",
};

// Helper function to validate login input
const validateLoginInput = (email, password) => {
  const errors = [];

  if (!email || !email.trim()) {
    errors.push("Email is required");
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    errors.push("Invalid email format");
  }

  if (!password || !password.trim()) {
    errors.push("Password is required");
  } else if (password.length < 8) {
    errors.push("Password must be at least 8 characters");
  }

  return {
    isValid: errors.length === 0,
    errors: errors.length > 0 ? errors : null,
  };
};

// Helper function to log security event
const logSecurityEvent = async (
  userId,
  eventType,
  req,
  additionalData = {},
) => {
  try {
    if (LoginHistory && typeof LoginHistory.create === "function") {
      await LoginHistory.create({
        user_id: userId,
        event_type: eventType,
        ip_address:
          req.ip ||
          req.headers["x-forwarded-for"] ||
          req.connection.remoteAddress,
        user_agent: req.headers["user-agent"] || "Unknown",
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...additionalData,
        }),
      });
    }
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
};

// Helper function to create session
const createUserSession = async (
  userId,
  req,
  accessToken,
  sessionData = {},
) => {
  try {
    const sessionId = crypto.randomBytes(32).toString("hex");
    const sessionInfo = {
      id: sessionId,
      user_id: userId,
      ip_address:
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress,
      user_agent: req.headers["user-agent"] || "Unknown",
      payload: JSON.stringify({
        accessToken,
        deviceInfo: {
          browser: req.useragent?.browser,
          platform: req.useragent?.platform,
          os: req.useragent?.os,
        },
        ...sessionData,
      }),
      last_activity: Math.floor(Date.now() / 1000),
      login_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    await Session.create(sessionInfo);
    return sessionId;
  } catch (error) {
    console.error("Session creation error:", error);
    return null;
  }
};

// Helper function to invalidate user sessions
const invalidateUserSessions = async (userId) => {
  try {
    await Session.update(
      { is_active: false, logged_out_at: new Date() },
      { where: { user_id: userId, is_active: true } },
    );
    return true;
  } catch (error) {
    console.error("Failed to invalidate sessions:", error);
    return false;
  }
};

// Main login function
export const login = async (req, res) => {
  const startTime = Date.now();
  const clientIp =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;
  const userAgent = req.headers["user-agent"] || "Unknown";

  try {
    const { email, password } = req.body;

    // Step 1: Validate input
    const validation = validateLoginInput(email, password);
    if (!validation.isValid) {
      await logSecurityEvent(null, LOGIN_EVENTS.FAILED, req, {
        reason: "Validation failed",
        errors: validation.errors,
      });

      return res.status(400).json({
        success: false,
        code: "VALIDATION_ERROR",
        message: ERROR_MESSAGES.MISSING_CREDENTIALS,
        details: validation.errors,
      });
    }

    // Step 2: Check if user exists and get basic info
    let user;
    try {
      user = await userModel.findByEmail(email);
    } catch (error) {
      console.error("User lookup error:", error);
      return res.status(500).json({
        success: false,
        code: "USER_LOOKUP_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    // Step 3: Check account status before authentication
    if (user) {
      // Check if account is locked
      if (
        user.failed_login_attempts >= (config.security?.maxFailedAttempts || 5)
      ) {
        const lockDuration = config.security?.lockDuration || 15; // minutes
        const lastFailedAttempt = new Date(user.last_failed_attempt);
        const lockExpiry = new Date(
          lastFailedAttempt.getTime() + lockDuration * 60 * 1000,
        );

        if (lockExpiry > new Date()) {
          await logSecurityEvent(user.id, LOGIN_EVENTS.FAILED, req, {
            reason: "Account locked",
            lockExpiry: lockExpiry.toISOString(),
          });

          return res.status(423).json({
            success: false,
            code: "ACCOUNT_LOCKED",
            message: ERROR_MESSAGES.ACCOUNT_LOCKED,
            retryAfter: Math.ceil((lockExpiry - new Date()) / 1000),
            lockedUntil: lockExpiry.toISOString(),
          });
        }
      }

      // Check if account is active
      if (user.status !== "ACTIVE") {
        switch (user.status) {
          case "PENDING_VERIFICATION":
            return res.status(403).json({
              success: false,
              code: "ACCOUNT_INACTIVE",
              redirect: "/verify-email",
              message: ERROR_MESSAGES.ACCOUNT_INACTIVE,
              accountStatus: user.status,
            });
          case "USER_INFO":
            return res.status(403).json({
              success: false,
              code: "ACCOUNT_INACTIVE",
              redirect: "/user-info",
              message: ERROR_MESSAGES.ACCOUNT_INACTIVE,
              accountStatus: user.status,
            });
        }
        await logSecurityEvent(user.id, LOGIN_EVENTS.FAILED, req, {
          reason: "Account inactive",
          status: user.status,
        });

        return res.status(403).json({
          success: false,
          code: "ACCOUNT_INACTIVE",
          message: ERROR_MESSAGES.ACCOUNT_INACTIVE,
          accountStatus: user.status,
        });
      }

      // Check if email is verified (if required)
      if (
        config.verification?.requireEmailVerification &&
        !user.email_verified_at
      ) {
        return res.status(403).json({
          success: false,
          code: "EMAIL_NOT_VERIFIED",
          message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
          requiresEmailVerification: true,
        });
      }
    }

    // Step 4: Authenticate user
    let authResult;
    try {
      authResult = await userModel.authenticate(email, password);
    } catch (error) {
      console.error("Authentication error:", error);

      // Record failed attempt if user exists
      if (user) {
        try {
          await userModel.recordFailedLogin(user.id);
        } catch (recordError) {
          console.error("Failed to record login attempt:", recordError);
        }

        await logSecurityEvent(user.id, LOGIN_EVENTS.FAILED, req, {
          reason: "Authentication error",
          error: error.message,
        });
      }

      return res.status(401).json({
        success: false,
        code: "AUTHENTICATION_FAILED",
        message: ERROR_MESSAGES.INVALID_CREDENTIALS,
      });
    }

    if (!authResult.success) {
      // Record failed attempt
      if (user) {
        try {
          await userModel.recordFailedLogin(user.id);
        } catch (recordError) {
          console.error("Failed to record login attempt:", recordError);
        }

        await logSecurityEvent(user.id, LOGIN_EVENTS.FAILED, req, {
          reason: authResult.error || "Invalid credentials",
        });
      }

      return res.status(401).json({
        success: false,
        code: "INVALID_CREDENTIALS",
        message: authResult.error || ERROR_MESSAGES.INVALID_CREDENTIALS,
        remainingAttempts:
          config.security?.maxFailedAttempts - (user?.failed_attempts || 0),
      });
    }

    // Step 5: Reset failed attempts on successful authentication
    try {
      await userModel.resetFailedAttempts(authResult.user.id);
    } catch (error) {
      console.error("Failed to reset failed attempts:", error);
      // Continue - non-critical error
    }

    // Step 6: Check if MFA is required
    const requiresMFA =
      authResult.requiresMFA ||
      (user?.mfa_enabled && config.security?.requireMFA);

    if (requiresMFA) {
      await logSecurityEvent(
        authResult.user.id,
        LOGIN_EVENTS.MFA_REQUIRED,
        req,
        {
          mfaType: user?.mfa_type || "TOTP",
        },
      );

      return res.status(200).json({
        success: true,
        code: "MFA_REQUIRED",
        message: SUCCESS_MESSAGES.MFA_REQUIRED,
        data: {
          userId: authResult.user.id,
          requiresMFA: true,
          mfaType: user?.mfa_type || "TOTP",
          mfaSetupRequired: !user?.mfa_secret,
          isAuthenticated: false,
        },
        meta: {
          responseTime: `${Date.now() - startTime}ms`,
          timestamp: new Date().toISOString(),
        },
      });
    }

    // Step 7: Generate tokens for non-MFA login
    let tokens;
    try {
      tokens = generateTokenPair(authResult.user.id, authResult.user);
    } catch (error) {
      console.error("Token generation error:", error);

      await logSecurityEvent(authResult.user.id, LOGIN_EVENTS.FAILED, req, {
        reason: "Token generation failed",
      });

      return res.status(500).json({
        success: false,
        code: "TOKEN_GENERATION_FAILED",
        message: ERROR_MESSAGES.TOKEN_GENERATION_FAILED,
      });
    }

    // Step 8: Create session
    const sessionId = await createUserSession(
      authResult.user.id,
      req,
      tokens.accessToken,
      { loginMethod: "password" },
    );

    // Step 9: Update user login info
    try {
      await userModel.updateLoginInfo(authResult.user.id, clientIp);
    } catch (error) {
      console.error("Failed to update login info:", error);
      // Continue - non-critical error
    }

    // Step 10: Sanitize user data
    const userData = userModel.sanitize
      ? userModel.sanitize(authResult.user)
      : { ...authResult.user };

    delete userData.password;
    delete userData.mfa_secret;
    delete userData.reset_password_token;

    // Step 11: Log successful login
    await logSecurityEvent(authResult.user.id, LOGIN_EVENTS.SUCCESS, req, {
      sessionId,
      responseTime: Date.now() - startTime,
    });

    // Step 12: Return success response
    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.LOGIN_SUCCESS,
      user_type: userData.user_type,
      status: userData.status,
      // redirect: "/",
      data: {
        user: userData,
        sessionId: sessionId,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 24 * 60 * 60, // 24 hours in seconds
          tokenType: "Bearer",
        },
        requiresMFA: false,
        isAuthenticated: true,
      },
      meta: {
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Login unexpected error:", error);

    // Log error event
    await logSecurityEvent(null, LOGIN_EVENTS.FAILED, req, {
      reason: "Unexpected error",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      ...(process.env.NODE_ENV === "development" && {
        error: error.message,
      }),
    });
  }
};

// Logout function
export const logout = async (req, res) => {
  const startTime = Date.now();

  try {
    const token = req.headers.authorization?.split(" ")[1];
    const sessionId = req.headers["x-session-id"] || req.body.sessionId;

    let userId = null;

    // Try to get user ID from token
    if (token) {
      try {
        const decoded = verifyToken(token);
        if (decoded && decoded.userId) {
          userId = decoded.userId;
        }
      } catch (tokenError) {
        console.warn(
          "Token verification failed during logout:",
          tokenError.message,
        );
      }
    }

    // Try to get user ID from session
    if (!userId && sessionId) {
      try {
        const session = await Session.findOne({ where: { id: sessionId } });
        if (session) {
          userId = session.user_id;
        }
      } catch (sessionError) {
        console.error("Session lookup error during logout:", sessionError);
      }
    }

    // Invalidate sessions
    if (userId) {
      // Invalidate all active sessions for this user
      await invalidateUserSessions(userId);

      // Log logout event
      await logSecurityEvent(userId, LOGIN_EVENTS.LOGOUT, req, {
        sessionId,
        logoutMethod: "manual",
        responseTime: Date.now() - startTime,
      });
    } else if (token || sessionId) {
      // Log attempt with unknown user
      await logSecurityEvent(null, LOGIN_EVENTS.LOGOUT, req, {
        reason: "Unknown user",
        hasToken: !!token,
        hasSessionId: !!sessionId,
      });
    }

    // Clear client-side token storage hints
    res.setHeader("Clear-Site-Data", '"cookies", "storage"');

    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.LOGOUT_SUCCESS,
      data: {
        userId,
        loggedOutFromAllDevices: true,
      },
      meta: {
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Logout unexpected error:", error);

    // Log error
    await logSecurityEvent(null, LOGIN_EVENTS.FAILED, req, {
      event: "LOGOUT_ERROR",
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      code: "LOGOUT_FAILED",
      message: ERROR_MESSAGES.LOGOUT_FAILED,
      ...(process.env.NODE_ENV === "development" && {
        error: error.message,
      }),
    });
  }
};

// Additional helper functions

// Check session status
export const checkSession = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];
    const sessionId = req.headers["x-session-id"] || req.body.sessionId;

    if (!token && !sessionId) {
      return res.status(400).json({
        success: false,
        message: "Token or session ID required",
      });
    }

    let isValid = false;
    let userData = null;
    let sessionInfo = null;

    // Check token
    if (token) {
      const decoded = verifyToken(token);
      if (decoded && decoded.userId) {
        isValid = true;
        const user = await userModel.findById(decoded.userId);
        if (user) {
          userData = userModel.sanitize ? userModel.sanitize(user) : user;
          delete userData.password;
        }
      }
    }

    // Check session
    if (sessionId) {
      const session = await Session.findOne({
        where: {
          id: sessionId,
          is_active: true,
          expires_at: { [Op.gt]: new Date() },
        },
      });

      if (session) {
        isValid = true;
        sessionInfo = {
          id: session.id,
          lastActivity: session.last_activity,
          loginAt: session.login_at,
          expiresAt: session.expires_at,
        };

        if (!userData && session.user_id) {
          const user = await userModel.findById(session.user_id);
          if (user) {
            userData = userModel.sanitize ? userModel.sanitize(user) : user;
            delete userData.password;
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        authenticated: isValid,
        user: userData,
        session: sessionInfo,
      },
    });
  } catch (error) {
    console.error("Session check error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
};

// Logout from all devices
export const logoutAllDevices = async (req, res) => {
  try {
    const userId = req.user?.id || req.body.userId;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID required",
      });
    }

    await invalidateUserSessions(userId);

    // Log this event
    await logSecurityEvent(userId, LOGIN_EVENTS.LOGOUT, req, {
      logoutMethod: "all_devices",
      initiatedBy: req.user?.id || "user",
    });

    return res.status(200).json({
      success: true,
      message: "Logged out from all devices",
      data: {
        userId,
        sessionsTerminated: true,
      },
    });
  } catch (error) {
    console.error("Logout all devices error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
};
