// password.controller.js
import crypto from "crypto";
import userModel from "../../models/User.js";
import VerificationCodeModel from "../../models/VerificationCode.js";
import SessionModel from "../../models/Session.js";
import LoginHistoryModel from "../../models/LoginHistory.js";
import config from "../../config/index.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";
import emailService from "../../services/emailService.js";

// Instantiate models
const VerificationCode = new VerificationCodeModel();
const Session = new SessionModel();
const LoginHistory = new LoginHistoryModel();

// Constants
const PASSWORD_RESET_EXPIRY_MINUTES =
  config.security?.passwordResetExpiry || 15;
const TOKEN_BYTES = 32;
const PASSWORD_MIN_LENGTH = config.security?.passwordMinLength || 8;

const ERROR_MESSAGES = {
  EMAIL_REQUIRED: "Email is required",
  INVALID_EMAIL: "Invalid email format",
  PASSWORD_REQUIRED: "Password is required",
  TOKEN_REQUIRED: "Reset token is required",
  PASSWORDS_MISMATCH: "Passwords do not match",
  WEAK_PASSWORD: `Password must be at least ${PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number, and special character`,
  INVALID_TOKEN: "Invalid or expired reset token",
  USER_NOT_FOUND: "User not found",
  ACCOUNT_LOCKED: "Account is locked",
  TOKEN_GENERATION_FAILED: "Failed to generate reset token",
  SERVER_ERROR: "Internal server error",
};

const SUCCESS_MESSAGES = {
  RESET_EMAIL_SENT:
    "If an account exists with this email, you will receive a reset link",
  PASSWORD_RESET_SUCCESS: "Password reset successful",
  PASSWORD_CHANGED: "Password changed successfully",
};

const SECURITY_EVENTS = {
  PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
  PASSWORD_RESET_SUCCESS: "PASSWORD_RESET_SUCCESS",
  PASSWORD_RESET_FAILED: "PASSWORD_RESET_FAILED",
  PASSWORD_CHANGED: "PASSWORD_CHANGED",
  PASSWORD_CHANGE_FAILED: "PASSWORD_CHANGE_FAILED",
};

// Helper function to validate email
const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

// Helper function to validate password strength
const validatePasswordStrength = (password) => {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return {
      valid: false,
      message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
    };
  }

  const hasUpperCase = /[A-Z]/.test(password);
  const hasLowerCase = /[a-z]/.test(password);
  const hasNumbers = /\d/.test(password);
  const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

  const errors = [];
  if (!hasUpperCase) errors.push("uppercase letter");
  if (!hasLowerCase) errors.push("lowercase letter");
  if (!hasNumbers) errors.push("number");
  if (!hasSpecialChar) errors.push("special character");

  if (errors.length > 0) {
    return {
      valid: false,
      message: `Password must contain at least one ${errors.join(", ")}`,
    };
  }

  return { valid: true };
};

// Helper function to generate secure reset token
const generateResetToken = () => {
  return crypto.randomBytes(TOKEN_BYTES).toString("hex");
};

// Helper function to hash token
const hashToken = (token) => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

// Helper function to check reset rate limiting
const checkResetRateLimit = async (userId, ipAddress) => {
  const MAX_ATTEMPTS_PER_HOUR = config.security?.maxResetAttempts || 3;
  const HOUR_IN_MS = 60 * 60 * 1000;

  try {
    // Get recent reset attempts count using custom method
    const recentAttempts = await VerificationCode.getUserVerifications(
      userId,
      "PASSWORD_RESET",
      MAX_ATTEMPTS_PER_HOUR,
    );

    // Count valid (not expired, not used) attempts within the last hour
    const hourAgo = new Date(Date.now() - HOUR_IN_MS);
    const validRecentAttempts = recentAttempts.filter(
      (attempt) =>
        new Date(attempt.created_at) > hourAgo &&
        !attempt.is_used &&
        !attempt.is_expired,
    );

    return validRecentAttempts.length < MAX_ATTEMPTS_PER_HOUR;
  } catch (error) {
    console.error("Rate limit check error:", error);
    return true; // Allow reset if rate limit check fails
  }
};

// Helper function to invalidate previous reset tokens
const invalidatePreviousResetTokens = async (userId) => {
  try {
    // Get previous unused, unexpired tokens
    const previousTokens = await VerificationCode.getUserVerifications(
      userId,
      "PASSWORD_RESET",
      100,
    );

    const activeTokens = previousTokens.filter(
      (token) => !token.is_used && !token.is_expired,
    );

    // Expire each token
    for (const token of activeTokens) {
      await VerificationCode.expireCode(token.id);
    }
  } catch (error) {
    console.error("Failed to invalidate previous tokens:", error);
  }
};

// Forgot password function
export const forgotPassword = async (req, res) => {
  const startTime = Date.now();
  const clientIp =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  try {
    const { email } = req.body;

    // Validate input
    if (!email || !email.trim()) {
      return res.status(400).json({
        success: false,
        code: "EMAIL_REQUIRED",
        message: ERROR_MESSAGES.EMAIL_REQUIRED,
      });
    }

    // Validate email format
    if (!validateEmail(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL",
        message: ERROR_MESSAGES.INVALID_EMAIL,
      });
    }

    // Find user
    let user;
    try {
      user = await userModel.findByEmail(email.trim());
    } catch (error) {
      console.error("User lookup error:", error);
      // Return generic success message for security
      return res.status(200).json({
        success: true,
        message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
      });
    }

    // If user doesn't exist, return generic success message for security
    if (!user) {
      return res.status(200).json({
        success: false,
        message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
      });
    }

    // Check if account is active
    if (user.status !== "ACTIVE") {
      // Still return generic message for security
      return res.status(200).json({
        success: false,
        message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
      });
    }

    // Check rate limiting
    const allowed = await checkResetRateLimit(user.id, clientIp);
    if (!allowed) {
      await logSecurityEvent(
        user.id,
        SECURITY_EVENTS.PASSWORD_RESET_FAILED,
        req,
        {
          reason: "Rate limit exceeded",
        },
      );

      return res.status(429).json({
        success: false,
        code: "RATE_LIMITED",
        message: "Too many reset attempts. Please try again later.",
        retryAfter: 3600, // 1 hour in seconds
      });
    }

    // Invalidate previous reset tokens
    await invalidatePreviousResetTokens(user.id);

    // Generate reset token
    let resetToken;
    try {
      resetToken = generateResetToken();
    } catch (error) {
      console.error("Token generation error:", error);
      throw new Error(ERROR_MESSAGES.TOKEN_GENERATION_FAILED);
    }

    const hashedToken = hashToken(resetToken);

    // Store token in database using createCode method
    await VerificationCode.createCode(
      user.id,
      "PASSWORD_RESET",
      email.trim(),
      "email",
      PASSWORD_RESET_EXPIRY_MINUTES,
      hashedToken, // Pass the pre-hashed token
    );

    // Send password reset email
    // TODO: Implement email service
    emailService.sendPasswordResetEmail(email, resetToken);

    // Log the request
    await logSecurityEvent(
      user.id,
      SECURITY_EVENTS.PASSWORD_RESET_REQUESTED,
      req,
      {
        tokenGenerated: true,
        expiryMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
      },
    );

    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
      data: {
        expiryIn: PASSWORD_RESET_EXPIRY_MINUTES * 60, // seconds
        emailSent: true,
      },
      meta: {
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Forgot password unexpected error:", error);

    // Log error
    await logSecurityEvent(null, SECURITY_EVENTS.PASSWORD_RESET_FAILED, req, {
      error: error.message,
      email: req.body.email,
    });

    // Return generic success message for security, even on error
    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
    });
  }
};

// Reset password function
export const resetPassword = async (req, res) => {
  const startTime = Date.now();
  const clientIp =
    req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

  try {
    const { token, password, confirmPassword } = req.body;

    // Validate input
    if (!token || !token.trim()) {
      return res.status(400).json({
        success: false,
        code: "TOKEN_REQUIRED",
        message: ERROR_MESSAGES.TOKEN_REQUIRED,
      });
    }

    if (!password || !password.trim()) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_REQUIRED",
        message: ERROR_MESSAGES.PASSWORD_REQUIRED,
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        code: "PASSWORDS_MISMATCH",
        message: ERROR_MESSAGES.PASSWORDS_MISMATCH,
      });
    }

    // Validate password strength
    const passwordValidation = validatePasswordStrength(password);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        code: "WEAK_PASSWORD",
        message: passwordValidation.message,
      });
    }

    // Hash token to compare
    const hashedToken = hashToken(token.trim());

    // Find verification code using findValidCode method
    let verification;
    try {
      verification = await VerificationCode.findValidCode(
        null, // userId not needed since we're searching by token
        hashedToken,
        "PASSWORD_RESET",
      );
    } catch (error) {
      console.error("Token lookup error:", error);
      return res.status(500).json({
        success: false,
        code: "TOKEN_LOOKUP_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    if (!verification) {
      await logSecurityEvent(null, SECURITY_EVENTS.PASSWORD_RESET_FAILED, req, {
        reason: "Invalid or expired token",
        hashedToken: hashedToken.substring(0, 10) + "...", // Partial for logging
      });

      return res.status(400).json({
        success: false,
        code: "INVALID_TOKEN",
        message: ERROR_MESSAGES.INVALID_TOKEN,
      });
    }

    // Get user
    let user;
    try {
      user = await userModel.findById(verification.user_id);
    } catch (error) {
      console.error("User lookup error:", error);
      return res.status(500).json({
        success: false,
        code: "USER_LOOKUP_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    if (!user) {
      await logSecurityEvent(
        verification.user_id,
        SECURITY_EVENTS.PASSWORD_RESET_FAILED,
        req,
        {
          reason: "User not found",
        },
      );

      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Check if account is active
    if (user.status !== "ACTIVE") {
      await logSecurityEvent(
        user.id,
        SECURITY_EVENTS.PASSWORD_RESET_FAILED,
        req,
        {
          reason: "Account not active",
          status: user.status,
        },
      );

      return res.status(403).json({
        success: false,
        code: "ACCOUNT_INACTIVE",
        message: "Account is not active",
        accountStatus: user.status,
      });
    }

    // Check if new password is different from old password
    let isSamePassword = false;
    if (typeof userModel.comparePassword === "function") {
      try {
        isSamePassword = await userModel.comparePassword(
          password,
          user.password,
        );
      } catch (error) {
        console.error("Password comparison error:", error);
      }
    }

    if (isSamePassword) {
      return res.status(400).json({
        success: false,
        code: "PASSWORD_REUSED",
        message: "New password cannot be the same as the old password",
      });
    }

    // Hash new password
    let hashedPassword;
    try {
      hashedPassword = await userModel.hashPassword(password);
    } catch (error) {
      console.error("Password hashing error:", error);
      return res.status(500).json({
        success: false,
        code: "PASSWORD_HASHING_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    // Update user password
    try {
      await userModel.update(user.id, {
        password: hashedPassword,
        password_changed_at: new Date().toISOString(),
        last_password_reset: new Date().toISOString(),
        failed_attempts: 0, // Reset failed attempts on password reset
      });
    } catch (error) {
      console.error("Password update error:", error);
      return res.status(500).json({
        success: false,
        code: "PASSWORD_UPDATE_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    // Mark token as used
    try {
      await VerificationCode.markAsUsed(verification.id, clientIp);
    } catch (error) {
      console.error("Failed to mark token as used:", error);
      // Continue - non-critical error
    }

    // Invalidate all active sessions for security
    try {
      // Get active sessions
      const activeSessions = await Session.getUserActiveSessions(user.id);
      for (const session of activeSessions) {
        await Session.update(session.id, {
          is_active: false,
          logged_out_at: new Date(),
          logout_reason: "PASSWORD_RESET",
        });
      }
    } catch (error) {
      console.error("Session invalidation error:", error);
      // Continue - non-critical error
    }

    // Log password change
    await logSecurityEvent(
      user.id,
      SECURITY_EVENTS.PASSWORD_RESET_SUCCESS,
      req,
      {
        resetViaToken: true,
        responseTime: Date.now() - startTime,
      },
    );

    // Log to login history
    if (LoginHistory && typeof LoginHistory.create === "function") {
      try {
        await LoginHistory.create({
          user_id: user.id,
          event_type: "PASSWORD_RESET_SUCCESS",
          ip_address: clientIp,
          user_agent: req.headers["user-agent"],
          details: JSON.stringify({
            method: "token_reset",
            timestamp: new Date().toISOString(),
          }),
        });
      } catch (error) {
        console.error("Failed to log to history:", error);
      }
    }

    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.PASSWORD_RESET_SUCCESS,
      data: {
        userId: user.id,
        email: user.email,
        sessionsInvalidated: true,
        passwordChangedAt: new Date().toISOString(),
      },
      meta: {
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Reset password unexpected error:", error);

    // Log error
    await logSecurityEvent(null, SECURITY_EVENTS.PASSWORD_RESET_FAILED, req, {
      error: error.message,
      tokenProvided: !!req.body.token,
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

// Additional password-related functions

// Change password (for authenticated users)
export const changePassword = async (req, res) => {
  const startTime = Date.now();

  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        code: "AUTH_REQUIRED",
        message: "Authentication required",
      });
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: "All password fields are required",
      });
    }

    if (newPassword !== confirmPassword) {
      return res.status(400).json({
        success: false,
        code: "PASSWORDS_MISMATCH",
        message: ERROR_MESSAGES.PASSWORDS_MISMATCH,
      });
    }

    // Get user
    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Verify current password
    const isPasswordValid = await userModel.authenticate(
      user.email,
      currentPassword,
    );
    if (!isPasswordValid.success) {
      await logSecurityEvent(
        userId,
        SECURITY_EVENTS.PASSWORD_CHANGE_FAILED,
        req,
        {
          reason: "Current password incorrect",
        },
      );

      return res.status(400).json({
        success: false,
        code: "INVALID_CURRENT_PASSWORD",
        message: "Current password is incorrect",
      });
    }

    // Validate new password strength
    const passwordValidation = validatePasswordStrength(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({
        success: false,
        code: "WEAK_PASSWORD",
        message: passwordValidation.message,
      });
    }

    // Check if new password is different
    if (currentPassword === newPassword) {
      return res.status(400).json({
        success: false,
        code: "SAME_PASSWORD",
        message: "New password must be different from current password",
      });
    }

    // Hash new password
    const hashedPassword = await userModel.hashPassword(newPassword);

    // Update password
    await userModel.update(userId, {
      password: hashedPassword,
      password_changed_at: new Date().toISOString(),
    });

    // Log password change
    await logSecurityEvent(userId, SECURITY_EVENTS.PASSWORD_CHANGED, req, {
      changedVia: "user_request",
    });

    // Invalidate other sessions (optional - keep current session)
    try {
      const sessionId = req.session?.id;
      const activeSessions = await Session.getUserActiveSessions(userId);

      for (const session of activeSessions) {
        if (session.id !== sessionId) {
          await Session.update(session.id, {
            is_active: false,
            logged_out_at: new Date(),
            logout_reason: "PASSWORD_CHANGED",
          });
        }
      }
    } catch (error) {
      console.error("Session invalidation error:", error);
      // Continue - non-critical error
    }

    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.PASSWORD_CHANGED,
      data: {
        passwordChangedAt: new Date().toISOString(),
      },
      meta: {
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Change password error:", error);

    await logSecurityEvent(
      req.user?.id,
      SECURITY_EVENTS.PASSWORD_CHANGE_FAILED,
      req,
      {
        error: error.message,
      },
    );

    return res.status(500).json({
      success: false,
      code: "INTERNAL_SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
};

// Validate reset token
export const validateResetToken = async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: "Token is required",
        valid: false,
      });
    }

    const hashedToken = hashToken(token);

    // Use findValidCode to check token
    const verification = await VerificationCode.findValidCode(
      null,
      hashedToken,
      "PASSWORD_RESET",
    );

    if (!verification) {
      return res.status(400).json({
        success: false,
        message: "Invalid or expired token",
        valid: false,
      });
    }

    // Get user email for display (optional)
    const user = await userModel.findById(verification.user_id);
    const maskedEmail = user?.email
      ? user.email.replace(
          /(.{2})(.*)(?=@)/,
          (match, p1, p2) => p1 + "*".repeat(p2.length),
        )
      : null;

    return res.status(200).json({
      success: true,
      data: {
        valid: true,
        expiresAt: verification.expires_at,
        email: maskedEmail, // Return masked email for UI
        userId: verification.user_id,
      },
    });
  } catch (error) {
    console.error("Validate token error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
      valid: false,
    });
  }
};

// // password.controller.js
// import crypto from "crypto";
// import userModel from "../../models/User.js";
// import VerificationCode from "../../models/VerificationCode.js";
// import Session from "../../models/Session.js";
// import LoginHistory from "../../models/LoginHistory.js";
// import config from "../../config/index.js";
// import { logSecurityEvent } from "../../utils/securityLogger.js";

// // Constants
// const PASSWORD_RESET_EXPIRY_MINUTES =
//   config.security?.passwordResetExpiry || 15;
// const TOKEN_BYTES = 32;
// const PASSWORD_MIN_LENGTH = config.security?.passwordMinLength || 8;

// const ERROR_MESSAGES = {
//   EMAIL_REQUIRED: "Email is required",
//   INVALID_EMAIL: "Invalid email format",
//   PASSWORD_REQUIRED: "Password is required",
//   TOKEN_REQUIRED: "Reset token is required",
//   PASSWORDS_MISMATCH: "Passwords do not match",
//   WEAK_PASSWORD: `Password must be at least ${PASSWORD_MIN_LENGTH} characters with uppercase, lowercase, number, and special character`,
//   INVALID_TOKEN: "Invalid or expired reset token",
//   USER_NOT_FOUND: "User not found",
//   ACCOUNT_LOCKED: "Account is locked",
//   TOKEN_GENERATION_FAILED: "Failed to generate reset token",
//   SERVER_ERROR: "Internal server error",
// };

// const SUCCESS_MESSAGES = {
//   RESET_EMAIL_SENT:
//     "If an account exists with this email, you will receive a reset link",
//   PASSWORD_RESET_SUCCESS: "Password reset successful",
//   PASSWORD_CHANGED: "Password changed successfully",
// };

// const SECURITY_EVENTS = {
//   PASSWORD_RESET_REQUESTED: "PASSWORD_RESET_REQUESTED",
//   PASSWORD_RESET_SUCCESS: "PASSWORD_RESET_SUCCESS",
//   PASSWORD_RESET_FAILED: "PASSWORD_RESET_FAILED",
//   PASSWORD_CHANGED: "PASSWORD_CHANGED",
//   PASSWORD_CHANGE_FAILED: "PASSWORD_CHANGE_FAILED",
// };

// // Helper function to validate email
// const validateEmail = (email) => {
//   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//   return emailRegex.test(email);
// };

// // Helper function to validate password strength
// const validatePasswordStrength = (password) => {
//   if (password.length < PASSWORD_MIN_LENGTH) {
//     return {
//       valid: false,
//       message: `Password must be at least ${PASSWORD_MIN_LENGTH} characters`,
//     };
//   }

//   const hasUpperCase = /[A-Z]/.test(password);
//   const hasLowerCase = /[a-z]/.test(password);
//   const hasNumbers = /\d/.test(password);
//   const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

//   const errors = [];
//   if (!hasUpperCase) errors.push("uppercase letter");
//   if (!hasLowerCase) errors.push("lowercase letter");
//   if (!hasNumbers) errors.push("number");
//   if (!hasSpecialChar) errors.push("special character");

//   if (errors.length > 0) {
//     return {
//       valid: false,
//       message: `Password must contain at least one ${errors.join(", ")}`,
//     };
//   }

//   return { valid: true };
// };

// // Helper function to generate secure reset token
// const generateResetToken = () => {
//   return crypto.randomBytes(TOKEN_BYTES).toString("hex");
// };

// // Helper function to hash token
// const hashToken = (token) => {
//   return crypto.createHash("sha256").update(token).digest("hex");
// };

// // Helper function to check reset rate limiting
// const checkResetRateLimit = async (userId, ipAddress) => {
//   const MAX_ATTEMPTS_PER_HOUR = config.security?.maxResetAttempts || 3;
//   const HOUR_IN_MS = 60 * 60 * 1000;

//   try {
//     const recentAttempts = await VerificationCode.count({
//       where: {
//         user_id: userId,
//         type: "PASSWORD_RESET",
//         created_at: {
//           [Op.gt]: new Date(Date.now() - HOUR_IN_MS),
//         },
//       },
//     });

//     return recentAttempts < MAX_ATTEMPTS_PER_HOUR;
//   } catch (error) {
//     console.error("Rate limit check error:", error);
//     return true; // Allow reset if rate limit check fails
//   }
// };

// // Helper function to invalidate previous reset tokens
// const invalidatePreviousResetTokens = async (userId) => {
//   try {
//     await VerificationCode.update(
//       { is_expired: true },
//       {
//         where: {
//           user_id: userId,
//           type: "PASSWORD_RESET",
//           is_used: false,
//           is_expired: false,
//         },
//       },
//     );
//   } catch (error) {
//     console.error("Failed to invalidate previous tokens:", error);
//   }
// };

// // Forgot password function
// export const forgotPassword = async (req, res) => {
//   const startTime = Date.now();
//   const clientIp =
//     req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

//   try {
//     const { email } = req.body;

//     // Validate input
//     if (!email || !email.trim()) {
//       return res.status(400).json({
//         success: false,
//         code: "EMAIL_REQUIRED",
//         message: ERROR_MESSAGES.EMAIL_REQUIRED,
//       });
//     }

//     // Validate email format
//     if (!validateEmail(email)) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_EMAIL",
//         message: ERROR_MESSAGES.INVALID_EMAIL,
//       });
//     }

//     // Find user
//     let user;
//     try {
//       user = await userModel.findByEmail(email.trim());
//     } catch (error) {
//       console.error("User lookup error:", error);
//       // Return generic success message for security
//       return res.status(200).json({
//         success: true,
//         message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
//       });
//     }

//     // If user doesn't exist, return generic success message for security
//     if (!user) {
//       return res.status(200).json({
//         success: false,
//         message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
//       });
//     }

//     // Check if account is active
//     if (user.status !== "ACTIVE") {
//       // Still return generic message for security
//       return res.status(200).json({
//         success: false,
//         message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
//       });
//     }

//     // Check rate limiting
//     const allowed = await checkResetRateLimit(user.id, clientIp);
//     if (!allowed) {
//       await logSecurityEvent(
//         user.id,
//         SECURITY_EVENTS.PASSWORD_RESET_FAILED,
//         req,
//         {
//           reason: "Rate limit exceeded",
//         },
//       );

//       return res.status(429).json({
//         success: false,
//         code: "RATE_LIMITED",
//         message: "Too many reset attempts. Please try again later.",
//         retryAfter: 3600, // 1 hour in seconds
//       });
//     }

//     // Invalidate previous reset tokens
//     await invalidatePreviousResetTokens(user.id);

//     // Generate reset token
//     let resetToken;
//     try {
//       resetToken = generateResetToken();
//     } catch (error) {
//       console.error("Token generation error:", error);
//       throw new Error(ERROR_MESSAGES.TOKEN_GENERATION_FAILED);
//     }

//     const hashedToken = hashToken(resetToken);

//     // Store token in database
//     await VerificationCode.create({
//       user_id: user.id,
//       code: hashedToken,
//       type: "PASSWORD_RESET",
//       recipient: email.trim(),
//       channel: "email",
//       expires_at: new Date(
//         Date.now() + PASSWORD_RESET_EXPIRY_MINUTES * 60 * 1000,
//       ),
//       metadata: JSON.stringify({
//         ipAddress: clientIp,
//         userAgent: req.headers["user-agent"],
//       }),
//     });

//     // Send password reset email
//     // TODO: Implement email service
//     // emailService.sendPasswordResetEmail(email, resetToken, user.full_name);

//     // Log the request
//     await logSecurityEvent(
//       user.id,
//       SECURITY_EVENTS.PASSWORD_RESET_REQUESTED,
//       req,
//       {
//         tokenGenerated: true,
//         expiryMinutes: PASSWORD_RESET_EXPIRY_MINUTES,
//       },
//     );

//     return res.status(200).json({
//       success: true,
//       message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
//       data: {
//         expiryIn: PASSWORD_RESET_EXPIRY_MINUTES * 60, // seconds
//         emailSent: true,
//       },
//       meta: {
//         responseTime: `${Date.now() - startTime}ms`,
//         timestamp: new Date().toISOString(),
//       },
//     });
//   } catch (error) {
//     console.error("Forgot password unexpected error:", error);

//     // Log error
//     await logSecurityEvent(null, SECURITY_EVENTS.PASSWORD_RESET_FAILED, req, {
//       error: error.message,
//       email: req.body.email,
//     });

//     // Return generic success message for security, even on error
//     return res.status(200).json({
//       success: true,
//       message: SUCCESS_MESSAGES.RESET_EMAIL_SENT,
//     });
//   }
// };

// // Reset password function
// export const resetPassword = async (req, res) => {
//   const startTime = Date.now();
//   const clientIp =
//     req.ip || req.headers["x-forwarded-for"] || req.connection.remoteAddress;

//   try {
//     const { token, password, confirmPassword } = req.body;

//     // Validate input
//     if (!token || !token.trim()) {
//       return res.status(400).json({
//         success: false,
//         code: "TOKEN_REQUIRED",
//         message: ERROR_MESSAGES.TOKEN_REQUIRED,
//       });
//     }

//     if (!password || !password.trim()) {
//       return res.status(400).json({
//         success: false,
//         code: "PASSWORD_REQUIRED",
//         message: ERROR_MESSAGES.PASSWORD_REQUIRED,
//       });
//     }

//     if (password !== confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         code: "PASSWORDS_MISMATCH",
//         message: ERROR_MESSAGES.PASSWORDS_MISMATCH,
//       });
//     }

//     // Validate password strength
//     const passwordValidation = validatePasswordStrength(password);
//     if (!passwordValidation.valid) {
//       return res.status(400).json({
//         success: false,
//         code: "WEAK_PASSWORD",
//         message: passwordValidation.message,
//       });
//     }

//     // Hash token to compare
//     const hashedToken = hashToken(token.trim());

//     // Find verification code
//     let verification;
//     try {
//       verification = await VerificationCode.findOne({
//         where: {
//           code: hashedToken,
//           type: "PASSWORD_RESET",
//           is_used: false,
//           is_expired: false,
//           expires_at: { [Op.gt]: new Date() },
//         },
//       });
//     } catch (error) {
//       console.error("Token lookup error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "TOKEN_LOOKUP_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     if (!verification) {
//       await logSecurityEvent(null, SECURITY_EVENTS.PASSWORD_RESET_FAILED, req, {
//         reason: "Invalid or expired token",
//         hashedToken: hashedToken.substring(0, 10) + "...", // Partial for logging
//       });

//       return res.status(400).json({
//         success: false,
//         code: "INVALID_TOKEN",
//         message: ERROR_MESSAGES.INVALID_TOKEN,
//       });
//     }

//     // Get user
//     let user;
//     try {
//       user = await userModel.findById(verification.user_id);
//     } catch (error) {
//       console.error("User lookup error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "USER_LOOKUP_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     if (!user) {
//       await logSecurityEvent(
//         verification.user_id,
//         SECURITY_EVENTS.PASSWORD_RESET_FAILED,
//         req,
//         {
//           reason: "User not found",
//         },
//       );

//       return res.status(404).json({
//         success: false,
//         code: "USER_NOT_FOUND",
//         message: ERROR_MESSAGES.USER_NOT_FOUND,
//       });
//     }

//     // Check if account is active
//     if (user.status !== "ACTIVE") {
//       await logSecurityEvent(
//         user.id,
//         SECURITY_EVENTS.PASSWORD_RESET_FAILED,
//         req,
//         {
//           reason: "Account not active",
//           status: user.status,
//         },
//       );

//       return res.status(403).json({
//         success: false,
//         code: "ACCOUNT_INACTIVE",
//         message: "Account is not active",
//         accountStatus: user.status,
//       });
//     }

//     // Check if new password is different from old password
//     let isSamePassword = false;
//     if (typeof userModel.comparePassword === "function") {
//       try {
//         isSamePassword = await userModel.comparePassword(
//           password,
//           user.password,
//         );
//       } catch (error) {
//         console.error("Password comparison error:", error);
//       }
//     }

//     if (isSamePassword) {
//       return res.status(400).json({
//         success: false,
//         code: "PASSWORD_REUSED",
//         message: "New password cannot be the same as the old password",
//       });
//     }

//     // Hash new password
//     let hashedPassword;
//     try {
//       hashedPassword = await userModel.hashPassword(password);
//     } catch (error) {
//       console.error("Password hashing error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "PASSWORD_HASHING_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     // Update user password
//     try {
//       await userModel.update(user.id, {
//         password: hashedPassword,
//         password_changed_at: new Date().toISOString(),
//         last_password_reset: new Date().toISOString(),
//         failed_attempts: 0, // Reset failed attempts on password reset
//       });
//     } catch (error) {
//       console.error("Password update error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "PASSWORD_UPDATE_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     // Mark token as used
//     try {
//       await VerificationCode.update(
//         {
//           is_used: true,
//           used_at: new Date(),
//         },
//         { where: { id: verification.id } },
//       );
//     } catch (error) {
//       console.error("Failed to mark token as used:", error);
//       // Continue - non-critical error
//     }

//     // Invalidate all active sessions for security
//     try {
//       await Session.update(
//         {
//           is_active: false,
//           logged_out_at: new Date(),
//           logout_reason: "PASSWORD_RESET",
//         },
//         {
//           where: {
//             user_id: user.id,
//             is_active: true,
//           },
//         },
//       );
//     } catch (error) {
//       console.error("Session invalidation error:", error);
//       // Continue - non-critical error
//     }

//     // Log password change
//     await logSecurityEvent(
//       user.id,
//       SECURITY_EVENTS.PASSWORD_RESET_SUCCESS,
//       req,
//       {
//         resetViaToken: true,
//         responseTime: Date.now() - startTime,
//       },
//     );

//     // Log to login history
//     if (LoginHistory && typeof LoginHistory.create === "function") {
//       try {
//         await LoginHistory.create({
//           user_id: user.id,
//           event_type: "PASSWORD_RESET_SUCCESS",
//           ip_address: clientIp,
//           user_agent: req.headers["user-agent"],
//           details: JSON.stringify({
//             method: "token_reset",
//             timestamp: new Date().toISOString(),
//           }),
//         });
//       } catch (error) {
//         console.error("Failed to log to history:", error);
//       }
//     }

//     return res.status(200).json({
//       success: true,
//       message: SUCCESS_MESSAGES.PASSWORD_RESET_SUCCESS,
//       data: {
//         userId: user.id,
//         email: user.email,
//         sessionsInvalidated: true,
//         passwordChangedAt: new Date().toISOString(),
//       },
//       meta: {
//         responseTime: `${Date.now() - startTime}ms`,
//         timestamp: new Date().toISOString(),
//       },
//     });
//   } catch (error) {
//     console.error("Reset password unexpected error:", error);

//     // Log error
//     await logSecurityEvent(null, SECURITY_EVENTS.PASSWORD_RESET_FAILED, req, {
//       error: error.message,
//       tokenProvided: !!req.body.token,
//     });

//     return res.status(500).json({
//       success: false,
//       code: "INTERNAL_SERVER_ERROR",
//       message: ERROR_MESSAGES.SERVER_ERROR,
//       ...(process.env.NODE_ENV === "development" && {
//         error: error.message,
//       }),
//     });
//   }
// };

// // Additional password-related functions

// // Change password (for authenticated users)
// export const changePassword = async (req, res) => {
//   try {
//     const { currentPassword, newPassword, confirmPassword } = req.body;
//     const userId = req.user?.id;

//     if (!userId) {
//       return res.status(401).json({
//         success: false,
//         message: "Authentication required",
//       });
//     }

//     if (!currentPassword || !newPassword || !confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "All password fields are required",
//       });
//     }

//     if (newPassword !== confirmPassword) {
//       return res.status(400).json({
//         success: false,
//         message: ERROR_MESSAGES.PASSWORDS_MISMATCH,
//       });
//     }

//     // Get user
//     const user = await userModel.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: ERROR_MESSAGES.USER_NOT_FOUND,
//       });
//     }

//     // Verify current password
//     const isPasswordValid = await userModel.authenticate(
//       user.email,
//       currentPassword,
//     );
//     if (!isPasswordValid.success) {
//       await logSecurityEvent(
//         userId,
//         SECURITY_EVENTS.PASSWORD_CHANGE_FAILED,
//         req,
//         {
//           reason: "Current password incorrect",
//         },
//       );

//       return res.status(400).json({
//         success: false,
//         message: "Current password is incorrect",
//       });
//     }

//     // Validate new password strength
//     const passwordValidation = validatePasswordStrength(newPassword);
//     if (!passwordValidation.valid) {
//       return res.status(400).json({
//         success: false,
//         message: passwordValidation.message,
//       });
//     }

//     // Check if new password is different
//     if (currentPassword === newPassword) {
//       return res.status(400).json({
//         success: false,
//         message: "New password must be different from current password",
//       });
//     }

//     // Hash new password
//     const hashedPassword = await userModel.hashPassword(newPassword);

//     // Update password
//     await userModel.update(userId, {
//       password: hashedPassword,
//       password_changed_at: new Date().toISOString(),
//     });

//     // Log password change
//     await logSecurityEvent(userId, SECURITY_EVENTS.PASSWORD_CHANGED, req, {
//       changedVia: "user_request",
//     });

//     // Invalidate other sessions (optional - keep current session)
//     await Session.update(
//       {
//         is_active: false,
//         logged_out_at: new Date(),
//         logout_reason: "PASSWORD_CHANGED",
//       },
//       {
//         where: {
//           user_id: userId,
//           id: { [Op.ne]: req.session?.id }, // Keep current session
//         },
//       },
//     );

//     return res.status(200).json({
//       success: true,
//       message: SUCCESS_MESSAGES.PASSWORD_CHANGED,
//       data: {
//         passwordChangedAt: new Date().toISOString(),
//       },
//     });
//   } catch (error) {
//     console.error("Change password error:", error);
//     return res.status(500).json({
//       success: false,
//       message: ERROR_MESSAGES.SERVER_ERROR,
//     });
//   }
// };

// // Validate reset token
// export const validateResetToken = async (req, res) => {
//   try {
//     const { token } = req.query;

//     if (!token) {
//       return res.status(400).json({
//         success: false,
//         message: "Token is required",
//       });
//     }

//     const hashedToken = hashToken(token);

//     const verification = await VerificationCode.findOne({
//       where: {
//         code: hashedToken,
//         type: "PASSWORD_RESET",
//         is_used: false,
//         is_expired: false,
//         expires_at: { [Op.gt]: new Date() },
//       },
//     });

//     if (!verification) {
//       return res.status(400).json({
//         success: false,
//         message: "Invalid or expired token",
//         valid: false,
//       });
//     }

//     // Get user email for display (optional)
//     const user = await userModel.findById(verification.user_id);
//     const maskedEmail = user?.email
//       ? user.email.replace(
//           /(.{2})(.*)(?=@)/,
//           (match, p1, p2) => p1 + "*".repeat(p2.length),
//         )
//       : null;

//     return res.status(200).json({
//       success: true,
//       data: {
//         valid: true,
//         expiresAt: verification.expires_at,
//         email: maskedEmail, // Return masked email for UI
//         userId: verification.user_id,
//       },
//     });
//   } catch (error) {
//     console.error("Validate token error:", error);
//     return res.status(500).json({
//       success: false,
//       message: ERROR_MESSAGES.SERVER_ERROR,
//     });
//   }
// };
