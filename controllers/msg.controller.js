// msg.controller.js
import emailService from "../services/emailService.js";

export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const verifyCode = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email is not match",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Send verification email
    await emailService.sendVerificationCode(email, otp);

    // Send success response
    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    console.error("Error in verifyCode:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification code",
      error: error.message,
    });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email is not match",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Send verification email
    await emailService.sendVerificationEmail(email, otp);

    // Send success response
    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    console.error("Error in verifyCode:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification code",
      error: error.message,
    });
  }
};


export const verifyResetPassword = async (req, res) => {
  try {
    const { email, token } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }

    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Email is not match",
      });
    }

    // Generate OTP
    const otp = generateOTP();

    // Send verification email
    await emailService.sendVerificationEmail(email, otp);

    // Send success response
    return res.status(200).json({
      success: true,
      message: "Verification code sent successfully",
    });
  } catch (error) {
    console.error("Error in verifyCode:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to send verification code",
      error: error.message,
    });
  }
};

