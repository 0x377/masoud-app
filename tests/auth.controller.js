import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import userModel from "../models/User.js";
import VerificationCode from "../models/VerificationCode.js";
import LoginHistory from "../models/LoginHistory.js";
import SecurityLog from "../models/SecurityLog.js";
import Session from "../models/Session.js";
import config from "../config/index.js";
import emailService from "../services/emailService.js";

// Validation utilities
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phoneRegex = /^(009665|9665|\+9665|05|5)([0-9]{8})$/; // Updated to match your User.js pattern
export const nationalIdRegex = /^\d{14}$/;
export const fullNameRegex =
  /^([A-Za-z]+(?:\s[A-Za-z]+)+|[\u0600-\u06FF]+(?:\s[\u0600-\u06FF]+)+)$/;
export const nationalRegex = /^\d{14}$/;

export const isStrongPassword = (password) => {
  return (
    password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password) &&
    /[^A-Za-z0-9]/.test(password)
  );
};

export const hashPassword = async (password) => {
  return await bcrypt.hash(password, 12);
};

export const comparePassword = async (password, hash) => {
  return await bcrypt.compare(password, hash);
};

export const generateToken = (userId, userData, type = "access") => {
  const payload = {
    userId,
    email: userData.email,
    userType: userData.user_type,
    type,
    iat: Math.floor(Date.now() / 1000),
  };

  const options = {
    expiresIn: type === "access" ? "24h" : "7d",
  };

  return jwt.sign(
    payload,
    process.env.JWT_SECRET || config.security.jwtSecret,
    options,
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(
      token,
      process.env.JWT_SECRET || config.security.jwtSecret,
    );
  } catch (error) {
    return null;
  }
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// // login.controller.js
// export const login = async (req, res) => {
//   try {
//     const { email, password } = req.body;

//     // Validation
//     if (!email || !password) {
//       return res.status(400).json({
//         status: "error",
//         message: "Email and password are required",
//       });
//     }

//     // Authenticate user using the singleton instance
//     const result = await userModel.authenticate(email, password);

//     if (!result.success) {
//       return res.status(401).json({
//         status: "error",
//         message: result.error,
//       });
//     }

//     // Generate JWT token
//     const token = jwt.sign(
//       {
//         userId: result.user.id,
//         email: result.user.email,
//         userType: result.user.user_type,
//       },
//       process.env.JWT_SECRET || config.security.jwtSecret,
//       { expiresIn: config.security.jwtExpiresIn || "24h" },
//     );

//     // Update login info
//     await userModel.updateLoginInfo(result.user.id, req.ip);

//     // Reset failed attempts on successful login
//     await userModel.resetFailedAttempts(result.user.id);

//     // Log login history
//     await LoginHistory.create({
//       user_id: result.user.id,
//       event_type: "LOGIN_SUCCESS",
//       ip_address: req.ip,
//       user_agent: req.headers["user-agent"],
//       details: JSON.stringify({ method: "password" }),
//     });

//     // Create session
//     const sessionId = crypto.randomBytes(32).toString("hex");
//     await Session.create({
//       id: sessionId,
//       user_id: result.user.id,
//       ip_address: req.ip,
//       user_agent: req.headers["user-agent"],
//       payload: JSON.stringify({ accessToken: token }),
//       last_activity: Math.floor(Date.now() / 1000),
//       login_at: new Date(),
//     });

//     // Return response
//     return res.status(200).json({
//       status: "success",
//       message: "Login successful",
//       redirect: "/",
//       data: {
//         user: userModel.sanitize(result.user),
//         token: token,
//         sessionId: sessionId,
//         requiresMFA: result.requiresMFA,
//         isAuthencation: true,
//       },
//     });
//   } catch (error) {
//     console.error("Login error:", error);

//     // Log failed login attempt
//     if (req.body.email) {
//       try {
//         const user = await userModel.findByEmail(req.body.email);
//         if (user) {
//           await userModel.recordFailedLogin(user.id);

//           await LoginHistory.create({
//             user_id: user.id,
//             event_type: "LOGIN_FAILED",
//             ip_address: req.ip,
//             user_agent: req.headers["user-agent"],
//             details: JSON.stringify({ error: error.message }),
//           });
//         }
//       } catch (logError) {
//         console.error("Error logging failed login:", logError);
//       }
//     }

//     return res.status(500).json({
//       status: "error",
//       message: "Internal server error",
//     });
//   }
// };

// export const logout = async (req, res) => {
//   try {
//     const token = req.headers.authorization?.split(" ")[1];

//     if (token) {
//       const decoded = verifyToken(token);
//       if (decoded) {
//         // Invalidate session
//         await Session.update(
//           { is_active: false },
//           { where: { user_id: decoded.userId, is_active: true } },
//         );

//         // Log logout event
//         await LoginHistory.create({
//           user_id: decoded.userId,
//           event_type: "LOGOUT",
//           ip_address: req.ip,
//           user_agent: req.headers["user-agent"],
//         });
//       }
//     }

//     return res.status(200).json({
//       status: "success",
//       message: "Logged out successfully",
//     });
//   } catch (error) {
//     console.error("Logout error:", error);
//     return res.status(500).json({
//       status: "error",
//       message: "Internal server error",
//     });
//   }
// };


// password.controller.js
export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    // Find user using user model
    const user = await userModel.findByEmail(email);
    if (!user) {
      // Don't reveal if user exists for security
      return res.status(200).json({
        status: "success",
        message:
          "If an account exists with this email, you will receive a reset link",
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = crypto
      .createHash("sha256")
      .update(resetToken)
      .digest("hex");

    // Store token in database
    await VerificationCode.create({
      user_id: user.id,
      code: hashedToken,
      type: "PASSWORD_RESET",
      recipient: email,
      channel: "email",
      expires_at: new Date(Date.now() + 15 * 60 * 1000), // 15 minutes
    });

    // TODO: Send password reset email with token
    emailService.sendPasswordResetEmail(email, resetToken);

    return res.status(200).json({
      status: "success",
      message: "Password reset instructions sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token, password, confirmPassword } = req.body;

    if (!token || !password || !confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "Passwords do not match",
      });
    }

    if (!userModel.isStrongPassword(password)) {
      return res.status(400).json({
        status: "error",
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    // Hash token to compare
    const hashedToken = crypto.createHash("sha256").update(token).digest("hex");

    // Find verification code
    const verification = await VerificationCode.findOne({
      where: {
        code: hashedToken,
        type: "PASSWORD_RESET",
        is_used: false,
        is_expired: false,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!verification) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired reset token",
      });
    }

    // Change password using user model
    const hashedPassword = await userModel.hashPassword(password);
    await userModel.update(verification.user_id, {
      password: hashedPassword,
      password_changed_at: userModel.formatDate(new Date()),
    });

    // Mark token as used
    verification.is_used = true;
    verification.used_at = new Date();
    await verification.save();

    // Invalidate all sessions
    await Session.update(
      { is_active: false },
      { where: { user_id: verification.user_id } },
    );

    // Log password change
    await LoginHistory.create({
      user_id: verification.user_id,
      event_type: "PASSWORD_CHANGED",
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
    });

    return res.status(200).json({
      status: "success",
      message: "Password reset successful",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

