// register.controller.js
import userModel from "../../models/User.js";
import VerificationCode from "../../models/VerificationCode.js";
import SecurityLog from "../../models/SecurityLog.js";
import emailService from "../../services/emailService.js";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

// Constants - SIMPLIFIED for only required fields
export const VALIDATION_RULES = {
  FULL_NAME: /^[\p{L}\s.'-]{2,100}$/u,
  EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/,
  PHONE_SAUDI: /^(?:\+966|0)5[0-9]{8}$/,
  PASSWORD_MIN_LENGTH: 8,
  PASSWORD_REGEX:
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,128}$/,
  MAX_EMAIL_LENGTH: 255,
  MAX_NAME_LENGTH: 100,
  MAX_PASSWORD_LENGTH: 128,
};

export const ERROR_MESSAGES = {
  REQUIRED_FIELD: (field) => `${field} مطلوب`,
  INVALID_NAME:
    "الاسم يجب أن يكون 2-100 حرف ويحتوي على أحرف عربية/إنجليزية ومسافات ونقاط وشرطات",
  INVALID_EMAIL: "البريد الإلكتروني غير صحيح",
  INVALID_PHONE: "رقم الهاتف السعودي غير صحيح (05XXXXXXXX أو +9665XXXXXXXX)",
  WEAK_PASSWORD:
    "كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير، حرف صغير، رقم، ورمز خاص (@$!%*?&)",
  PASSWORD_MISMATCH: "كلمات المرور غير متطابقة",
  TERMS_NOT_ACCEPTED: "يجب الموافقة على الشروط والأحكام",
  EMAIL_EXISTS: "البريد الإلكتروني مستخدم بالفعل",
  PHONE_EXISTS: "رقم الهاتف مستخدم بالفعل",
  REGISTRATION_FAILED: "فشل إنشاء الحساب. الرجاء المحاولة مرة أخرى",
  VERIFICATION_SETUP_FAILED: "تم إنشاء الحساب ولكن فشل إعداد التحقق",
};

// Helper functions
const ValidationUtils = {
  // Safe string extraction
  safeString: (value) => {
    if (value == null) return "";
    if (typeof value === "string") return value.trim();
    if (typeof value === "number") return value.toString().trim();
    if (typeof value === "boolean") return value.toString();
    try {
      return String(value).trim();
    } catch {
      return "";
    }
  },

  // Safe boolean extraction
  safeBoolean: (value) => {
    if (typeof value === "boolean") return value;
    if (typeof value === "string") {
      const lower = value.toLowerCase().trim();
      return (
        lower === "true" || lower === "1" || lower === "yes" || lower === "نعم"
      );
    }
    if (typeof value === "number") return value === 1;
    return false;
  },

  // Validate email
  isValidEmail: (email) => {
    const emailStr = ValidationUtils.safeString(email);
    if (!emailStr) return false;
    return VALIDATION_RULES.EMAIL.test(emailStr);
  },

  // Validate Saudi phone
  isValidSaudiPhone: (phone) => {
    const phoneStr = ValidationUtils.safeString(phone).replace(/\s/g, "");
    if (!phoneStr) return false;
    return VALIDATION_RULES.PHONE_SAUDI.test(phoneStr);
  },

  // Format phone number
  formatPhoneNumber: (phone) => {
    const phoneStr = ValidationUtils.safeString(phone).replace(/\s/g, "");
    if (phoneStr.startsWith("0")) {
      return "+966" + phoneStr.substring(1);
    }
    return phoneStr;
  },

  // Password strength
  passwordStrength: (password) => {
    const passwordStr = ValidationUtils.safeString(password);
    if (!passwordStr)
      return { score: 0, strength: "ضعيفة", color: "#ef4444", isValid: false };

    let score = 0;
    if (passwordStr.length >= 8) score += 20;
    if (passwordStr.length >= 12) score += 10;
    if (passwordStr.length >= 16) score += 10;
    if (/[a-z]/.test(passwordStr)) score += 15;
    if (/[A-Z]/.test(passwordStr)) score += 15;
    if (/\d/.test(passwordStr)) score += 15;
    if (/[@$!%*?&]/.test(passwordStr)) score += 15;

    let strength = "ضعيفة";
    let color = "#ef4444";

    if (score >= 70) {
      strength = "قوية";
      color = "#10b981";
    } else if (score >= 40) {
      strength = "متوسطة";
      color = "#f59e0b";
    }

    return {
      score: Math.min(score, 100),
      strength,
      color,
      isValid: VALIDATION_RULES.PASSWORD_REGEX.test(passwordStr),
    };
  },

  // Sanitize input
  sanitizeInput: (input) => {
    const str = ValidationUtils.safeString(input);
    return str
      .replace(/[<>]/g, "")
      .replace(/javascript:/gi, "")
      .replace(/on\w+=/gi, "")
      .trim();
  },
};

// Main validation function - SIMPLIFIED for only required fields
export const validateRegistration = (data) => {
  const errors = {};
  const validatedData = {};

  // Check if data exists
  if (!data || typeof data !== "object") {
    errors.general = "بيانات التسجيل غير صحيحة";
    return {
      isValid: false,
      errors,
      validatedData: null,
    };
  }

  // Required fields - ONLY THESE 4 FIELDS
  const requiredFields = ["full_name", "email", "password", "phone_number"];

  // Check required fields
  for (const field of requiredFields) {
    const value = data[field];
    const stringValue = ValidationUtils.safeString(value);

    if (!stringValue) {
      // Map field names to Arabic labels
      const fieldLabels = {
        full_name: "الاسم بالكامل",
        email: "البريد الإلكتروني",
        password: "كلمة المرور",
        phone_number: "رقم الهاتف",
      };
      errors[field] = `${fieldLabels[field] || field} مطلوب`;
    } else {
      validatedData[field] = ValidationUtils.sanitizeInput(stringValue);
    }
  }

  // If basic validation failed, return early
  if (Object.keys(errors).length > 0) {
    return {
      isValid: false,
      errors,
      validatedData: null,
    };
  }

  // Validate Full Name
  const fullName = validatedData.full_name;
  if (!VALIDATION_RULES.FULL_NAME.test(fullName)) {
    errors.full_name = ERROR_MESSAGES.INVALID_NAME;
  }

  // Validate Email
  const email = validatedData.email.toLowerCase();
  if (!ValidationUtils.isValidEmail(email)) {
    errors.email = ERROR_MESSAGES.INVALID_EMAIL;
  }
  validatedData.email = email;

  // Validate Phone
  const phone = validatedData.phone_number;
  if (!ValidationUtils.isValidSaudiPhone(phone)) {
    errors.phone_number = ERROR_MESSAGES.INVALID_PHONE;
  } else {
    validatedData.phone_number = ValidationUtils.formatPhoneNumber(phone);
  }

  // Validate Password
  const password = validatedData.password;
  const passwordStrength = ValidationUtils.passwordStrength(password);
  if (!passwordStrength.isValid) {
    errors.password = ERROR_MESSAGES.WEAK_PASSWORD;
  }

  // Validate Password Confirmation (if provided)
  if (data.password_confirmation) {
    const confirmPassword = ValidationUtils.safeString(
      data.password_confirmation,
    );
    if (password !== confirmPassword) {
      errors.password_confirmation = ERROR_MESSAGES.PASSWORD_MISMATCH;
    }
  }

  // Validate Terms and Conditions (if provided)
  if (data.terms_accepted !== undefined) {
    const termsAccepted = ValidationUtils.safeBoolean(data.terms_accepted);
    if (!termsAccepted) {
      errors.terms_accepted = ERROR_MESSAGES.TERMS_NOT_ACCEPTED;
    }
    validatedData.terms_accepted = termsAccepted;
  }

  return {
    isValid: Object.keys(errors).length === 0,
    errors: Object.keys(errors).length > 0 ? errors : null,
    validatedData,
    metadata: {
      password_strength: passwordStrength,
    },
  };
};

// Export as middleware
export const registrationValidationMiddleware = (req, res, next) => {
  const validationResult = validateRegistration(req.body);

  if (!validationResult.isValid) {
    return res.status(400).json({
      success: false,
      message: "فشل التحقق من البيانات",
      errors: validationResult.errors,
    });
  }

  req.validatedData = validationResult.validatedData;
  req.validationMetadata = validationResult.metadata;
  next();
};

// Generate OTP function
const generateOTP = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Helper function to create user data - SIMPLIFIED
const prepareUserData = async (rawData) => {
  // Hash password
  const saltRounds = 10;
  const hashedPassword = await bcrypt.hash(rawData.password, saltRounds);

  // Generate JWT token for verification
  const verificationToken = jwt.sign(
    { email: rawData.email.toLowerCase() },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "2h" },
  );

  return {
    email: rawData.email.toLowerCase().trim(),
    full_name: rawData.full_name.trim(),
    password: hashedPassword,
    phone_number: rawData.phone_number.trim(),
    status: "PENDING_VERIFICATION",
    user_type: "FAMILY_MEMBER",
    verification_token: verificationToken,
    is_verified: false,
    preferences: JSON.stringify({
      theme: "light",
      language: "ar",
      notifications: true,
    }),
    notification_settings: JSON.stringify({
      email: true,
      sms: false,
      push: true,
    }),
    created_at: new Date(),
    updated_at: new Date(),
  };
};

// Helper function to check existing users - SIMPLIFIED
const checkExistingUsers = async (email, phoneNumber) => {
  const errors = {};

  // Check email
  const existingUser = await userModel.findByEmail(email);
  if (existingUser) {
    errors.email = ERROR_MESSAGES.EMAIL_EXISTS;
  }

  // Check phone
  const existingPhone = await userModel.findByPhone(phoneNumber);
  if (existingPhone) {
    errors.phone_number = ERROR_MESSAGES.PHONE_EXISTS;
  }

  if (Object.keys(errors).length > 0) {
    const error = new Error("المستخدم موجود بالفعل");
    error.errors = errors;
    throw error;
  }
};

// Helper function to create verification code
const createVerificationCode = async (userId, userEmail) => {
  const verificationCode = generateOTP();

  try {
    if (VerificationCode && typeof VerificationCode.create === "function") {
      await VerificationCode.create({
        user_id: userId,
        code: verificationCode,
        type: "EMAIL_VERIFICATION",
        recipient: userEmail,
        channel: "email",
        expires_at: new Date(Date.now() + 20 * 60 * 1000), // 10 minutes
        created_at: new Date(),
      });
      return verificationCode;
    } else {
      console.warn("VerificationCode model not available");
      return verificationCode; // Still return code even if can't save to DB
    }
  } catch (error) {
    console.error("Failed to create verification code:", error);
    return verificationCode; // Return code anyway for email sending
  }
};

// Helper function to log security event
const logSecurityEvent = async (eventType, req, additionalDetails = {}) => {
  try {
    if (SecurityLog && typeof SecurityLog.create === "function") {
      await SecurityLog.create({
        event_type: eventType,
        ip_address:
          req.ip ||
          req.headers["x-forwarded-for"] ||
          req.connection.remoteAddress,
        user_agent: req.headers["user-agent"] || "Unknown",
        user_id: additionalDetails.user_id || null,
        details: JSON.stringify({
          timestamp: new Date().toISOString(),
          ...additionalDetails,
        }),
        created_at: new Date(),
      });
    }
  } catch (error) {
    console.error("Failed to log security event:", error);
  }
};

// Generate JWT token for authenticated user
const generateAuthToken = (user) => {
  return jwt.sign(
    {
      userId: user.id || user._id,
      email: user.email,
      userType: user.user_type || "FAMILY_MEMBER",
      status: user.status || "PENDING_VERIFICATION",
    },
    process.env.JWT_SECRET || "your-secret-key",
    { expiresIn: "2h" },
  );
};

// Main registration function - SIMPLIFIED
export const register = async (req, res) => {
  const startTime = Date.now();
  let userCreated = false;
  let userId = null;

  try {
    console.log("Registration request received:", {
      body: req.body,
      timestamp: new Date().toISOString(),
    });

    // Step 1: Validate input using the main validation function
    const validation = validateRegistration(req.body);
    console.log(validation.isValid);

    if (!validation.isValid) {
      await logSecurityEvent("REGISTRATION_VALIDATION_FAILED", req, {
        email: req.body.email || "No email provided",
        errors: validation.errors,
      });

      return res.status(400).json({
        success: false,
        message: "البيانات غير صحيحة",
        errors: validation.errors,
      });
    }

    const validatedData = validation.validatedData;

    // Step 2: Check for existing users
    try {
      const existUser = await checkExistingUsers(
        validatedData.email,
        validatedData.phone_number,
      );
      if (existUser) {
        switch (existUser.status) {
          case "PENDING_VERIFICATION":
            // --------------------------------------
            const userId = existUser.id || existUser._id;
            let verificationCode = null;
            try {
              verificationCode = await createVerificationCode(
                userId,
                existUser.email,
              );
            } catch (verificationError) {
              console.error(
                "Verification code creation failed:",
                verificationError,
              );
              // Don't fail registration if verification setup fails
            }

            // Step 6: Send verification email
            if (
              emailService &&
              typeof emailService.sendVerificationCode === "function"
            ) {
              try {
                await emailService.sendVerificationCode(
                  existUser.email,
                  verificationCode,
                );
              } catch (emailError) {
                console.error("Failed to send verification email:", emailError);
                // Don't fail registration if email fails
              }
            } else {
              console.warn("Email service not available");
            }

            return res.status(200).json({
              success: true,
              redirect: "/verify-email",
              message: "المستخدم موجود بالفعل",
              // errors: error.errors || { general: "المستخدم موجود بالفعل" },
            });
          case "USER_INFO":
            return res.status(200).json({
              success: true,
              redirect: "/user-info",
              message: "المستخدم موجود بالفعل",
              // errors: error.errors || { general: "المستخدم موجود بالفعل" },
            });
        }
        // if (existUser.status === 'PENDING_VERIFICATION')
      }
    } catch (error) {
      await logSecurityEvent("REGISTRATION_DUPLICATE_ATTEMPT", req, {
        email: validatedData.email,
        phone_number: validatedData.phone_number,
        error: error.message,
      });

      return res.status(409).json({
        success: false,
        message: "المستخدم موجود بالفعل",
        errors: error.errors || { general: "المستخدم موجود بالفعل" },
      });
    }

    // Step 3: Prepare and create user
    const userData = await prepareUserData(validatedData);

    // Check if userModel.createUser exists, otherwise use create
    let user;
    if (userModel.createUser && typeof userModel.createUser === "function") {
      user = await userModel.createUser(userData);
    } else if (userModel.create && typeof userModel.create === "function") {
      user = await userModel.create(userData);
    } else {
      throw new Error("User model does not have create method");
    }

    userCreated = true;
    userId = user.id || user._id;

    // Step 4: Remove sensitive data from response
    const sanitizedUser = { ...(user.toObject ? user.toObject() : user) };
    delete sanitizedUser.password;
    if (sanitizedUser.reset_password_token)
      delete sanitizedUser.reset_password_token;
    if (sanitizedUser.verification_token)
      delete sanitizedUser.verification_token;

    // Step 5: Create verification code
    let verificationCode = null;
    try {
      verificationCode = await createVerificationCode(
        userId,
        validatedData.email,
      );
    } catch (verificationError) {
      console.error("Verification code creation failed:", verificationError);
      // Don't fail registration if verification setup fails
    }

    // Step 6: Send verification email
    if (
      emailService &&
      typeof emailService.sendVerificationCode === "function"
    ) {
      try {
        await emailService.sendVerificationCode(
          validatedData.email,
          verificationCode,
        );
      } catch (emailError) {
        console.error("Failed to send verification email:", emailError);
        // Don't fail registration if email fails
      }
    } else {
      console.warn("Email service not available");
    }

    // Step 7: Generate authentication token
    const authToken = generateAuthToken(user);

    // Step 8: Log successful registration
    await logSecurityEvent("REGISTRATION_SUCCESS", req, {
      user_id: userId,
      email: validatedData.email,
      registration_time: Date.now() - startTime,
    });

    // Step 9: Return success response
    return res.status(201).json({
      success: true,
      message: "تم إنشاء حساب جديد بنجاح",
      redirect: "/verify-email",
      data: {
        user: {
          id: sanitizedUser.id || sanitizedUser._id,
          email: sanitizedUser.email,
          full_name: sanitizedUser.full_name,
          phone_number: sanitizedUser.phone_number,
          status: sanitizedUser.status,
          user_type: sanitizedUser.user_type,
          is_verified: sanitizedUser.is_verified || false,
          created_at: sanitizedUser.created_at,
        },
        requiresVerification: true,
        userId: userId,
        token: authToken,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Registration error:", error);

    // Log the error with context
    const errorDetails = {
      error: error.message,
      stack: process.env.NODE_ENV === "development" ? error.stack : undefined,
      userCreated,
      userId,
      request_data: {
        email: req.body.email,
        phone_number: req.body.phone_number,
        has_name: !!req.body.full_name,
      },
      execution_time: Date.now() - startTime,
    };

    await logSecurityEvent("REGISTRATION_FAILED", req, errorDetails);

    // Determine appropriate status code and message
    let statusCode = 500;
    let message = ERROR_MESSAGES.REGISTRATION_FAILED;
    let errors = {};

    if (
      error.name === "ValidationError" ||
      error.message.includes("validation")
    ) {
      statusCode = 400;
      message = "خطأ في التحقق من البيانات";
      errors = error.errors || { general: error.message };
    } else if (error.code === 11000 || error.message.includes("duplicate")) {
      statusCode = 409;
      message = "المستخدم موجود بالفعل";

      // Extract duplicate field from MongoDB error
      if (error.keyPattern) {
        const duplicateField = Object.keys(error.keyPattern)[0];
        const fieldLabels = {
          email: "البريد الإلكتروني",
          phone_number: "رقم الهاتف",
        };
        errors[duplicateField] =
          `${fieldLabels[duplicateField] || duplicateField} مستخدم بالفعل`;
      }
    } else if (error.errors) {
      statusCode = 400;
      message = "خطأ في البيانات";
      errors = error.errors;
    }

    // If user was created but something else failed
    if (userCreated && !userId) {
      message = ERROR_MESSAGES.VERIFICATION_SETUP_FAILED;
    }

    return res.status(statusCode).json({
      success: false,
      message,
      errors,
      errorId: `ERR-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ...(process.env.NODE_ENV === "development" && {
        details: error.message,
      }),
    });
  }
};

// Export for testing
export default {
  register,
  validateRegistration,
  registrationValidationMiddleware,
  VALIDATION_RULES,
  ERROR_MESSAGES,
};
