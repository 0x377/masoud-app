// verify.controller.js
import crypto from "crypto";
import userModel from "../../models/User.js";
import Session from "../../models/Session.js";
import VerificationCodeModel from "../../models/VerificationCode.js";
import LoginHistory from "../../models/LoginHistory.js";
import { generateToken, generateTokenPair } from "./token.controller.js";
import config from "../../config/index.js";
import { Op } from "sequelize";

// Instantiate the VerificationCode model
const VerificationCode = new VerificationCodeModel();

// Constants
const VERIFICATION_TYPES = {
  EMAIL: "EMAIL_VERIFICATION",
  TWO_FA: "TWO_FACTOR_AUTH",
  PHONE: "PHONE_VERIFICATION",
  PASSWORD_RESET: "PASSWORD_RESET",
};

const ERROR_MESSAGES = {
  MISSING_FIELDS: {
    TWO_FA: "User ID and verification code are required",
    EMAIL: "Email and verification code are required",
    PHONE: "Phone number and verification code are required",
  },
  INVALID_CODE: "Invalid or expired verification code",
  USER_NOT_FOUND: "User not found",
  USER_INACTIVE: "User account is not active",
  EMAIL_NOT_VERIFIED: "Email not verified",
  SERVER_ERROR: "Internal server error",
  VERIFICATION_LIMIT: "Too many verification attempts. Please try again later",
};

const SUCCESS_MESSAGES = {
  TWO_FA: "2FA verification successful",
  EMAIL: "Email verified successfully",
  PHONE: "Phone number verified successfully",
};

// Helper function to validate verification code
const validateVerificationCode = async (
  userId,
  code,
  type,
  checkExpiry = true,
) => {
  try {
    // Use the findValidCode method from VerificationCode model
    const verification = await VerificationCode.findValidCode(
      userId,
      code,
      type,
    );

    if (!verification) {
      return { success: false, message: ERROR_MESSAGES.INVALID_CODE };
    }

    // Check attempts
    if (verification.attempts >= (config.verification?.maxAttempts || 5)) {
      await VerificationCode.expireCode(verification.id);
      return {
        success: false,
        message: ERROR_MESSAGES.VERIFICATION_LIMIT,
        code: verification,
      };
    }

    // Check if code matches
    if (verification.code !== code.toString()) {
      await VerificationCode.recordAttempt(verification.id);
      return {
        success: false,
        message: "Invalid verification code",
        remainingAttempts: 3 - verification.attempts,
        code: verification,
      };
    }

    // Check if expired
    if (checkExpiry && new Date(verification.expires_at) < new Date()) {
      await VerificationCode.expireCode(verification.id);
      return { success: false, message: ERROR_MESSAGES.INVALID_CODE };
    }

    return { success: true, code: verification };
  } catch (error) {
    console.error("Verification code validation error:", error);
    console.error("Error details:", {
      userId,
      code,
      type,
      checkExpiry,
      errorMessage: error.message,
      errorStack: error.stack,
    });
    return { success: false, message: ERROR_MESSAGES.SERVER_ERROR };
  }
};

// Helper function to mark code as used
const markCodeAsUsed = async (verificationId) => {
  try {
    const result = await VerificationCode.markAsUsed(verificationId);
    return true;
  } catch (error) {
    console.error("Failed to mark code as used:", error);
    console.error("Update error details:", {
      verificationId,
      errorMessage: error.message,
    });
    return false;
  }
};

// Helper function to create user session
const createUserSession = async (userId, req, accessToken) => {
  try {
    const sessionId = crypto.randomBytes(32).toString("hex");
    const sessionData = {
      id: sessionId,
      user_id: userId,
      ip_address:
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress,
      user_agent: req.headers["user-agent"] || "Unknown",
      payload: JSON.stringify({
        accessToken,
        verificationType: "2FA",
        deviceInfo: {
          browser: req.useragent?.browser,
          platform: req.useragent?.platform,
          os: req.useragent?.os,
        },
      }),
      last_activity: Math.floor(Date.now() / 1000),
      login_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
    };

    // Make sure Session is also instantiated if it's a class
    const sessionModel = new Session();
    await sessionModel.create(sessionData);
    return sessionId;
  } catch (error) {
    console.error("Session creation error:", error);
    return null;
  }
};

// Helper function to log verification event
const logVerificationEvent = async (
  userId,
  eventType,
  req,
  additionalData = {},
) => {
  try {
    // Instantiate LoginHistory if it's a class
    const loginHistoryModel = new LoginHistory();
    if (loginHistoryModel && typeof loginHistoryModel.create === "function") {
      await loginHistoryModel.create({
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
    console.error("Failed to log verification event:", error);
  }
};

// Main 2FA verification function
export const verify2FA = async (req, res) => {
  const startTime = Date.now();

  try {
    const { userId, code } = req.body;

    // Validate input
    if (!userId || !code) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: ERROR_MESSAGES.MISSING_FIELDS.TWO_FA,
        details: { provided: { userId: !!userId, code: !!code } },
      });
    }

    // Validate code format (6-digit)
    if (!/^\d{6}$/.test(code.toString())) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CODE_FORMAT",
        message: "Verification code must be 6 digits",
      });
    }

    // Get user
    let user;
    try {
      user = await userModel.findById(userId);
    } catch (error) {
      console.error("User lookup error:", error);
      return res.status(500).json({
        success: false,
        code: "USER_LOOKUP_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Check user status
    if (user.status !== "ACTIVE") {
      switch (user.status) {
        case "PENDING_VERIFICATION":
          return res.status(403).json({
            success: false,
            code: "PENDING_VERIFICATION",
            message: ERROR_MESSAGES.USER_INACTIVE,
            userStatus: user.status,
            redirect: "/verify-email",
          });
        case "USER_INFO":
          return res.status(403).json({
            success: false,
            code: "USER_INFO",
            message: ERROR_MESSAGES.USER_INACTIVE,
            userStatus: user.status,
            redirect: "/user-info",
          });
        default:
          return res.status(403).json({
            success: false,
            code: "USER_INACTIVE",
            message: ERROR_MESSAGES.USER_INACTIVE,
            userStatus: user.status,
          });
      }
    }

    // Check if email is verified (if required)
    if (
      config.verification?.requireEmailVerification &&
      user.email_verified_at === null
    ) {
      return res.status(403).json({
        success: false,
        code: "EMAIL_NOT_VERIFIED",
        message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
      });
    }

    // Verify 2FA code
    let verificationResult;
    if (typeof userModel.verifyMFA === "function") {
      try {
        verificationResult = await userModel.verifyMFA(userId, code);
      } catch (error) {
        console.error("MFA verification error:", error);
        return res.status(500).json({
          success: false,
          code: "MFA_VERIFICATION_FAILED",
          message: "Failed to verify 2FA code",
        });
      }
    } else {
      // Fallback to generic verification code check
      verificationResult = await validateVerificationCode(
        userId,
        code,
        VERIFICATION_TYPES.TWO_FA,
      );
    }

    if (!verificationResult.success) {
      // Log failed attempt
      await logVerificationEvent(userId, "2FA_FAILED", req, {
        reason: verificationResult.message,
        codeAttempted: code,
        remainingAttempts: verificationResult.remainingAttempts || 0,
      });

      return res.status(400).json({
        success: false,
        code: "INVALID_2FA_CODE",
        message: verificationResult.message || ERROR_MESSAGES.INVALID_CODE,
        remainingAttempts: verificationResult.remainingAttempts || 0,
        locked: verificationResult.locked || false,
      });
    }

    // Mark code as used if using verification code system
    if (verificationResult.code && verificationResult.code.id) {
      await markCodeAsUsed(verificationResult.code.id);
    }

    // Update user's last MFA used timestamp
    try {
      await userModel.update(userId, {
        last_mfa_used_at: new Date().toISOString(),
        last_login_at: new Date().toISOString(),
      });
    } catch (error) {
      console.error("Failed to update user timestamps:", error);
      // Continue - non-critical error
    }

    // Generate tokens
    let tokens;
    try {
      tokens = generateTokenPair(user.id, user);
    } catch (error) {
      console.error("Token generation error:", error);
      return res.status(500).json({
        success: false,
        code: "TOKEN_GENERATION_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    // Create session
    const sessionId = await createUserSession(user.id, req, tokens.accessToken);

    // Sanitize user data
    const userData = userModel.sanitize
      ? userModel.sanitize(user)
      : { ...user };
    delete userData.password;
    delete userData.mfa_secret;
    delete userData.reset_password_token;

    // Log successful verification
    await logVerificationEvent(userId, "2FA_SUCCESS", req, {
      sessionId,
      responseTime: Date.now() - startTime,
    });

    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.TWO_FA,
      data: {
        user: userData,
        sessionId: sessionId,
        tokens: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: 24 * 60 * 60, // 24 hours in seconds
          tokenType: "Bearer",
        },
      },
      meta: {
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
        requiresEmailVerification:
          config.verification?.requireEmailVerification || false,
      },
    });
  } catch (error) {
    console.error("2FA verification unexpected error:", error);

    // Log error
    await logVerificationEvent(req.body.userId, "2FA_ERROR", req, {
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

// Email verification function
export const verifyEmail = async (req, res) => {
  const startTime = Date.now();

  try {
    const { email, code } = req.body;

    // Validate input
    if (!email || !code) {
      return res.status(400).json({
        success: false,
        code: "MISSING_FIELDS",
        message: ERROR_MESSAGES.MISSING_FIELDS.EMAIL,
        details: { provided: { email: !!email, code: !!code } },
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        code: "INVALID_EMAIL_FORMAT",
        message: "هذا الايميل غير صحيح",
      });
    }

    const codeRegex = /^\d{6}$/;
    if (!codeRegex.test(code.toString())) {
      return res.status(400).json({
        success: false,
        code: "INVALID_CODE_FORMAT",
        message: "هذا الكود غير صحيح",
      });
    }

    // Find user
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

    if (!user) {
      return res.status(404).json({
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      });
    }

    // Check if already verified
    if (user.email_verified_at) {
      return res.status(200).json({
        success: true,
        message: "Email already verified",
        data: {
          alreadyVerified: true,
          verifiedAt: user.email_verified_at,
        },
      });
    }

    // Verify code
    const verificationResult = await validateVerificationCode(
      user.id,
      code,
      VERIFICATION_TYPES.EMAIL,
    );

    if (!verificationResult.success) {
      // Log failed attempt
      await logVerificationEvent(user.id, "EMAIL_VERIFICATION_FAILED", req, {
        reason: verificationResult.message,
        remainingAttempts: verificationResult.remainingAttempts || 0,
      });

      return res.status(400).json({
        success: false,
        code: "INVALID_VERIFICATION_CODE",
        message: verificationResult.message,
        remainingAttempts: verificationResult.remainingAttempts || 0,
      });
    }

    // Mark code as used
    await markCodeAsUsed(verificationResult.code.id);

    // Update user email verification status
    try {
      await userModel.verifyEmail(user.id);
    } catch (error) {
      console.error("Failed to update email verification status:", error);
      return res.status(500).json({
        success: false,
        code: "EMAIL_VERIFICATION_UPDATE_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    // Get updated user
    const updatedUser = await userModel.findById(user.id);

    // Generate tokens if auto-login is enabled
    let tokens = null;
    if (config.verification?.autoLoginAfterVerification) {
      try {
        tokens = generateTokenPair(updatedUser.id, updatedUser);

        // Create session
        await createUserSession(updatedUser.id, req, tokens.accessToken);
      } catch (tokenError) {
        console.error("Token generation error after verification:", tokenError);
        // Continue without tokens - verification still successful
      }
    }

    // Log successful verification
    await logVerificationEvent(user.id, "EMAIL_VERIFIED", req, {
      verificationId: verificationResult.code.id,
      responseTime: Date.now() - startTime,
    });

    // Prepare response data
    const responseData = {
      user: userModel.sanitize ? userModel.sanitize(updatedUser) : updatedUser,
      alreadyVerified: false,
      verifiedAt: new Date().toISOString(),
    };

    // Add tokens to response if generated
    if (tokens) {
      responseData.tokens = {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        expiresIn: 24 * 60 * 60,
        tokenType: "Bearer",
      };
      responseData.autoLoggedIn = true;
    }

    return res.status(200).json({
      success: true,
      message: SUCCESS_MESSAGES.EMAIL,
      redirect:
        responseData.user.status === "USER_INFO" ? "/user-info" : "/login",
      data: responseData,
      meta: {
        responseTime: `${Date.now() - startTime}ms`,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Email verification unexpected error:", error);

    // Log error
    await logVerificationEvent(null, "EMAIL_VERIFICATION_ERROR", req, {
      email: req.body.email,
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

// Additional verification functions

// Resend verification code
export const resendVerificationCode = async (req, res) => {
  try {
    const { email, type = "EMAIL" } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    // Find user
    const user = await userModel.findByEmail(email);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    // Check if already verified
    if (type === "EMAIL" && user.email_verified_at) {
      return res.status(200).json({
        success: true,
        message: "Email already verified",
      });
    }

    // Generate new verification code using the model method
    const newCode = await VerificationCode.createCode(
      user.id,
      VERIFICATION_TYPES[type],
      email,
      "email",
      10, // expires in 10 minutes
    );

    // Send email (implement email service)
    // await emailService.sendVerificationCode(email, newCode.code);

    return res.status(200).json({
      success: true,
      message: `Verification code sent to ${email}`,
      data: {
        expiresIn: 10 * 60, // 10 minutes in seconds
        type,
      },
    });
  } catch (error) {
    console.error("Resend verification code error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
};

// Check verification status
export const checkVerificationStatus = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: "User ID is required",
      });
    }

    const user = await userModel.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        emailVerified: !!user.email_verified_at,
        phoneVerified: !!user.phone_verified_at,
        mfaEnabled: !!user.mfa_secret,
        lastVerification: user.email_verified_at || user.phone_verified_at,
        accountStatus: user.status,
      },
    });
  } catch (error) {
    console.error("Check verification status error:", error);
    return res.status(500).json({
      success: false,
      message: ERROR_MESSAGES.SERVER_ERROR,
    });
  }
};

// // verify.controller.js
// import crypto from "crypto";
// import userModel from "../../models/User.js";
// import Session from "../../models/Session.js";
// import VerificationCode from "../../models/VerificationCode.js";
// import LoginHistory from "../../models/LoginHistory.js";
// import { generateToken, generateTokenPair } from "./token.controller.js";
// import config from "../../config/index.js";
// import { Op } from "sequelize";

// // Constants
// const VERIFICATION_TYPES = {
//   EMAIL: "EMAIL_VERIFICATION",
//   TWO_FA: "TWO_FACTOR_AUTH",
//   PHONE: "PHONE_VERIFICATION",
//   PASSWORD_RESET: "PASSWORD_RESET",
// };

// const ERROR_MESSAGES = {
//   MISSING_FIELDS: {
//     TWO_FA: "User ID and verification code are required",
//     EMAIL: "Email and verification code are required",
//     PHONE: "Phone number and verification code are required",
//   },
//   INVALID_CODE: "Invalid or expired verification code",
//   USER_NOT_FOUND: "User not found",
//   USER_INACTIVE: "User account is not active",
//   EMAIL_NOT_VERIFIED: "Email not verified",
//   SERVER_ERROR: "Internal server error",
//   VERIFICATION_LIMIT: "Too many verification attempts. Please try again later",
// };

// const SUCCESS_MESSAGES = {
//   TWO_FA: "2FA verification successful",
//   EMAIL: "Email verified successfully",
//   PHONE: "Phone number verified successfully",
// };

// // Helper function to validate verification code
// const validateVerificationCode = async (
//   userId,
//   code,
//   type,
//   checkExpiry = true,
// ) => {
//   try {
//     const whereClause = {
//       user_id: userId,
//       code,
//       type,
//       is_used: false,
//     };

//     if (checkExpiry) {
//       whereClause.is_expired = false;
//       whereClause.expires_at = { [Op.gt]: new Date() };
//     }

//     const verification = await VerificationCode.findOne({
//       where: whereClause,
//       order: [["created_at", "DESC"]],
//     });

//     if (!verification) {
//       return { success: false, message: ERROR_MESSAGES.INVALID_CODE };
//     }

//     // Check attempts
//     if (verification.attempts >= config.verification?.maxAttempts || 5) {
//       await VerificationCode.update(
//         { is_expired: true },
//         { where: { id: verification.id } },
//       );
//       return {
//         success: false,
//         message: ERROR_MESSAGES.VERIFICATION_LIMIT,
//         code: verification,
//       };
//     }

//     return { success: true, code: verification };
//   } catch (error) {
//     console.error("Verification code validation error:", error);
//     return { success: false, message: ERROR_MESSAGES.SERVER_ERROR };
//   }
// };

// // Helper function to mark code as used
// const markCodeAsUsed = async (verificationId) => {
//   try {
//     await VerificationCode.update(
//       {
//         is_used: true,
//         used_at: new Date(),
//         verified_at: new Date(),
//       },
//       { where: { id: verificationId } },
//     );
//     return true;
//   } catch (error) {
//     console.error("Failed to mark code as used:", error);
//     return false;
//   }
// };

// // Helper function to create user session
// const createUserSession = async (userId, req, accessToken) => {
//   try {
//     const sessionId = crypto.randomBytes(32).toString("hex");
//     const sessionData = {
//       id: sessionId,
//       user_id: userId,
//       ip_address:
//         req.ip ||
//         req.headers["x-forwarded-for"] ||
//         req.connection.remoteAddress,
//       user_agent: req.headers["user-agent"] || "Unknown",
//       payload: JSON.stringify({
//         accessToken,
//         verificationType: "2FA",
//         deviceInfo: {
//           browser: req.useragent?.browser,
//           platform: req.useragent?.platform,
//           os: req.useragent?.os,
//         },
//       }),
//       last_activity: Math.floor(Date.now() / 1000),
//       login_at: new Date(),
//       expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000),
//     };

//     await Session.create(sessionData);
//     return sessionId;
//   } catch (error) {
//     console.error("Session creation error:", error);
//     return null;
//   }
// };

// // Helper function to log verification event
// const logVerificationEvent = async (
//   userId,
//   eventType,
//   req,
//   additionalData = {},
// ) => {
//   try {
//     if (LoginHistory && typeof LoginHistory.create === "function") {
//       await LoginHistory.create({
//         user_id: userId,
//         event_type: eventType,
//         ip_address:
//           req.ip ||
//           req.headers["x-forwarded-for"] ||
//           req.connection.remoteAddress,
//         user_agent: req.headers["user-agent"] || "Unknown",
//         details: JSON.stringify({
//           timestamp: new Date().toISOString(),
//           ...additionalData,
//         }),
//       });
//     }
//   } catch (error) {
//     console.error("Failed to log verification event:", error);
//   }
// };

// // Main 2FA verification function
// export const verify2FA = async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const { userId, code } = req.body;

//     // Validate input
//     if (!userId || !code) {
//       return res.status(400).json({
//         success: false,
//         code: "MISSING_FIELDS",
//         message: ERROR_MESSAGES.MISSING_FIELDS.TWO_FA,
//         details: { provided: { userId: !!userId, code: !!code } },
//       });
//     }

//     // Validate code format (6-digit)
//     if (!/^\d{6}$/.test(code.toString())) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_CODE_FORMAT",
//         message: "Verification code must be 6 digits",
//       });
//     }

//     // Get user
//     let user;
//     try {
//       user = await userModel.findById(userId);
//     } catch (error) {
//       console.error("User lookup error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "USER_LOOKUP_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         code: "USER_NOT_FOUND",
//         message: ERROR_MESSAGES.USER_NOT_FOUND,
//       });
//     }

//     // Check user status
//     if (user.status !== "ACTIVE") {
//       switch (user.status) {
//         case "USER_INFO":
//           return res.status(403).json({
//             success: false,
//             code: "PENDING_VERIFICATION",
//             message: ERROR_MESSAGES.USER_INACTIVE,
//             userStatus: user.status,
//             redirect: "/verify-email",
//           });
//         case "USER_INFO":
//           return res.status(403).json({
//             success: false,
//             code: "USER_INFO",
//             message: ERROR_MESSAGES.USER_INACTIVE,
//             userStatus: user.status,
//             redirect: "/email-info",
//           });
//       }
//       return res.status(403).json({
//         success: false,
//         code: "USER_INACTIVE",
//         message: ERROR_MESSAGES.USER_INACTIVE,
//         userStatus: user.status,
//       });
//     }

//     // Check if email is verified (if required)
//     if (
//       config.verification?.requireEmailVerification &&
//       user.email_verified_at === null
//     ) {
//       return res.status(403).json({
//         success: false,
//         code: "EMAIL_NOT_VERIFIED",
//         message: ERROR_MESSAGES.EMAIL_NOT_VERIFIED,
//       });
//     }

//     // Verify 2FA code
//     let verificationResult;
//     if (typeof userModel.verifyMFA === "function") {
//       try {
//         verificationResult = await userModel.verifyMFA(userId, code);
//       } catch (error) {
//         console.error("MFA verification error:", error);
//         return res.status(500).json({
//           success: false,
//           code: "MFA_VERIFICATION_FAILED",
//           message: "Failed to verify 2FA code",
//         });
//       }
//     } else {
//       // Fallback to generic verification code check
//       verificationResult = await validateVerificationCode(
//         userId,
//         code,
//         VERIFICATION_TYPES.TWO_FA,
//       );
//     }

//     if (!verificationResult.success) {
//       // Log failed attempt
//       await logVerificationEvent(userId, "2FA_FAILED", req, {
//         reason: verificationResult.message,
//         codeAttempted: code,
//       });

//       return res.status(400).json({
//         success: false,
//         code: "INVALID_2FA_CODE",
//         message: verificationResult.message || ERROR_MESSAGES.INVALID_CODE,
//         remainingAttempts: verificationResult.remainingAttempts || 0,
//         locked: verificationResult.locked || false,
//       });
//     }

//     // Mark code as used if using verification code system
//     if (verificationResult.code && verificationResult.code.id) {
//       await markCodeAsUsed(verificationResult.code.id);
//     }

//     // Update user's last MFA used timestamp
//     try {
//       await userModel.update(userId, {
//         last_mfa_used_at: new Date().toISOString(),
//         last_login_at: new Date().toISOString(),
//       });
//     } catch (error) {
//       console.error("Failed to update user timestamps:", error);
//       // Continue - non-critical error
//     }

//     // Generate tokens
//     let tokens;
//     try {
//       tokens = generateTokenPair(user.id, user);
//     } catch (error) {
//       console.error("Token generation error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "TOKEN_GENERATION_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     // Create session
//     const sessionId = await createUserSession(user.id, req, tokens.accessToken);

//     // Sanitize user data
//     const userData = userModel.sanitize
//       ? userModel.sanitize(user)
//       : { ...user };
//     delete userData.password;
//     delete userData.mfa_secret;
//     delete userData.reset_password_token;

//     // Log successful verification
//     await logVerificationEvent(userId, "2FA_SUCCESS", req, {
//       sessionId,
//       responseTime: Date.now() - startTime,
//     });

//     return res.status(200).json({
//       success: true,
//       message: SUCCESS_MESSAGES.TWO_FA,
//       data: {
//         user: userData,
//         sessionId: sessionId,
//         tokens: {
//           accessToken: tokens.accessToken,
//           refreshToken: tokens.refreshToken,
//           expiresIn: 24 * 60 * 60, // 24 hours in seconds
//           tokenType: "Bearer",
//         },
//       },
//       meta: {
//         responseTime: `${Date.now() - startTime}ms`,
//         timestamp: new Date().toISOString(),
//         requiresEmailVerification:
//           config.verification?.requireEmailVerification || false,
//       },
//     });
//   } catch (error) {
//     console.error("2FA verification unexpected error:", error);

//     // Log error
//     await logVerificationEvent(req.body.userId, "2FA_ERROR", req, {
//       error: error.message,
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

// // Email verification function
// export const verifyEmail = async (req, res) => {
//   const startTime = Date.now();

//   try {
//     const { email, code } = req.body;

//     // Validate input
//     if (!email || !code) {
//       return res.status(400).json({
//         success: false,
//         code: "MISSING_FIELDS",
//         message: ERROR_MESSAGES.MISSING_FIELDS.EMAIL,
//         details: { provided: { email: !!email, code: !!code } },
//       });
//     }

//     // Validate email format
//     const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     if (!emailRegex.test(email)) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_EMAIL_FORMAT",
//         message: "هذا الايميل غير صحيح",
//       });
//     }

//     const codeRegex = /^\d{6}$/;
//     if (!codeRegex.test(code)) {
//       return res.status(400).json({
//         success: false,
//         code: "INVALID_CODE_FORMAT",
//         message: "هذا الكود غير صحيح",
//       });
//     }

//     // Find user
//     let user;
//     try {
//       user = await userModel.findByEmail(email);
//     } catch (error) {
//       console.error("User lookup error:", error);
//       return res.status(500).json({
//         success: false,
//         code: "USER_LOOKUP_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         code: "USER_NOT_FOUND",
//         message: ERROR_MESSAGES.USER_NOT_FOUND,
//       });
//     }

//     // Check if already verified
//     if (user.email_verified_at) {
//       return res.status(200).json({
//         success: true,
//         message: "Email already verified",
//         data: {
//           alreadyVerified: true,
//           verifiedAt: user.email_verified_at,
//         },
//       });
//     }

//     // Verify code
//     const verificationResult = await validateVerificationCode(
//       user.id,
//       code,
//       VERIFICATION_TYPES.EMAIL,
//     );

//     if (!verificationResult.success) {
//       // Log failed attempt
//       await logVerificationEvent(user.id, "EMAIL_VERIFICATION_FAILED", req, {
//         reason: verificationResult.message,
//       });

//       return res.status(400).json({
//         success: false,
//         code: "INVALID_VERIFICATION_CODE",
//         message: verificationResult.message,
//         remainingAttempts: verificationResult.remainingAttempts || 0,
//       });
//     }

//     // Mark code as used
//     await markCodeAsUsed(verificationResult.code.id);

//     // Update user email verification status
//     try {
//       await userModel.verifyEmail(user.id);
//     } catch (error) {
//       console.error("Failed to update email verification status:", error);
//       return res.status(500).json({
//         success: false,
//         code: "EMAIL_VERIFICATION_UPDATE_FAILED",
//         message: ERROR_MESSAGES.SERVER_ERROR,
//       });
//     }

//     // Get updated user
//     const updatedUser = await userModel.findById(user.id);

//     // Generate tokens if auto-login is enabled
//     let tokens = null;
//     if (config.verification?.autoLoginAfterVerification) {
//       try {
//         tokens = generateTokenPair(updatedUser.id, updatedUser);

//         // Create session
//         await createUserSession(updatedUser.id, req, tokens.accessToken);
//       } catch (tokenError) {
//         console.error("Token generation error after verification:", tokenError);
//         // Continue without tokens - verification still successful
//       }
//     }

//     // Log successful verification
//     await logVerificationEvent(user.id, "EMAIL_VERIFIED", req, {
//       verificationId: verificationResult.code.id,
//       responseTime: Date.now() - startTime,
//     });

//     // Prepare response data
//     const responseData = {
//       user: userModel.sanitize ? userModel.sanitize(updatedUser) : updatedUser,
//       alreadyVerified: false,
//       verifiedAt: new Date().toISOString(),
//     };

//     // Add tokens to response if generated
//     if (tokens) {
//       responseData.tokens = {
//         accessToken: tokens.accessToken,
//         refreshToken: tokens.refreshToken,
//         expiresIn: 24 * 60 * 60,
//         tokenType: "Bearer",
//       };
//       responseData.autoLoggedIn = true;
//     }

//     return res.status(200).json({
//       success: true,
//       message: SUCCESS_MESSAGES.EMAIL,
//       redirect: responseData.user.status === "USER_INFO" ? "/user-info" : "/login",
//       data: responseData,
//       meta: {
//         responseTime: `${Date.now() - startTime}ms`,
//         timestamp: new Date().toISOString(),
//       },
//     });
//   } catch (error) {
//     console.error("Email verification unexpected error:", error);

//     // Log error
//     await logVerificationEvent(null, "EMAIL_VERIFICATION_ERROR", req, {
//       email: req.body.email,
//       error: error.message,
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

// // Additional verification functions

// // Resend verification code
// export const resendVerificationCode = async (req, res) => {
//   try {
//     const { email, type = "EMAIL" } = req.body;

//     if (!email) {
//       return res.status(400).json({
//         success: false,
//         message: "Email is required",
//       });
//     }

//     // Find user
//     const user = await userModel.findByEmail(email);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     // Check if already verified
//     if (type === "EMAIL" && user.email_verified_at) {
//       return res.status(200).json({
//         success: true,
//         message: "Email already verified",
//       });
//     }

//     // Generate new verification code
//     const verificationCode = Math.floor(
//       100000 + Math.random() * 900000,
//     ).toString();

//     // Create or update verification code
//     await VerificationCode.create({
//       user_id: user.id,
//       code: verificationCode,
//       type: VERIFICATION_TYPES[type],
//       recipient: email,
//       channel: "email",
//       expires_at: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
//       is_used: false,
//       is_expired: false,
//     });

//     // Send email (implement email service)
//     // await emailService.sendVerificationCode(email, verificationCode);

//     return res.status(200).json({
//       success: true,
//       message: `Verification code sent to ${email}`,
//       data: {
//         expiresIn: 10 * 60, // 10 minutes in seconds
//         type,
//       },
//     });
//   } catch (error) {
//     console.error("Resend verification code error:", error);
//     return res.status(500).json({
//       success: false,
//       message: ERROR_MESSAGES.SERVER_ERROR,
//     });
//   }
// };

// // Check verification status
// export const checkVerificationStatus = async (req, res) => {
//   try {
//     const { userId } = req.params;

//     if (!userId) {
//       return res.status(400).json({
//         success: false,
//         message: "User ID is required",
//       });
//     }

//     const user = await userModel.findById(userId);
//     if (!user) {
//       return res.status(404).json({
//         success: false,
//         message: "User not found",
//       });
//     }

//     return res.status(200).json({
//       success: true,
//       data: {
//         emailVerified: !!user.email_verified_at,
//         phoneVerified: !!user.phone_verified_at,
//         mfaEnabled: !!user.mfa_secret,
//         lastVerification: user.email_verified_at || user.phone_verified_at,
//         accountStatus: user.status,
//       },
//     });
//   } catch (error) {
//     console.error("Check verification status error:", error);
//     return res.status(500).json({
//       success: false,
//       message: ERROR_MESSAGES.SERVER_ERROR,
//     });
//   }
// };
