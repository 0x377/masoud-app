// userInfo.controller.js
import userModel from "../../models/User.js";
import VerificationCode from "../../models/VerificationCode.js";
import { logSecurityEvent } from "../../utils/securityLogger.js";

const ERROR_MESSAGES = {
  USER_NOT_FOUND: "User not found",
  INVALID_DATA: "Invalid user data",
  UPDATE_FAILED: "Failed to update user information",
  SERVER_ERROR: "Internal server error",
  PHONE_NOT_VERIFIED: "Phone number not verified",
  INVALID_PHONE: "Invalid phone number format",
  INVALID_VERIFICATION_CODE: "Invalid or expired verification code",
  INVALID_NATIONAL_ID: "Invalid national ID format",
  INVALID_GENDER: "Invalid gender value",
  INVALID_USER_TYPE: "Invalid user type",
  INVALID_STATUS: "Invalid user status",
  PERMISSION_DENIED: "Permission denied",
};

const SUCCESS_MESSAGES = {
  USER_UPDATED: "User information updated successfully",
  USER_RETRIEVED: "User information retrieved successfully",
  PHONE_VERIFICATION_SENT: "Phone verification code sent",
  PHONE_VERIFIED: "Phone number verified successfully",
  EMAIL_VERIFIED: "Email verified successfully",
};

// Validation helpers
const validateNationalID = (nationalId) => {
  // Saudi National ID validation (10 digits starting with 1 or 2)
  const saudiIdRegex = /^[12]\d{9}$/;
  return saudiIdRegex.test(nationalId);
};

const validatePhoneNumber = (phoneNumber) => {
  // Saudi phone number validation
  const saudiPhoneRegex =
    /^(009665|9665|\+9665|05)(5|0|3|6|4|9|1|8|7)([0-9]{7})$/;
  return saudiPhoneRegex.test(phoneNumber);
};

const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const validateDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Get complete user information by ID
 * @param {string} userId - User ID
 * @param {boolean} includeSensitive - Include sensitive information (admin only)
 * @returns {Promise<Object>} User data
 */
export const getUserById = async (userId, includeSensitive = false) => {
  try {
    if (!userId) {
      return {
        success: false,
        code: "USER_ID_REQUIRED",
        message: "User ID is required",
      };
    }

    const user = await userModel.findById(userId);

    if (!user) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      };
    }

    // Prepare response data
    let responseData = {
      // Basic Information
      id: user.id,
      username: user.username,
      email: user.email,
      email_verified: !!user.email_verified_at,
      phone_number: user.phone_number,
      phone_verified: !!user.phone_verified_at,

      // Personal Information
      national_id: user.national_id,
      full_name_arabic: user.full_name_arabic,
      full_name_english: user.full_name_english,
      gender: user.gender,
      birth_date: user.birth_date,
      birth_place: user.birth_place,
      is_alive: user.is_alive,
      marital_status: user.marital_status,
      blood_type: user.blood_type,
      current_address: user.current_address,
      photo_path: user.photo_path,

      // Family Information
      father_id: user.father_id,
      mother_id: user.mother_id,
      spouse_id: user.spouse_id,

      // User Type & Status
      user_type: user.user_type,
      additional_roles: user.additional_roles
        ? JSON.parse(user.additional_roles)
        : [],
      status: user.status,

      // Preferences
      preferences: user.preferences ? JSON.parse(user.preferences) : {},
      notification_settings: user.notification_settings
        ? JSON.parse(user.notification_settings)
        : {},

      // Statistics
      total_donations: user.total_donations || 0,
      donation_count: user.donation_count || 0,
      last_donation_at: user.last_donation_at,

      // Timestamps
      created_at: user.created_at,
      updated_at: user.updated_at,
    };

    // Include sensitive information only if requested and user has permission
    if (includeSensitive) {
      // Add JSON fields
      responseData.family_info = user.family_info
        ? JSON.parse(user.family_info)
        : {};
      responseData.education_info = user.education_info
        ? JSON.parse(user.education_info)
        : {};
      responseData.work_info = user.work_info ? JSON.parse(user.work_info) : {};
      responseData.additional_info = user.additional_info
        ? JSON.parse(user.additional_info)
        : {};
      responseData.metadata = user.metadata ? JSON.parse(user.metadata) : {};

      // Add sensitive dates
      responseData.death_date = user.death_date;
      responseData.deleted_at = user.deleted_at;
      responseData.verified_at = user.verified_at;
      responseData.password_changed_at = user.password_changed_at;

      // Add login security info
      responseData.last_login_at = user.last_login_at;
      responseData.last_activity_at = user.last_activity_at;
      responseData.login_count = user.login_count || 0;

      // Add MFA info
      responseData.mfa_enabled = user.mfa_enabled || false;
      responseData.mfa_enabled_at = user.mfa_enabled_at;
      responseData.last_mfa_used_at = user.last_mfa_used_at;

      // Add suspension info
      responseData.suspension_reason = user.suspension_reason;
      responseData.suspended_at = user.suspended_at;
      responseData.suspended_by = user.suspended_by;
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.USER_RETRIEVED,
      data: {
        user: responseData,
        includeSensitive,
      },
    };
  } catch (error) {
    console.error("Get user by ID error:", error);
    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};

/**
 * Get user by national ID
 * @param {string} nationalId - National ID
 * @param {boolean} includeSensitive - Include sensitive information
 * @returns {Promise<Object>} User data
 */
export const getUserByNationalId = async (
  nationalId,
  includeSensitive = false,
) => {
  try {
    if (!nationalId) {
      return {
        success: false,
        code: "NATIONAL_ID_REQUIRED",
        message: "National ID is required",
      };
    }

    if (!validateNationalID(nationalId)) {
      return {
        success: false,
        code: "INVALID_NATIONAL_ID",
        message: ERROR_MESSAGES.INVALID_NATIONAL_ID,
      };
    }

    const user = await userModel.findByNationalId(nationalId);

    if (!user) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      };
    }

    return await getUserById(user.id, includeSensitive);
  } catch (error) {
    console.error("Get user by national ID error:", error);
    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};

/**
 * Update user personal information
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @param {Object} req - Request object for logging
 * @returns {Promise<Object>} Update result
 */
export const updateUserPersonalInfo = async (
  userId,
  updateData,
  req = null,
) => {
  try {
    if (!userId) {
      return {
        success: false,
        code: "USER_ID_REQUIRED",
        message: "User ID is required",
      };
    }

    // Check if user exists
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      };
    }

    // Define allowed personal information fields
    const allowedPersonalFields = [
      "national_id",
      "full_name_arabic",
      "full_name_english",
      "gender",
      "birth_date",
      "birth_place",
      "marital_status",
      "blood_type",
      "current_address",
      "photo_path",
      "family_info",
      "education_info",
      "work_info",
      "additional_info",
    ];

    // Filter and validate update data
    const filteredData = {};
    const validationErrors = [];

    Object.keys(updateData).forEach((key) => {
      if (
        allowedPersonalFields.includes(key) &&
        updateData[key] !== undefined
      ) {
        // Validate specific fields
        switch (key) {
          case "national_id":
            if (updateData[key] && !validateNationalID(updateData[key])) {
              validationErrors.push("Invalid national ID format");
              return;
            }
            break;

          case "gender":
            if (!["M", "F"].includes(updateData[key])) {
              validationErrors.push("Gender must be 'M' or 'F'");
              return;
            }
            break;

          case "birth_date":
            if (updateData[key] && !validateDate(updateData[key])) {
              validationErrors.push("Invalid birth date");
              return;
            }
            break;

          case "family_info":
          case "education_info":
          case "work_info":
          case "additional_info":
            try {
              // Try to parse JSON if it's a string
              if (typeof updateData[key] === "string") {
                JSON.parse(updateData[key]);
              } else if (typeof updateData[key] === "object") {
                // Already an object, ensure it's valid
                JSON.stringify(updateData[key]);
              }
            } catch (jsonError) {
              validationErrors.push(`Invalid JSON format for ${key}`);
              return;
            }
            break;
        }

        filteredData[key] = updateData[key];
      }
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation errors",
        errors: validationErrors,
      };
    }

    // Add updated_at timestamp
    filteredData.updated_at = new Date().toISOString();

    // Update user
    const updatedUser = await userModel.update(userId, filteredData);

    if (!updatedUser) {
      return {
        success: false,
        code: "UPDATE_FAILED",
        message: ERROR_MESSAGES.UPDATE_FAILED,
      };
    }

    // Get updated user data
    const user = await userModel.findById(userId);

    // Log security event if request object provided
    if (req) {
      await logSecurityEvent(userId, "USER_PERSONAL_INFO_UPDATED", req, {
        fieldsUpdated: Object.keys(filteredData),
        ipAddress: req.ip || req.headers["x-forwarded-for"],
      });
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.USER_UPDATED,
      data: {
        user: {
          id: user.id,
          national_id: user.national_id,
          full_name_arabic: user.full_name_arabic,
          full_name_english: user.full_name_english,
          gender: user.gender,
          birth_date: user.birth_date,
          birth_place: user.birth_place,
          marital_status: user.marital_status,
          blood_type: user.blood_type,
          current_address: user.current_address,
          photo_path: user.photo_path,
        },
        updatedFields: Object.keys(filteredData),
      },
    };
  } catch (error) {
    console.error("Update user personal info error:", error);

    // Handle specific errors
    if (error.code === "ER_DUP_ENTRY") {
      return {
        success: false,
        code: "DUPLICATE_ENTRY",
        message: "This national ID is already registered",
      };
    }

    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};

/**
 * Update user contact information
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @param {Object} req - Request object for logging
 * @returns {Promise<Object>} Update result
 */
export const updateUserContactInfo = async (userId, updateData, req = null) => {
  try {
    if (!userId) {
      return {
        success: false,
        code: "USER_ID_REQUIRED",
        message: "User ID is required",
      };
    }

    // Check if user exists
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      };
    }

    // Define allowed contact fields
    const allowedContactFields = ["email", "phone_number", "current_address"];

    // Filter and validate update data
    const filteredData = {};
    const validationErrors = [];

    Object.keys(updateData).forEach((key) => {
      if (allowedContactFields.includes(key) && updateData[key] !== undefined) {
        // Validate specific fields
        switch (key) {
          case "email":
            if (updateData[key] && !validateEmail(updateData[key])) {
              validationErrors.push("Invalid email format");
              return;
            }
            // Reset email verification if email is being changed
            if (updateData[key] !== existingUser.email) {
              filteredData.email_verified_at = null;
            }
            break;

          case "phone_number":
            if (updateData[key] && !validatePhoneNumber(updateData[key])) {
              validationErrors.push("Invalid phone number format");
              return;
            }
            // Reset phone verification if phone is being changed
            if (updateData[key] !== existingUser.phone_number) {
              filteredData.phone_verified_at = null;
            }
            break;
        }

        filteredData[key] = updateData[key];
      }
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation errors",
        errors: validationErrors,
      };
    }

    // Add updated_at timestamp
    filteredData.updated_at = new Date().toISOString();

    // Update user
    const updatedUser = await userModel.update(userId, filteredData);

    if (!updatedUser) {
      return {
        success: false,
        code: "UPDATE_FAILED",
        message: ERROR_MESSAGES.UPDATE_FAILED,
      };
    }

    // Log security event if request object provided
    if (req) {
      await logSecurityEvent(userId, "USER_CONTACT_INFO_UPDATED", req, {
        fieldsUpdated: Object.keys(filteredData),
        ipAddress: req.ip || req.headers["x-forwarded-for"],
      });
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.USER_UPDATED,
      data: {
        updatedFields: Object.keys(filteredData),
        email_verified: !filteredData.email_verified_at ? false : true,
        phone_verified: !filteredData.phone_verified_at ? false : true,
      },
    };
  } catch (error) {
    console.error("Update user contact info error:", error);

    // Handle specific errors
    if (error.code === "ER_DUP_ENTRY") {
      const field = error.message.includes("email") ? "email" : "phone number";
      return {
        success: false,
        code: "DUPLICATE_ENTRY",
        message: `This ${field} is already registered with another account`,
      };
    }

    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};

/**
 * Update user preferences and settings
 * @param {string} userId - User ID
 * @param {Object} updateData - Data to update
 * @param {Object} req - Request object for logging
 * @returns {Promise<Object>} Update result
 */
export const updateUserPreferences = async (userId, updateData, req = null) => {
  try {
    if (!userId) {
      return {
        success: false,
        code: "USER_ID_REQUIRED",
        message: "User ID is required",
      };
    }

    // Check if user exists
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      };
    }

    // Define allowed preference fields
    const allowedPreferenceFields = ["preferences", "notification_settings"];

    // Filter and validate update data
    const filteredData = {};
    const validationErrors = [];

    Object.keys(updateData).forEach((key) => {
      if (
        allowedPreferenceFields.includes(key) &&
        updateData[key] !== undefined
      ) {
        // Validate JSON fields
        try {
          if (typeof updateData[key] === "string") {
            JSON.parse(updateData[key]);
            filteredData[key] = updateData[key];
          } else if (typeof updateData[key] === "object") {
            filteredData[key] = JSON.stringify(updateData[key]);
          }
        } catch (jsonError) {
          validationErrors.push(`Invalid JSON format for ${key}`);
        }
      }
    });

    if (validationErrors.length > 0) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation errors",
        errors: validationErrors,
      };
    }

    // Add updated_at timestamp
    filteredData.updated_at = new Date().toISOString();

    // Update user
    const updatedUser = await userModel.update(userId, filteredData);

    if (!updatedUser) {
      return {
        success: false,
        code: "UPDATE_FAILED",
        message: ERROR_MESSAGES.UPDATE_FAILED,
      };
    }

    // Log event if request object provided
    if (req) {
      await logSecurityEvent(userId, "USER_PREFERENCES_UPDATED", req, {
        fieldsUpdated: Object.keys(filteredData),
      });
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.USER_UPDATED,
      data: {
        updatedFields: Object.keys(filteredData),
      },
    };
  } catch (error) {
    console.error("Update user preferences error:", error);
    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};

/**
 * Update family relationships
 * @param {string} userId - User ID
 * @param {Object} relationships - Family relationships data
 * @param {Object} req - Request object for logging
 * @returns {Promise<Object>} Update result
 */
export const updateFamilyRelationships = async (
  userId,
  relationships,
  req = null,
) => {
  try {
    if (!userId) {
      return {
        success: false,
        code: "USER_ID_REQUIRED",
        message: "User ID is required",
      };
    }

    // Check if user exists
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      };
    }

    // Define allowed relationship fields
    const allowedRelationshipFields = [
      "father_id",
      "mother_id",
      "spouse_id",
      "family_info",
    ];

    // Filter update data
    const filteredData = {};
    Object.keys(relationships).forEach((key) => {
      if (
        allowedRelationshipFields.includes(key) &&
        relationships[key] !== undefined
      ) {
        filteredData[key] = relationships[key];
      }
    });

    // Validate family members exist
    const validationErrors = [];

    if (filteredData.father_id) {
      const father = await userModel.findById(filteredData.father_id);
      if (!father) {
        validationErrors.push("Father ID not found");
      } else if (father.gender !== "M") {
        validationErrors.push("Father must be male");
      }
    }

    if (filteredData.mother_id) {
      const mother = await userModel.findById(filteredData.mother_id);
      if (!mother) {
        validationErrors.push("Mother ID not found");
      } else if (mother.gender !== "F") {
        validationErrors.push("Mother must be female");
      }
    }

    if (filteredData.spouse_id) {
      const spouse = await userModel.findById(filteredData.spouse_id);
      if (!spouse) {
        validationErrors.push("Spouse ID not found");
      } else if (spouse.gender === existingUser.gender) {
        validationErrors.push("Spouse must be opposite gender");
      }
    }

    if (validationErrors.length > 0) {
      return {
        success: false,
        code: "VALIDATION_ERROR",
        message: "Validation errors",
        errors: validationErrors,
      };
    }

    // Add updated_at timestamp
    filteredData.updated_at = new Date().toISOString();

    // Update user
    const updatedUser = await userModel.update(userId, filteredData);

    if (!updatedUser) {
      return {
        success: false,
        code: "UPDATE_FAILED",
        message: ERROR_MESSAGES.UPDATE_FAILED,
      };
    }

    // Log event if request object provided
    if (req) {
      await logSecurityEvent(userId, "FAMILY_RELATIONSHIPS_UPDATED", req, {
        fieldsUpdated: Object.keys(filteredData),
      });
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.USER_UPDATED,
      data: {
        updatedFields: Object.keys(filteredData),
      },
    };
  } catch (error) {
    console.error("Update family relationships error:", error);
    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};

/**
 * Update user status (admin only)
 * @param {string} userId - User ID
 * @param {Object} statusData - Status update data
 * @param {Object} req - Request object for logging
 * @returns {Promise<Object>} Update result
 */
export const updateUserStatus = async (userId, statusData, req = null) => {
  try {
    if (!userId) {
      return {
        success: false,
        code: "USER_ID_REQUIRED",
        message: "User ID is required",
      };
    }

    // Check if user exists
    const existingUser = await userModel.findById(userId);
    if (!existingUser) {
      return {
        success: false,
        code: "USER_NOT_FOUND",
        message: ERROR_MESSAGES.USER_NOT_FOUND,
      };
    }

    // Define allowed status fields
    const allowedStatusFields = ["status", "suspension_reason", "suspended_by"];

    // Filter update data
    const filteredData = {};
    Object.keys(statusData).forEach((key) => {
      if (allowedStatusFields.includes(key) && statusData[key] !== undefined) {
        filteredData[key] = statusData[key];
      }
    });

    // Validate status
    const validStatuses = [
      "PENDING_VERIFICATION",
      "ACTIVE",
      "USER_INFO",
      "SUSPENDED",
      "DEACTIVATED",
      "BANNED",
    ];

    if (filteredData.status && !validStatuses.includes(filteredData.status)) {
      return {
        success: false,
        code: "INVALID_STATUS",
        message: ERROR_MESSAGES.INVALID_STATUS,
      };
    }

    // Set suspension timestamp if status is being changed to SUSPENDED
    if (
      filteredData.status === "SUSPENDED" &&
      existingUser.status !== "SUSPENDED"
    ) {
      filteredData.suspended_at = new Date().toISOString();
    }

    // Add updated_at timestamp
    filteredData.updated_at = new Date().toISOString();

    // Update user
    const updatedUser = await userModel.update(userId, filteredData);

    if (!updatedUser) {
      return {
        success: false,
        code: "UPDATE_FAILED",
        message: ERROR_MESSAGES.UPDATE_FAILED,
      };
    }

    // Log event if request object provided
    if (req) {
      await logSecurityEvent(userId, "USER_STATUS_UPDATED", req, {
        oldStatus: existingUser.status,
        newStatus: filteredData.status,
        updatedBy: req.user?.id,
        suspensionReason: filteredData.suspension_reason,
      });
    }

    return {
      success: true,
      message: SUCCESS_MESSAGES.USER_UPDATED,
      data: {
        userId,
        oldStatus: existingUser.status,
        newStatus: filteredData.status || existingUser.status,
        updatedFields: Object.keys(filteredData),
      },
    };
  } catch (error) {
    console.error("Update user status error:", error);
    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};

/**
 * Complete user info setup for new users
 * @param {string} userId - User ID
 * @param {Object} userData - Complete user data
 * @param {Object} req - Request object
 * @returns {Promise<Object>} Setup result
 */
export const completeUserInfoSetup = async (userId, userData, req = null) => {
  try {
    if (!userId) {
      return {
        success: false,
        code: "USER_ID_REQUIRED",
        message: "User ID is required",
      };
    }

    // Required fields for Saudi user info setup
    const requiredFields = [
      "national_id",
      "full_name_arabic",
      "full_name_english",
      "gender",
      "birth_date",
      "phone_number",
    ];

    const missingFields = requiredFields.filter(
      (field) => !userData[field] || userData[field].toString().trim() === "",
    );

    if (missingFields.length > 0) {
      return {
        success: false,
        code: "MISSING_FIELDS",
        message: `Missing required fields: ${missingFields.join(", ")}`,
        missingFields,
      };
    }

    // Validate national ID
    if (!validateNationalID(userData.national_id)) {
      return {
        success: false,
        code: "INVALID_NATIONAL_ID",
        message: ERROR_MESSAGES.INVALID_NATIONAL_ID,
      };
    }

    // Validate phone number
    if (!validatePhoneNumber(userData.phone_number)) {
      return {
        success: false,
        code: "INVALID_PHONE",
        message: ERROR_MESSAGES.INVALID_PHONE,
      };
    }

    // Validate gender
    if (!["M", "F"].includes(userData.gender)) {
      return {
        success: false,
        code: "INVALID_GENDER",
        message: ERROR_MESSAGES.INVALID_GENDER,
      };
    }

    // Validate birth date
    if (!validateDate(userData.birth_date)) {
      return {
        success: false,
        code: "INVALID_BIRTH_DATE",
        message: "Invalid birth date format",
      };
    }

    // Calculate age from birth date
    const birthDate = new Date(userData.birth_date);
    const today = new Date();
    const age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (
      monthDiff < 0 ||
      (monthDiff === 0 && today.getDate() < birthDate.getDate())
    ) {
      age--;
    }

    // Check minimum age (18 years for full registration)
    if (age < 18) {
      return {
        success: false,
        code: "UNDERAGE",
        message: "You must be at least 18 years old to register",
        age,
      };
    }

    // Prepare update data
    const updateData = {
      national_id: userData.national_id,
      full_name_arabic: userData.full_name_arabic,
      full_name_english: userData.full_name_english,
      gender: userData.gender,
      birth_date: userData.birth_date,
      phone_number: userData.phone_number,
      birth_place: userData.birth_place || null,
      current_address: userData.current_address || null,
      status: "ACTIVE", // Change status to ACTIVE after completing info
      updated_at: new Date().toISOString(),
    };

    // Update user
    const updatedUser = await userModel.update(userId, updateData);

    if (!updatedUser) {
      return {
        success: false,
        code: "UPDATE_FAILED",
        message: ERROR_MESSAGES.UPDATE_FAILED,
      };
    }

    // Log completion event
    if (req) {
      await logSecurityEvent(userId, "USER_INFO_COMPLETED", req, {
        setupCompleted: true,
        age,
      });
    }

    // Get updated user data
    const user = await getUserById(userId);

    return {
      success: true,
      message: "User information completed successfully",
      data: {
        user: user.data?.user || {},
        redirect: "/dashboard",
        age,
      },
    };
  } catch (error) {
    console.error("Complete user info setup error:", error);

    // Handle duplicate national ID
    if (error.code === "ER_DUP_ENTRY") {
      return {
        success: false,
        code: "DUPLICATE_NATIONAL_ID",
        message: "This national ID is already registered",
      };
    }

    return {
      success: false,
      code: "SERVER_ERROR",
      message: ERROR_MESSAGES.SERVER_ERROR,
      error: error.message,
    };
  }
};
