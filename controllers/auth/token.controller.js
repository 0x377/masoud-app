// token.controller.js
import jwt from "jsonwebtoken";
import crypto from "crypto";
import userModel from "../../models/User.js";
import Session from "../../models/Session.js";
import config from "../../config/index.js";

// Constants for better maintainability
const TOKEN_TYPES = {
  ACCESS: "access",
  REFRESH: "refresh",
};

const TOKEN_EXPIRATIONS = {
  ACCESS: "2h",
  REFRESH: "7d",
  ACCESS_SECONDS: 2 * 60 * 1000,
};

const ERROR_MESSAGES = {
  MISSING_FIELDS: {
    TWO_FA: "User ID and 2FA code are required",
    REFRESH_TOKEN: "Refresh token is required",
  },
  INVALID_TOKEN: "Invalid token",
  INVALID_REFRESH_TOKEN: "Invalid refresh token",
  INVALID_2FA_CODE: "Invalid 2FA code",
  USER_NOT_FOUND: "User not found",
  USER_INACTIVE: "User account is not active",
  SERVER_ERROR: "Internal server error",
  SESSION_CREATION_FAILED: "Failed to create session",
};

// Helper function to generate tokens
export const generateToken = (userId, userData, type = TOKEN_TYPES.ACCESS) => {
  if (!userId || !userData) {
    throw new Error("User ID and user data are required");
  }

  const payload = {
    userId,
    email: userData.email,
    userType: userData.user_type,
    type,
    iat: Math.floor(Date.now() / 1000),
    jti: crypto.randomBytes(16).toString("hex"), // JWT ID for tracking
  };

  const options = {
    expiresIn:
      type === TOKEN_TYPES.ACCESS
        ? TOKEN_EXPIRATIONS.ACCESS
        : TOKEN_EXPIRATIONS.REFRESH,
    issuer: config.security.jwtIssuer || "your-app-name",
    audience: config.security.jwtAudience || "your-app-clients",
  };

  try {
    return jwt.sign(
      payload,
      process.env.JWT_SECRET || config.security.jwtSecret,
      options,
    );
  } catch (error) {
    console.error("Token generation error:", error);
    throw new Error("Failed to generate token");
  }
};

// Helper function to create session
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
        deviceInfo: {
          browser: req.useragent?.browser,
          platform: req.useragent?.platform,
          os: req.useragent?.os,
        },
      }),
      last_activity: Math.floor(Date.now() / 1000),
      login_at: new Date(),
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    };

    await Session.create(sessionData);
    return sessionId;
  } catch (error) {
    console.error("Session creation error:", error);
    throw new Error(ERROR_MESSAGES.SESSION_CREATION_FAILED);
  }
};

// Token verification function
export const verifyToken = (token) => {
  if (!token) {
    return null;
  }

  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET || config.security.jwtSecret,
      {
        issuer: config.security.jwtIssuer || "your-app-name",
        audience: config.security.jwtAudience || "your-app-clients",
      },
    );
  } catch (error) {
    console.error("Token verification error:", error.message);

    // Return specific error information
    const errorInfo = {
      valid: false,
      error: error.name,
      message: error.message,
      expiredAt: error.expiredAt,
    };

    return errorInfo;
  }
};

// Refresh token function
export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    // Validate input
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        code: "MISSING_REFRESH_TOKEN",
        message: ERROR_MESSAGES.MISSING_FIELDS.REFRESH_TOKEN,
      });
    }

    // Verify token
    const decoded = verifyToken(refreshToken);

    if (typeof decoded === "object" && decoded.error) {
      // Token verification failed with specific error
      return res.status(401).json({
        success: false,
        code: "INVALID_REFRESH_TOKEN",
        message: decoded.message,
        details: decoded.error,
      });
    }

    if (!decoded || decoded.type !== TOKEN_TYPES.REFRESH) {
      return res.status(401).json({
        success: false,
        code: "INVALID_TOKEN_TYPE",
        message: ERROR_MESSAGES.INVALID_REFRESH_TOKEN,
      });
    }

    // Check if user exists and is active
    let user;
    try {
      user = await userModel.findById(decoded.userId);
    } catch (error) {
      console.error("User lookup error during refresh:", error);
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

    if (user.status !== "ACTIVE") {
      return res.status(403).json({
        success: false,
        code: "USER_INACTIVE",
        message: ERROR_MESSAGES.USER_INACTIVE,
        userStatus: user.status,
      });
    }

    // Generate new tokens
    let newAccessToken, newRefreshToken;
    try {
      newAccessToken = generateToken(user.id, user, TOKEN_TYPES.ACCESS);
      newRefreshToken = generateToken(user.id, user, TOKEN_TYPES.REFRESH);
    } catch (error) {
      console.error("Token generation error during refresh:", error);
      return res.status(500).json({
        success: false,
        code: "TOKEN_GENERATION_FAILED",
        message: ERROR_MESSAGES.SERVER_ERROR,
      });
    }

    // Invalidate old refresh token (optional - add to blacklist)

    return res.status(200).json({
      success: true,
      message: "Tokens refreshed successfully",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: TOKEN_EXPIRATIONS.ACCESS_SECONDS,
        tokenType: "Bearer",
      },
      meta: {
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Refresh token unexpected error:", error);

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

// Additional helper functions

// Generate both access and refresh tokens
export const generateTokenPair = (userId, userData) => {
  return {
    accessToken: generateToken(userId, userData, TOKEN_TYPES.ACCESS),
    refreshToken: generateToken(userId, userData, TOKEN_TYPES.REFRESH),
  };
};

// Decode token without verification (for logging/auditing)
export const decodeToken = (token) => {
  try {
    return jwt.decode(token);
  } catch (error) {
    console.error("Token decoding error:", error);
    return null;
  }
};

// Check if token is expired
export const isTokenExpired = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return true;

    const currentTime = Math.floor(Date.now() / 1000);
    return decoded.exp < currentTime;
  } catch (error) {
    console.error("Token expiration check error:", error);
    return true;
  }
};

// Get token expiration time
export const getTokenExpiration = (token) => {
  try {
    const decoded = jwt.decode(token);
    if (!decoded || !decoded.exp) return null;

    return new Date(decoded.exp * 1000);
  } catch (error) {
    console.error("Get token expiration error:", error);
    return null;
  }
};
