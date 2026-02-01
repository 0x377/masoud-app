import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Person from "../models/Person.js";
import VerificationCode from "../models/VerificationCode.js";
import LoginHistory from "../models/LoginHistory.js";
import SecurityLog from "../models/SecurityLog.js";
import Session from "../models/Session.js";
import config from "../config/index.js";

// Validation utilities
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const phoneRegex = /^\+?[1-9]\d{1,14}$/;
export const nationalIdRegex = /^\d{14}$/;

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

export const generateToken = (userId, type = "access") => {
  const payload = {
    userId,
    type,
    iat: Math.floor(Date.now() / 1000),
  };

  const options = {
    expiresIn: type === "access" ? "24h" : "7d",
  };

  return jwt.sign(payload, process.env.JWT_SECRET, options);
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, process.env.JWT_SECRET);
  } catch (error) {
    return null;
  }
};

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validation
    if (!email || !password) {
      return res.status(400).json({
        status: "error",
        message: "Email and password are required",
      });
    }

    // Instantiate User model
    const userModel = new User(); // Create instance

    // Authenticate user
    const result = await userModel.authenticate(email, password);

    if (!result.success) {
      return res.status(401).json({
        status: "error",
        message: result.error,
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: result.user.id,
        email: result.user.email,
        userType: result.user.user_type,
      },
      config.security.jwtSecret,
      { expiresIn: config.security.jwtExpiresIn },
    );

    // Return response
    return res.status(200).json({
      status: "success",
      message: "Login successful",
      data: {
        user: result.user,
        token: token,
        requiresMFA: result.requiresMFA,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const verify2FA = async (req, res) => {
  try {
    const { userId, code } = req.body;

    if (!userId || !code) {
      return res.status(400).json({
        status: "error",
        message: "User ID and code are required",
      });
    }

    // Find verification code
    const verification = await VerificationCode.findOne({
      where: {
        user_id: userId,
        code,
        type: "LOGIN_2FA",
        is_used: false,
        is_expired: false,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!verification) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired verification code",
      });
    }

    // Mark as used
    verification.is_used = true;
    verification.used_at = new Date();
    verification.used_ip = req.ip;
    await verification.save();

    // Get user
    const user = await User.findByPk(userId);

    user.last_mfa_used_at = new Date();
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user.id, "access");
    const refreshToken = generateToken(user.id, "refresh");

    // Create session
    await Session.create({
      id: crypto.randomBytes(32).toString("hex"),
      user_id: user.id,
      ip_address: req.ip,
      user_agent: req.headers["user-agent"],
      payload: JSON.stringify({ accessToken }),
      last_activity: Math.floor(Date.now() / 1000),
      login_at: new Date(),
    });

    // Remove sensitive data
    const userData = user.toJSON();
    delete userData.password;
    delete userData.mfa_secret;
    delete userData.mfa_backup_codes;

    return res.status(200).json({
      status: "success",
      message: "2FA verification successful",
      data: {
        user: userData,
        tokens: {
          accessToken,
          refreshToken,
          expiresIn: 24 * 60 * 60,
        },
      },
    });
  } catch (error) {
    console.error("2FA verification error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const register = async (req, res) => {
  try {
    const {
      full_name,
      email,
      password,
      confirmPassword,
      phone_number,
      national_id,
    } = req.body;

    // Check required fields
    if (!full_name || !email || !password || !confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "All fields are required",
      });
    }

    // Check password match
    if (password !== confirmPassword) {
      return res.status(400).json({
        status: "error",
        message: "Passwords do not match",
      });
    }

    // Validate email
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        status: "error",
        message: "Invalid email format",
      });
    }

    // Validate password strength
    if (!isStrongPassword(password)) {
      return res.status(400).json({
        status: "error",
        message:
          "Password must be at least 8 characters with uppercase, lowercase, number, and special character",
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      return res.status(409).json({
        status: "error",
        message: "User already exists",
      });
    }

    // Check if phone number exists
    if (phone_number) {
      const existingPhone = await User.findOne({ where: { phone_number } });
      if (existingPhone) {
        return res.status(409).json({
          status: "error",
          message: "Phone number already registered",
        });
      }
    }

    // Create person record
    const person = await Person.create({
      national_id,
      full_name_arabic: full_name,
      full_name_english: full_name,
      email,
      phone_number,
      gender: "M", // Default, can be updated later
      is_alive: true,
    });

    // Hash password
    const hashedPassword = await hashPassword(password);

    // Create user record
    const user = await User.create({
      person_id: person.id,
      username: email.split("@")[0],
      email,
      phone_number,
      password: hashedPassword,
      password_changed_at: new Date(),
      user_type: "FAMILY_MEMBER",
      status: "PENDING_VERIFICATION",
      preferences: {
        theme: "light",
        language: "ar",
        notifications: true,
      },
      notification_settings: {
        email: true,
        sms: false,
        push: true,
      },
    });

    // Generate verification code
    const verificationCode = generateOTP();

    await VerificationCode.create({
      user_id: user.id,
      code: verificationCode,
      type: "EMAIL_VERIFICATION",
      recipient: email,
      channel: "email",
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    });

    // TODO: Send verification email with code

    // Remove sensitive data
    const userData = user.toJSON();
    delete userData.password;

    return res.status(201).json({
      status: "success",
      message: "Registration successful. Please verify your email.",
      data: {
        user: userData,
        requiresVerification: true,
      },
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email, code } = req.body;

    if (!email || !code) {
      return res.status(400).json({
        status: "error",
        message: "Email and verification code are required",
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Find verification code
    const verification = await VerificationCode.findOne({
      where: {
        user_id: user.id,
        code,
        type: "EMAIL_VERIFICATION",
        is_used: false,
        is_expired: false,
        expires_at: { [Op.gt]: new Date() },
      },
    });

    if (!verification) {
      return res.status(400).json({
        status: "error",
        message: "Invalid or expired verification code",
      });
    }

    // Mark as used and verify user
    verification.is_used = true;
    verification.used_at = new Date();
    verification.verified_at = new Date();
    await verification.save();

    user.email_verified_at = new Date();
    user.status = "ACTIVE";
    await user.save();

    // Generate tokens
    const accessToken = generateToken(user.id, "access");
    const refreshToken = generateToken(user.id, "refresh");

    return res.status(200).json({
      status: "success",
      message: "Email verified successfully",
      data: {
        tokens: {
          accessToken,
          refreshToken,
        },
      },
    });
  } catch (error) {
    console.error("Email verification error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const logout = async (req, res) => {
  try {
    const token = req.headers.authorization?.split(" ")[1];

    if (token) {
      const decoded = verifyToken(token);
      if (decoded) {
        // Invalidate session
        await Session.update(
          { is_active: false },
          { where: { user_id: decoded.userId, is_active: true } },
        );

        // Log logout event
        await LoginHistory.create({
          user_id: decoded.userId,
          event_type: "LOGOUT",
          ip_address: req.ip,
          user_agent: req.headers["user-agent"],
        });
      }
    }

    return res.status(200).json({
      status: "success",
      message: "Logged out successfully",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        status: "error",
        message: "Email is required",
      });
    }

    // Find user
    const user = await User.findOne({ where: { email } });
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

    if (!isStrongPassword(password)) {
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

    // Get user
    const user = await User.findByPk(verification.user_id);
    if (!user) {
      return res.status(404).json({
        status: "error",
        message: "User not found",
      });
    }

    // Hash new password
    const hashedPassword = await hashPassword(password);

    // Update password
    user.password = hashedPassword;
    user.password_changed_at = new Date();
    await user.save();

    // Mark token as used
    verification.is_used = true;
    verification.used_at = new Date();
    await verification.save();

    // Invalidate all sessions
    await Session.update({ is_active: false }, { where: { user_id: user.id } });

    // Log password change
    await LoginHistory.create({
      user_id: user.id,
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

export const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        status: "error",
        message: "Refresh token is required",
      });
    }

    const decoded = verifyToken(refreshToken);

    if (!decoded || decoded.type !== "refresh") {
      return res.status(401).json({
        status: "error",
        message: "Invalid refresh token",
      });
    }

    // Check if user exists and is active
    const user = await User.findByPk(decoded.userId);
    if (!user || user.status !== "ACTIVE") {
      return res.status(401).json({
        status: "error",
        message: "User not found or inactive",
      });
    }

    // Generate new tokens
    const newAccessToken = generateToken(user.id, "access");
    const newRefreshToken = generateToken(user.id, "refresh");

    return res.status(200).json({
      status: "success",
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 24 * 60 * 60,
      },
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    return res.status(500).json({
      status: "error",
      message: "Internal server error",
    });
  }
};
