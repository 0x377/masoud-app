import BaseModel from "./BaseModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";
import Person from "./Person.js";
import db from "../config/database.js";

class User extends BaseModel {
  constructor() {
    super("users", "id");
    this.jsonFields = [
      "additional_roles",
      "permissions_override",
      "preferences",
      "notification_settings",
      "metadata",
    ];
    this.passwordMinLength = 8;
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields for new users
    if (!isUpdate) {
      if (!data.email && !data.phone_number) {
        errors.push("Email or phone number is required");
      }
      if (!data.password) {
        errors.push("Password is required");
      }
    }

    // Email validation
    if (data.email && !validator.isEmail(data.email)) {
      errors.push("Invalid email format");
    }

    // Phone validation (Saudi format)
    if (
      data.phone_number &&
      !/^(009665|9665|\+9665|05|5)([0-9]{8})$/.test(data.phone_number)
    ) {
      errors.push("Invalid Saudi phone number format");
    }

    // Password strength
    if (data.password && !this.isStrongPassword(data.password)) {
      errors.push(
        `Password must be at least ${this.passwordMinLength} characters with uppercase, lowercase, number, and special character`,
      );
    }

    // User type validation
    const validUserTypes = [
      "FAMILY_MEMBER",
      "BOARD_MEMBER",
      "EXECUTIVE",
      "FINANCE_MANAGER",
      "SOCIAL_COMMITTEE",
      "CULTURAL_COMMITTEE",
      "RECONCILIATION_COMMITTEE",
      "SPORTS_COMMITTEE",
      "MEDIA_CENTER",
      "SUPER_ADMIN",
    ];

    if (data.user_type && !validUserTypes.includes(data.user_type)) {
      errors.push("Invalid user type");
    }

    // Status validation
    const validStatuses = [
      "PENDING_VERIFICATION",
      "ACTIVE",
      "SUSPENDED",
      "DEACTIVATED",
      "BANNED",
    ];

    if (data.status && !validStatuses.includes(data.status)) {
      errors.push("Invalid status");
    }

    return errors;
  }

  // Check password strength
  isStrongPassword(password) {
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
      password,
    );

    return (
      password.length >= this.passwordMinLength &&
      hasUpperCase &&
      hasLowerCase &&
      hasNumbers &&
      hasSpecialChar
    );
  }

  // Hash password
  async hashPassword(password) {
    const saltRounds = 12;
    return await bcrypt.hash(password, saltRounds);
  }

  // Verify password
  async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  // Generate MFA secret
  generateMFASecret() {
    return crypto.randomBytes(20).toString("base64");
  }

  // Generate backup codes
  generateBackupCodes(count = 10) {
    const codes = [];
    for (let i = 0; i < count; i++) {
      codes.push(
        crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 8),
      );
    }
    return codes;
  }

  // Create user with person record
  async createUserWithPerson(userData, personData = {}) {
    return await db.transaction(async (connection) => {
      // Create person first
      const personModel = new Person();
      const person = await personModel.createPerson({
        ...personData,
        email: userData.email,
        phone_number: userData.phone_number,
      });

      // Create user with person_id
      const hashedPassword = await this.hashPassword(userData.password);

      const user = await this.create({
        ...userData,
        person_id: person.id,
        password: hashedPassword,
        password_changed_at: this.formatDate(new Date()),
        status: userData.status || "PENDING_VERIFICATION",
        user_type: userData.user_type || "FAMILY_MEMBER",
      });

      return { user, person };
    });
  }

  /*
   * Find a single user matching the criteria
   * @param {Object} where - WHERE conditions
   * @param {Object} options - Additional options
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async findOne(where = {}, options = {}) {
    try {
      const {
        includeDeleted = false,
        includePerson = false,
        selectFields = ['*'],
        orderBy = 'created_at',
        orderDirection = 'DESC'
      } = options;

      // Build WHERE clause
      let whereClause = 'WHERE 1=1';
      const params = [];

      // Process WHERE conditions
      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          whereClause += ` AND u.${key} = ?`;
          params.push(value);
        }
      });

      if (!includeDeleted) {
        whereClause += ' AND u.deleted_at IS NULL';
      }

      // Build SELECT
      let selectClause = 'SELECT u.*';
      let fromClause = 'FROM users u';
      
      if (includePerson) {
        selectClause += ', p.*';
        fromClause += ' LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL';
      }

      // Build ORDER BY
      const orderClause = `ORDER BY u.${orderBy} ${orderDirection}`;

      const sql = `
        ${selectClause}
        ${fromClause}
        ${whereClause}
        ${orderClause}
        LIMIT 1
      `;

      const results = await db.query(sql, params);
      
      if (results.length === 0) {
        return null;
      }

      // Process the result
      const user = results[0];
      
      // Parse JSON fields
      this.jsonFields.forEach(field => {
        if (user[field] && typeof user[field] === 'string') {
          try {
            user[field] = JSON.parse(user[field]);
          } catch {
            // Keep as string if parsing fails
          }
        }
      });

      return user;
    } catch (error) {
      console.error('Error in User.findOne:', error);
      throw error;
    }
  }

  // Other methods (findByEmail, authenticate, etc.)...

  async findByEmail(email, options = {}) {
    return await this.findOne({ email }, options);
  }

  async authenticate(email, password) {
    try {
      const user = await this.findByEmail(email, { includeDeleted: false });
      
      if (!user) {
        return { success: false, error: 'User not found' };
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);
      
      if (!isPasswordValid) {
        return { success: false, error: 'Invalid password' };
      }

      // Remove sensitive data
      const userData = { ...user };
      delete userData.password;
      delete userData.mfa_secret;
      delete userData.mfa_backup_codes;

      return { 
        success: true, 
        user: userData,
        requiresMFA: user.mfa_enabled || false
      };
    } catch (error) {
      console.error('Authentication error:', error);
      return { success: false, error: 'Authentication failed' };
    }
  }

  // Find by email
  // async findByEmail(email, includeDeleted = false) {
  //   const sql = `
  //     SELECT u.*, p.* 
  //     FROM users u
  //     LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL
  //     WHERE u.email = ? 
  //     ${!includeDeleted ? "AND u.deleted_at IS NULL" : ""}
  //   `;

  //   const results = await db.query(sql, [email]);
  //   if (results.length === 0) return null;

  //   const record = results[0];
  //   return this.parseJSONFields(record, this.jsonFields);
  // }

  // Find by phone
  async findByPhone(phone, includeDeleted = false) {
    const sql = `
      SELECT u.*, p.* 
      FROM users u
      LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL
      WHERE u.phone_number = ? 
      ${!includeDeleted ? "AND u.deleted_at IS NULL" : ""}
    `;

    const results = await db.query(sql, [phone]);
    if (results.length === 0) return null;

    const record = results[0];
    return this.parseJSONFields(record, this.jsonFields);
  }

  // Find by username
  async findByUsername(username, includeDeleted = false) {
    const sql = `
      SELECT u.*, p.* 
      FROM users u
      LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL
      WHERE u.username = ? 
      ${!includeDeleted ? "AND u.deleted_at IS NULL" : ""}
    `;

    const results = await db.query(sql, [username]);
    if (results.length === 0) return null;

    const record = results[0];
    return this.parseJSONFields(record, this.jsonFields);
  }

  // Authenticate user
  // async authenticate(identifier, password, ipAddress = null) {
  //   // Try to find user by email or phone
  //   let user =
  //     (await this.findByEmail(identifier)) ||
  //     (await this.findByPhone(identifier));

  //   if (!user) {
  //     throw new Error("Invalid credentials");
  //   }

  //   // Check account status
  //   if (user.status !== "ACTIVE") {
  //     throw new Error(
  //       `Account is ${user.status.toLowerCase().replace("_", " ")}`,
  //     );
  //   }

  //   // Check if account is locked
  //   if (user.locked_until && new Date(user.locked_until) > new Date()) {
  //     throw new Error("Account is temporarily locked. Please try again later.");
  //   }

  //   // Verify password
  //   const isPasswordValid = await this.verifyPassword(password, user.password);

  //   if (!isPasswordValid) {
  //     // Record failed attempt
  //     await this.recordFailedLogin(user.id);

  //     const failedAttempts = (user.failed_login_attempts || 0) + 1;
  //     const remainingAttempts = 5 - failedAttempts;

  //     if (remainingAttempts > 0) {
  //       throw new Error(
  //         `Invalid password. ${remainingAttempts} attempts remaining.`,
  //       );
  //     } else {
  //       throw new Error(
  //         "Account locked due to multiple failed attempts. Please contact support.",
  //       );
  //     }
  //   }

  //   // Reset failed attempts on successful login
  //   await this.resetFailedAttempts(user.id);

  //   // Update last login
  //   await this.updateLoginInfo(user.id, ipAddress);

  //   // Sanitize user object
  //   const sanitizedUser = this.sanitize(user);

  //   return {
  //     user: sanitizedUser,
  //     requiresMFA: user.mfa_enabled,
  //     mfaSecret: user.mfa_enabled ? user.mfa_secret : null,
  //   };
  // }

  // Record failed login attempt
  async recordFailedLogin(userId) {
    const user = await this.findById(userId);
    if (!user) return;

    const failedAttempts = (user.failed_login_attempts || 0) + 1;
    let lockedUntil = null;
    let newStatus = user.status;

    // Lock account after 5 failed attempts for 30 minutes
    if (failedAttempts >= 5) {
      const lockTime = new Date();
      lockTime.setMinutes(lockTime.getMinutes() + 30);
      lockedUntil = this.formatDate(lockTime);
      newStatus = "SUSPENDED";
    }

    await this.update(userId, {
      failed_login_attempts: failedAttempts,
      locked_until: lockedUntil,
      status: newStatus,
      last_activity_at: this.formatDate(new Date()),
    });
  }

  // Reset failed login attempts
  async resetFailedAttempts(userId) {
    await this.update(userId, {
      failed_login_attempts: 0,
      locked_until: null,
      last_activity_at: this.formatDate(new Date()),
    });
  }

  // Update login information
  async updateLoginInfo(userId, ipAddress = null) {
    const updateData = {
      last_login_at: this.formatDate(new Date()),
      last_activity_at: this.formatDate(new Date()),
      login_count: await this.incrementLoginCount(userId),
    };

    if (ipAddress) {
      updateData.last_login_ip = ipAddress;
    }

    await this.update(userId, updateData);
  }

  // Increment login count
  async incrementLoginCount(userId) {
    const user = await this.findById(userId);
    return (user.login_count || 0) + 1;
  }

  // Enable MFA
  async enableMFA(userId) {
    const mfaSecret = this.generateMFASecret();
    const backupCodes = this.generateBackupCodes();

    await this.update(userId, {
      mfa_enabled: true,
      mfa_secret: mfaSecret,
      mfa_backup_codes: JSON.stringify(backupCodes),
      mfa_enabled_at: this.formatDate(new Date()),
    });

    return { mfaSecret, backupCodes };
  }

  // Disable MFA
  async disableMFA(userId) {
    await this.update(userId, {
      mfa_enabled: false,
      mfa_secret: null,
      mfa_backup_codes: null,
      mfa_enabled_at: null,
      last_mfa_used_at: null,
    });
  }

  // Verify MFA code
  async verifyMFA(userId, code) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    if (!user.mfa_enabled || !user.mfa_secret) {
      throw new Error("MFA not enabled for this user");
    }

    // TODO: Implement TOTP verification with library like 'otplib'
    // For now, simple verification with backup codes
    const backupCodes = user.mfa_backup_codes || [];

    if (backupCodes.includes(code)) {
      // Remove used backup code
      const updatedCodes = backupCodes.filter((c) => c !== code);

      await this.update(userId, {
        mfa_backup_codes: JSON.stringify(updatedCodes),
        last_mfa_used_at: this.formatDate(new Date()),
      });

      return { success: true, isBackupCode: true };
    }

    // TODO: Verify TOTP code with mfa_secret
    const isValidTOTP = true; // Placeholder

    if (isValidTOTP) {
      await this.update(userId, {
        last_mfa_used_at: this.formatDate(new Date()),
      });
    }

    return { success: isValidTOTP, isBackupCode: false };
  }

  // Change password
  async changePassword(userId, currentPassword, newPassword) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    // Verify current password
    const isValid = await this.verifyPassword(currentPassword, user.password);
    if (!isValid) {
      throw new Error("Current password is incorrect");
    }

    // Validate new password
    if (!this.isStrongPassword(newPassword)) {
      throw new Error("New password does not meet security requirements");
    }

    // Check password history (prevent reuse)
    // TODO: Implement password history check

    // Update password
    const hashedPassword = await this.hashPassword(newPassword);

    await this.update(userId, {
      password: hashedPassword,
      password_changed_at: this.formatDate(new Date()),
    });

    return true;
  }

  // Update user status
  async updateStatus(userId, status, reason = "", updatedBy = null) {
    const validStatuses = [
      "PENDING_VERIFICATION",
      "ACTIVE",
      "SUSPENDED",
      "DEACTIVATED",
      "BANNED",
    ];

    if (!validStatuses.includes(status)) {
      throw new Error("Invalid status");
    }

    const updateData = {
      status,
      last_activity_at: this.formatDate(new Date()),
    };

    if (status === "SUSPENDED") {
      updateData.suspended_at = this.formatDate(new Date());
      updateData.suspended_by = updatedBy;
      updateData.suspension_reason = reason;
    }

    return await this.update(userId, updateData);
  }

  // Get user permissions
  async getPermissions(userId) {
    const user = await this.findById(userId);
    if (!user) {
      throw new Error("User not found");
    }

    const basePermissions = this.getBasePermissions(user.user_type);
    const overridePermissions = user.permissions_override || {};

    // Merge base permissions with overrides
    const permissions = { ...basePermissions };

    Object.entries(overridePermissions).forEach(([key, value]) => {
      if (value === false) {
        delete permissions[key];
      } else {
        permissions[key] = value;
      }
    });

    return permissions;
  }

  // Base permissions by user type
  getBasePermissions(userType) {
    const permissionTemplates = {
      FAMILY_MEMBER: {
        view_profile: true,
        edit_own_profile: true,
        view_family_tree: true,
        view_events: true,
        register_events: true,
        view_donations: true,
        make_donations: true,
        view_announcements: true,
      },
      BOARD_MEMBER: {
        ...this.getBasePermissions("FAMILY_MEMBER"),
        view_all_profiles: true,
        manage_events: true,
        view_financial_reports: true,
        manage_announcements: true,
      },
      EXECUTIVE: {
        ...this.getBasePermissions("BOARD_MEMBER"),
        manage_users: true,
        manage_committees: true,
        approve_financial_transactions: true,
        access_analytics: true,
      },
      FINANCE_MANAGER: {
        ...this.getBasePermissions("BOARD_MEMBER"),
        manage_donations: true,
        manage_invoices: true,
        generate_financial_reports: true,
        approve_payments: true,
      },
      SUPER_ADMIN: {
        all: true,
      },
    };

    return (
      permissionTemplates[userType] || permissionTemplates["FAMILY_MEMBER"]
    );
  }

  // Search users
  async searchUsers(query, options = {}) {
    const {
      page = 1,
      limit = 20,
      user_type = null,
      status = null,
      includeDeleted = false,
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        u.id,
        u.email,
        u.phone_number,
        u.user_type,
        u.status,
        u.created_at,
        u.last_login_at,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        p.birth_date
      FROM users u
      LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL
      WHERE 1=1
    `;

    const params = [];

    if (!includeDeleted) {
      sql += " AND u.deleted_at IS NULL";
    }

    if (query) {
      sql +=
        " AND (u.email LIKE ? OR u.phone_number LIKE ? OR p.full_name_arabic LIKE ? OR p.full_name_english LIKE ?)";
      params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
    }

    if (user_type) {
      sql += " AND u.user_type = ?";
      params.push(user_type);
    }

    if (status) {
      sql += " AND u.status = ?";
      params.push(status);
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const countResult = await db.query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Get data
    sql += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const data = await db.query(sql, params);

    return {
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    };
  }

  // Get user statistics
  async getUserStatistics(userId = null) {
    let sql = "";
    const params = [];

    if (userId) {
      // Individual user statistics
      sql = `
        SELECT 
          u.login_count,
          u.total_donations,
          u.donation_count,
          u.last_donation_at,
          u.last_login_at,
          u.last_activity_at,
          u.created_at,
          u.failed_login_attempts,
          u.status,
          u.user_type,
          TIMESTAMPDIFF(DAY, u.created_at, NOW()) as days_since_join,
          p.full_name_arabic,
          p.full_name_english
        FROM users u
        LEFT JOIN persons p ON u.person_id = p.id
        WHERE u.id = ?
      `;
      params.push(userId);
    } else {
      // System-wide statistics
      sql = `
        SELECT 
          COUNT(*) as total_users,
          SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_users,
          SUM(CASE WHEN status = 'PENDING_VERIFICATION' THEN 1 ELSE 0 END) as pending_users,
          SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_users,
          SUM(CASE WHEN status = 'DEACTIVATED' THEN 1 ELSE 0 END) as deactivated_users,
          SUM(CASE WHEN status = 'BANNED' THEN 1 ELSE 0 END) as banned_users,
          SUM(CASE WHEN mfa_enabled = 1 THEN 1 ELSE 0 END) as mfa_enabled_users,
          AVG(login_count) as avg_login_count,
          SUM(total_donations) as total_donations_amount,
          SUM(donation_count) as total_donations_count,
          MAX(last_login_at) as most_recent_login,
          MIN(created_at) as oldest_account,
          MAX(created_at) as newest_account
        FROM users 
        WHERE deleted_at IS NULL
      `;
    }

    const results = await db.query(sql, params);
    return userId ? results[0] : results[0];
  }

  // Get users by type
  async getUsersByType(userType, options = {}) {
    const { page = 1, limit = 20, includeDeleted = false } = options;

    const sql = `
      SELECT u.*, p.full_name_arabic, p.full_name_english
      FROM users u
      LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL
      WHERE u.user_type = ?
      ${!includeDeleted ? "AND u.deleted_at IS NULL" : ""}
      ORDER BY u.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const offset = (page - 1) * limit;
    const results = await db.query(sql, [userType, limit, offset]);

    return results.map((record) =>
      this.parseJSONFields(record, this.jsonFields),
    );
  }

  // Sanitize user object (remove sensitive data)
  sanitize(user) {
    const sanitized = { ...user };

    // Remove sensitive fields
    delete sanitized.password;
    delete sanitized.mfa_secret;
    delete sanitized.mfa_backup_codes;
    delete sanitized.last_login_ip;
    delete sanitized.current_session_id;

    return sanitized;
  }

  // Verify email
  async verifyEmail(userId) {
    await this.update(userId, {
      email_verified_at: this.formatDate(new Date()),
      status: "ACTIVE",
    });
  }

  // Verify phone
  async verifyPhone(userId) {
    await this.update(userId, {
      phone_verified_at: this.formatDate(new Date()),
    });
  }

  // Check if user exists by email or phone
  async existsByIdentifier(identifier) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM users 
      WHERE (email = ? OR phone_number = ?) 
        AND deleted_at IS NULL
    `;

    const results = await db.query(sql, [identifier, identifier]);
    return results[0]?.count > 0;
  }

  // Bulk update users
  async bulkUpdate(userIds, updates) {
    if (!Array.isArray(userIds) || userIds.length === 0) {
      throw new Error("User IDs array is required");
    }

    const placeholders = userIds.map(() => "?").join(",");
    const sql = `
      UPDATE users 
      SET ${Object.keys(updates)
        .map((key) => `${key} = ?`)
        .join(", ")}, 
          updated_at = ?
      WHERE id IN (${placeholders})
      AND deleted_at IS NULL
    `;

    const params = [
      ...Object.values(updates),
      this.formatDate(new Date()),
      ...userIds,
    ];

    await db.query(sql, params);
    return true;
  }
}

export default User;

// import BaseModel from './BaseModel.js';
// import bcrypt from 'bcryptjs';
// import crypto from 'crypto';
// import validator from 'validator';

// class User extends BaseModel {
//   constructor() {
//     super('users', 'id');
//   }

//   // Validate user data
//   validate(data, isUpdate = false) {
//     const errors = [];

//     // Required fields for new users
//     if (!isUpdate) {
//       if (!data.email) {
//         errors.push('Email is required');
//       }
//       if (!data.password) {
//         errors.push('Password is required');
//       }
//     }

//     // Email validation
//     if (data.email && !validator.isEmail(data.email)) {
//       errors.push('Invalid email format');
//     }

//     // Phone validation
//     if (data.phone_number && !/^(009665|9665|\+9665|05|5)([0-9]{8})$/.test(data.phone_number)) {
//       errors.push('Invalid Saudi phone number format');
//     }

//     // Password strength
//     if (data.password && !this.isStrongPassword(data.password)) {
//       errors.push('Password must be at least 8 characters with uppercase, lowercase, number, and special character');
//     }

//     // User type validation
//     const validUserTypes = [
//       'FAMILY_MEMBER',
//       'BOARD_MEMBER',
//       'EXECUTIVE',
//       'FINANCE_MANAGER',
//       'SOCIAL_COMMITTEE',
//       'CULTURAL_COMMITTEE',
//       'RECONCILIATION_COMMITTEE',
//       'SPORTS_COMMITTEE',
//       'MEDIA_CENTER',
//       'SUPER_ADMIN'
//     ];

//     if (data.user_type && !validUserTypes.includes(data.user_type)) {
//       errors.push('Invalid user type');
//     }

//     return errors;
//   }

//   // Check password strength
//   isStrongPassword(password) {
//     const minLength = 8;
//     const hasUpperCase = /[A-Z]/.test(password);
//     const hasLowerCase = /[a-z]/.test(password);
//     const hasNumbers = /\d/.test(password);
//     const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password);

//     return password.length >= minLength &&
//            hasUpperCase &&
//            hasLowerCase &&
//            hasNumbers &&
//            hasSpecialChar;
//   }

//   // Hash password
//   async hashPassword(password) {
//     const saltRounds = 12;
//     return await bcrypt.hash(password, saltRounds);
//   }

//   // Verify password
//   async verifyPassword(plainPassword, hashedPassword) {
//     return await bcrypt.compare(plainPassword, hashedPassword);
//   }

//   // Generate MFA secret
//   generateMFASecret() {
//     return crypto.randomBytes(20).toString('base64');
//   }

//   // Generate backup codes
//   generateBackupCodes(count = 10) {
//     const codes = [];
//     for (let i = 0; i < count; i++) {
//       codes.push(crypto.randomBytes(4).toString('hex').toUpperCase());
//     }
//     return codes;
//   }

//   // Find by email
//   async findByEmail(email) {
//     const sql = `
//       SELECT * FROM users
//       WHERE email = ?
//       AND deleted_at IS NULL
//     `;

//     const results = await this.executeQuery(sql, [email]);
//     return results.length > 0 ? results[0] : null;
//   }

//   // Find by phone
//   async findByPhone(phone) {
//     const sql = `
//       SELECT * FROM users
//       WHERE phone_number = ?
//       AND deleted_at IS NULL
//     `;

//     const results = await this.executeQuery(sql, [phone]);
//     return results.length > 0 ? results[0] : null;
//   }

//   // Create user with password hashing
//   async createWithPassword(data) {
//     const errors = this.validate(data, false);
//     if (errors.length > 0) {
//       throw new Error(`Validation failed: ${errors.join(', ')}`);
//     }

//     // Check for duplicate email
//     const existingEmail = await this.findByEmail(data.email);
//     if (existingEmail) {
//       throw new Error('User with this email already exists');
//     }

//     // Check for duplicate phone
//     if (data.phone_number) {
//       const existingPhone = await this.findByPhone(data.phone_number);
//       if (existingPhone) {
//         throw new Error('User with this phone number already exists');
//       }
//     }

//     // Hash password
//     const hashedPassword = await this.hashPassword(data.password);

//     const userData = {
//       ...data,
//       password: hashedPassword,
//       password_changed_at: this.formatDate(new Date())
//     };

//     return await this.create(userData);
//   }

//   // Update user with validation
//   async updateWithValidation(id, data) {
//     const errors = this.validate(data, true);
//     if (errors.length > 0) {
//       throw new Error(`Validation failed: ${errors.join(', ')}`);
//     }

//     // Check for duplicate email (excluding current user)
//     if (data.email) {
//       const existingEmail = await this.findByEmail(data.email);
//       if (existingEmail && existingEmail.id !== id) {
//         throw new Error('Another user with this email already exists');
//       }
//     }

//     // Check for duplicate phone (excluding current user)
//     if (data.phone_number) {
//       const existingPhone = await this.findByPhone(data.phone_number);
//       if (existingPhone && existingPhone.id !== id) {
//         throw new Error('Another user with this phone number already exists');
//       }
//     }

//     // Handle password change
//     if (data.password) {
//       data.password = await this.hashPassword(data.password);
//       data.password_changed_at = this.formatDate(new Date());
//     }

//     return await this.update(id, data);
//   }

//   async create(data = {}) {
//     const sql = `
//       INSERT INTO users(email, password) VALUES (?, ?);
//     `;

//     const results = await this.executeQuery(sql, [data.email, data.password]);
//     return results.length > 0 ? results[0] : null;
//   }

//   // Authenticate user
//   async authenticate(email, password) {
//     const user = await this.findByEmail(email);
//     if (!user) {
//       return { success: false, error: 'User not found' };
//     }

//     // Check if account is active
//     if (user.status !== 'ACTIVE') {
//       return {
//         success: false,
//         error: `Account is ${user.status.toLowerCase().replace('_', ' ')}`
//       };
//     }

//     // Check if account is locked
//     if (user.locked_until && new Date(user.locked_until) > new Date()) {
//       return {
//         success: false,
//         error: 'Account is temporarily locked'
//       };
//     }

//     // Verify password
//     const passwordValid = await this.verifyPassword(password, user.password);
//     if (!passwordValid) {
//       // Record failed attempt
//       await this.recordFailedLogin(user.id);
//       return { success: false, error: 'Invalid password' };
//     }

//     // Reset failed attempts on successful login
//     await this.resetFailedAttempts(user.id);

//     // Update last login
//     await this.updateLastLogin(user.id);

//     return {
//       success: true,
//       user: this.sanitizeUser(user),
//       requiresMFA: user.mfa_enabled
//     };
//   }

//   // Record failed login attempt
//   async recordFailedLogin(userId) {
//     const user = await this.findById(userId);
//     if (!user) return;

//     const failedAttempts = (user.failed_login_attempts || 0) + 1;
//     let lockedUntil = null;

//     // Lock account after 5 failed attempts for 15 minutes
//     if (failedAttempts >= 5) {
//       const lockTime = new Date();
//       lockTime.setMinutes(lockTime.getMinutes() + 15);
//       lockedUntil = this.formatDate(lockTime);
//     }

//     await this.update(userId, {
//       failed_login_attempts: failedAttempts,
//       locked_until: lockedUntil
//     });
//   }

//   // Reset failed login attempts
//   async resetFailedAttempts(userId) {
//     await this.update(userId, {
//       failed_login_attempts: 0,
//       locked_until: null
//     });
//   }

//   // Update last login
//   async updateLastLogin(userId, ipAddress = null) {
//     const updateData = {
//       last_login_at: this.formatDate(new Date()),
//       last_activity_at: this.formatDate(new Date()),
//       login_count: await this.incrementLoginCount(userId)
//     };

//     if (ipAddress) {
//       updateData.last_login_ip = ipAddress;
//     }

//     await this.update(userId, updateData);
//   }

//   // Increment login count
//   async incrementLoginCount(userId) {
//     const user = await this.findById(userId);
//     return (user.login_count || 0) + 1;
//   }

//   // Enable MFA
//   async enableMFA(userId) {
//     const mfaSecret = this.generateMFASecret();
//     const backupCodes = this.generateBackupCodes();

//     await this.update(userId, {
//       mfa_enabled: true,
//       mfa_secret: mfaSecret,
//       mfa_backup_codes: this.stringifyJSON(backupCodes),
//       mfa_enabled_at: this.formatDate(new Date())
//     });

//     return { mfaSecret, backupCodes };
//   }

//   // Disable MFA
//   async disableMFA(userId) {
//     await this.update(userId, {
//       mfa_enabled: false,
//       mfa_secret: null,
//       mfa_backup_codes: null,
//       mfa_enabled_at: null
//     });
//   }

//   // Verify MFA code
//   verifyMFACode(userSecret, code) {
//     // Implementation would use TOTP library like 'otplib'
//     // For now, return a placeholder
//     return true;
//   }

//   // Sanitize user object (remove sensitive data)
//   sanitizeUser(user) {
//     const sanitized = { ...user };
//     delete sanitized.password;
//     delete sanitized.mfa_secret;
//     delete sanitized.mfa_backup_codes;
//     delete sanitized.last_login_ip;
//     return sanitized;
//   }

//   // Get user permissions
//   async getPermissions(userId) {
//     const user = await this.findById(userId);
//     if (!user) {
//       throw new Error('User not found');
//     }

//     // This would integrate with the AccessControlMatrix model
//     // For now, return basic permissions based on user_type
//     const permissions = {
//       canViewDonations: ['FAMILY_MEMBER', 'BOARD_MEMBER', 'EXECUTIVE', 'FINANCE_MANAGER', 'SUPER_ADMIN'].includes(user.user_type),
//       canManageDonations: ['EXECUTIVE', 'FINANCE_MANAGER', 'SUPER_ADMIN'].includes(user.user_type),
//       canViewArchive: ['FAMILY_MEMBER', 'BOARD_MEMBER', 'EXECUTIVE', 'SUPER_ADMIN'].includes(user.user_type),
//       canManageArchive: ['EXECUTIVE', 'SUPER_ADMIN'].includes(user.user_type),
//       canManageUsers: ['SUPER_ADMIN'].includes(user.user_type),
//       user_type: user.user_type
//     };

//     return permissions;
//   }

//   // Get user statistics
//   async getUserStatistics(userId) {
//     const sql = `
//       SELECT
//         login_count,
//         total_donations,
//         donation_count,
//         last_donation_at,
//         last_login_at,
//         last_activity_at,
//         failed_login_attempts,
//         DATE(created_at) as join_date,
//         DATEDIFF(NOW(), created_at) as days_since_join
//       FROM users
//       WHERE id = ?
//       AND deleted_at IS NULL
//     `;

//     const results = await this.executeQuery(sql, [userId]);
//     return results[0] || {};
//   }

//   // Change password
//   async changePassword(userId, currentPassword, newPassword) {
//     const user = await this.findById(userId);
//     if (!user) {
//       throw new Error('User not found');
//     }

//     // Verify current password
//     const valid = await this.verifyPassword(currentPassword, user.password);
//     if (!valid) {
//       throw new Error('Current password is incorrect');
//     }

//     // Validate new password
//     if (!this.isStrongPassword(newPassword)) {
//       throw new Error('New password does not meet security requirements');
//     }

//     // Update password
//     const hashedPassword = await this.hashPassword(newPassword);

//     await this.update(userId, {
//       password: hashedPassword,
//       password_changed_at: this.formatDate(new Date())
//     });

//     return true;
//   }

//   // Search users
//   async searchUsers(query, options = {}) {
//     const { page = 1, limit = 20, user_type = null } = options;

//     let sql = `
//       SELECT
//         u.id,
//         u.email,
//         u.phone_number,
//         u.user_type,
//         u.status,
//         u.created_at,
//         p.full_name_arabic,
//         p.full_name_english
//       FROM users u
//       LEFT JOIN persons p ON u.person_id = p.person_id AND p.deleted_at IS NULL
//       WHERE u.deleted_at IS NULL
//       AND (
//         u.email LIKE ?
//         OR u.phone_number LIKE ?
//         OR p.full_name_arabic LIKE ?
//         OR p.full_name_english LIKE ?
//       )
//     `;

//     const params = [
//       `%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`
//     ];

//     if (user_type) {
//       sql += ' AND u.user_type = ?';
//       params.push(user_type);
//     }

//     sql += ' ORDER BY u.created_at DESC LIMIT ? OFFSET ?';
//     params.push(limit, (page - 1) * limit);

//     return await this.executeQuery(sql, params);
//   }
// }

// export default User;
