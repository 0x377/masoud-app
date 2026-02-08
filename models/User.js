import BaseModel from "../libs/BaseModel.js";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import validator from "validator";
import db from "../database/database.js";

class User extends BaseModel {
  constructor() {
    super("users", "id");
    this.jsonFields = [
      "additional_roles",
      "permissions_override",
      "preferences",
      "notification_settings",
      "metadata",
      "family_info",
      "education_info",
      "work_info",
      "additional_info",
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

    // National ID validation (Saudi ID - 10 digits + optional 4 digits for non-citizens)
    if (data.national_id && !/^\d{10}(\d{4})?$/.test(data.national_id)) {
      errors.push("Invalid national ID format (10 or 14 digits required)");
    }

    // Gender validation
    if (data.gender && !["M", "F"].includes(data.gender)) {
      errors.push("Gender must be 'M' or 'F'");
    }

    // Marital status validation
    const validMaritalStatuses = ["single", "married", "divorced", "widowed"];
    if (
      data.marital_status &&
      !validMaritalStatuses.includes(data.marital_status)
    ) {
      errors.push("Invalid marital status");
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

    // Birth date validation (cannot be in future)
    if (data.birth_date) {
      const birthDate = new Date(data.birth_date);
      const today = new Date();
      if (birthDate > today) {
        errors.push("Birth date cannot be in the future");
      }
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

  /**
   * Find a single user matching the criteria
   * @param {Object} where - WHERE conditions (supports both simple and Sequelize-style)
   * @param {Object} options - Additional options
   * @returns {Promise<Object|null>} - User object or null if not found
   */
  async findOne(where = {}, options = {}) {
    try {
      const {
        includeDeleted = false,
        includeFamily = false,
        selectFields = ["*"],
        orderBy = "created_at",
        orderDirection = "DESC",
        strictMode = true,
        caseSensitive = false,
      } = options;

      // Handle Sequelize-style syntax
      let whereConditions = where;
      if (where.where && typeof where.where === "object") {
        whereConditions = where.where;
      }

      // Build WHERE clause
      let whereClause = "WHERE 1=1";
      const params = [];

      // Process WHERE conditions
      Object.entries(whereConditions).forEach(([key, value]) => {
        if (value === undefined || value === null) {
          return;
        }

        // Handle operators
        if (typeof value === "object" && !Array.isArray(value)) {
          Object.entries(value).forEach(([operator, operatorValue]) => {
            switch (operator) {
              case "$ne":
                whereClause += ` AND ${key} != ?`;
                params.push(operatorValue);
                break;
              case "$like":
                whereClause += ` AND ${key} LIKE ?`;
                params.push(`%${operatorValue}%`);
                break;
              case "$in":
                if (Array.isArray(operatorValue) && operatorValue.length > 0) {
                  const placeholders = operatorValue.map(() => "?").join(", ");
                  whereClause += ` AND ${key} IN (${placeholders})`;
                  params.push(...operatorValue);
                }
                break;
              case "$nin":
                if (Array.isArray(operatorValue) && operatorValue.length > 0) {
                  const placeholders = operatorValue.map(() => "?").join(", ");
                  whereClause += ` AND ${key} NOT IN (${placeholders})`;
                  params.push(...operatorValue);
                }
                break;
              case "$gt":
                whereClause += ` AND ${key} > ?`;
                params.push(operatorValue);
                break;
              case "$gte":
                whereClause += ` AND ${key} >= ?`;
                params.push(operatorValue);
                break;
              case "$lt":
                whereClause += ` AND ${key} < ?`;
                params.push(operatorValue);
                break;
              case "$lte":
                whereClause += ` AND ${key} <= ?`;
                params.push(operatorValue);
                break;
              case "$between":
                if (
                  Array.isArray(operatorValue) &&
                  operatorValue.length === 2
                ) {
                  whereClause += ` AND ${key} BETWEEN ? AND ?`;
                  params.push(...operatorValue);
                }
                break;
              case "$isNull":
                whereClause += ` AND ${key} IS NULL`;
                break;
              case "$isNotNull":
                whereClause += ` AND ${key} IS NOT NULL`;
                break;
              default:
                whereClause += ` AND ${key} = ?`;
                params.push(operatorValue);
            }
          });
        } else {
          // Handle simple equality
          if (typeof value === "string" && !strictMode) {
            if (caseSensitive) {
              whereClause += ` AND ${key} = ?`;
            } else {
              whereClause += ` AND LOWER(${key}) = LOWER(?)`;
            }
            params.push(value);
          } else if (Array.isArray(value)) {
            if (value.length > 0) {
              const placeholders = value.map(() => "?").join(", ");
              whereClause += ` AND ${key} IN (${placeholders})`;
              params.push(...value);
            } else {
              whereClause += ` AND 1=0`;
            }
          } else {
            whereClause += ` AND ${key} = ?`;
            params.push(value);
          }
        }
      });

      if (!includeDeleted) {
        whereClause += " AND deleted_at IS NULL";
      }

      // Build SELECT clause
      let selectClause;
      if (selectFields[0] === "*") {
        selectClause = "SELECT *";
      } else {
        const validFields = selectFields.filter(
          (field) =>
            typeof field === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field),
        );
        if (validFields.length === 0) {
          selectClause = "SELECT *";
        } else {
          selectClause = `SELECT ${validFields.join(", ")}`;
        }
      }

      let fromClause = "FROM users";

      // Add family joins if requested
      if (includeFamily) {
        selectClause += `, 
          father.id as father_id,
          father.full_name_arabic as father_name_arabic,
          father.full_name_english as father_name_english,
          mother.id as mother_id,
          mother.full_name_arabic as mother_name_arabic,
          mother.full_name_english as mother_name_english,
          spouse.id as spouse_id,
          spouse.full_name_arabic as spouse_name_arabic,
          spouse.full_name_english as spouse_name_english`;

        fromClause += `
          LEFT JOIN users as father ON users.father_id = father.id AND father.deleted_at IS NULL
          LEFT JOIN users as mother ON users.mother_id = mother.id AND mother.deleted_at IS NULL
          LEFT JOIN users as spouse ON users.spouse_id = spouse.id AND spouse.deleted_at IS NULL`;
      }

      // Build ORDER BY
      const validOrderDirections = ["ASC", "DESC", "asc", "desc"];
      const safeOrderBy = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderBy)
        ? orderBy
        : "created_at";
      const safeOrderDirection = validOrderDirections.includes(orderDirection)
        ? orderDirection.toUpperCase()
        : "DESC";

      const orderClause = `ORDER BY ${safeOrderBy} ${safeOrderDirection}`;

      const sql = `
        ${selectClause}
        ${fromClause}
        ${whereClause}
        ${orderClause}
        LIMIT 1
      `;

      // Debug logging (optional)
      if (options.debug) {
        console.log("SQL Query:", sql);
        console.log("Params:", params);
      }

      const results = await db.query(sql, params);

      if (results.length === 0) {
        return null;
      }

      // Process the result
      const user = results[0];

      // Parse JSON fields automatically
      if (user) {
        this.jsonFields.forEach((field) => {
          if (user[field] && typeof user[field] === "string") {
            try {
              user[field] = JSON.parse(user[field]);
            } catch (error) {
              if (options.debug) {
                console.warn(
                  `Failed to parse JSON field "${field}":`,
                  user[field],
                );
              }
            }
          }
        });
      }

      return user;
    } catch (error) {
      console.error("Error in User.findOne:", error);

      if (error.code === "ER_NO_SUCH_TABLE") {
        throw new Error(
          `Table "users" does not exist. Please run migrations first.`,
        );
      }

      if (error.code === "ER_BAD_FIELD_ERROR") {
        throw new Error(`Invalid field in WHERE clause: ${error.message}`);
      }

      throw error;
    }
  }

  // Create user with personal information
  async createUser(data) {
    return await db.transaction(async () => {
      // Hash password
      const hashedPassword = await this.hashPassword(data.password);

      // Prepare user data
      const userData = {
        ...data,
        password: hashedPassword,
        password_changed_at: this.formatDate(new Date()),
        status: data.status || "PENDING_VERIFICATION",
        user_type: data.user_type || "FAMILY_MEMBER",
        // Set default preferences if not provided
        preferences:
          data.preferences ||
          JSON.stringify({
            theme: "light",
            language: "ar",
            notifications: true,
          }),
      };

      // Create user
      const user = await this.create(userData);
      console.log(`User created: ${JSON.stringify(user)}`);

      return user;
    });
  }

  // Convenience methods
  async findByEmail(email, options = {}) {
    return await this.findOne({ email }, options);
  }

  async findByUsername(username, options = {}) {
    return await this.findOne({ username }, options);
  }

  async findByPhone(phone_number, options = {}) {
    return await this.findOne({ phone_number }, options);
  }

  async findByNationalId(national_id, options = {}) {
    return await this.findOne({ national_id }, options);
  }

  // Authentication
  async authenticate(email, password) {
    try {
      const user = await this.findByEmail(email, { includeDeleted: false });

      if (!user) {
        return { success: false, error: "User not found" };
      }

      // Check if account is locked
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        return { success: false, error: "Account is temporarily locked" };
      }

      // Check password
      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        // Record failed attempt
        await this.recordFailedLogin(user.id);
        return { success: false, error: "Invalid password" };
      }

      // Reset failed attempts on successful login
      await this.resetFailedAttempts(user.id);

      // Remove sensitive data
      const userData = this.sanitize(user);

      return {
        success: true,
        user: userData,
        requiresMFA: user.mfa_enabled || false,
      };
    } catch (error) {
      console.error("Authentication error:", error);
      return { success: false, error: "Authentication failed" };
    }
  }

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
        id,
        national_id,
        full_name_arabic,
        full_name_english,
        email,
        phone_number,
        user_type,
        status,
        gender,
        birth_date,
        created_at,
        last_login_at,
        total_donations,
        donation_count
      FROM users
      WHERE 1=1
    `;

    const params = [];

    if (!includeDeleted) {
      sql += " AND deleted_at IS NULL";
    }

    if (query) {
      sql += ` AND (
        email LIKE ? OR 
        phone_number LIKE ? OR 
        full_name_arabic LIKE ? OR 
        full_name_english LIKE ? OR
        national_id LIKE ?
      )`;
      params.push(
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
        `%${query}%`,
      );
    }

    if (user_type) {
      sql += " AND user_type = ?";
      params.push(user_type);
    }

    if (status) {
      sql += " AND status = ?";
      params.push(status);
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const countResult = await db.query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Get data
    sql += " ORDER BY created_at DESC LIMIT ? OFFSET ?";
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
          login_count,
          total_donations,
          donation_count,
          last_donation_at,
          last_login_at,
          last_activity_at,
          created_at,
          failed_login_attempts,
          status,
          user_type,
          TIMESTAMPDIFF(DAY, created_at, NOW()) as days_since_join,
          full_name_arabic,
          full_name_english
        FROM users
        WHERE id = ?
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
      SELECT *
      FROM users
      WHERE user_type = ?
      ${!includeDeleted ? "AND deleted_at IS NULL" : ""}
      ORDER BY created_at DESC
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
    delete sanitized.remember_token;

    return sanitized;
  }

  // Verify email
  async verifyEmail(userId) {
    await this.update(userId, {
      email_verified_at: this.formatDate(new Date()),
      status: "USER_INFO",
    });
  }

  // Verify phone
  async verifyPhone(userId) {
    await this.update(userId, {
      phone_verified_at: this.formatDate(new Date()),
    });
  }

  // Check if user exists by email, phone, or national ID
  async existsByIdentifier(identifier) {
    const sql = `
      SELECT COUNT(*) as count 
      FROM users 
      WHERE (email = ? OR phone_number = ? OR national_id = ?) 
        AND deleted_at IS NULL
    `;

    const results = await db.query(sql, [identifier, identifier, identifier]);
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

  // Family relationship methods
  async getImmediateFamily(userId) {
    const user = await this.findById(userId, { includeFamily: true });
    if (!user) return null;

    const family = {
      user: this.sanitize(user),
      father: null,
      mother: null,
      spouse: null,
      children: [],
    };

    // Get father
    if (user.father_id) {
      family.father = await this.findById(user.father_id, {
        selectFields: [
          "id",
          "full_name_arabic",
          "full_name_english",
          "gender",
          "birth_date",
        ],
      });
    }

    // Get mother
    if (user.mother_id) {
      family.mother = await this.findById(user.mother_id, {
        selectFields: [
          "id",
          "full_name_arabic",
          "full_name_english",
          "gender",
          "birth_date",
        ],
      });
    }

    // Get spouse
    if (user.spouse_id) {
      family.spouse = await this.findById(user.spouse_id, {
        selectFields: [
          "id",
          "full_name_arabic",
          "full_name_english",
          "gender",
          "birth_date",
        ],
      });
    }

    // Get children
    const childrenSql = `
      SELECT id, full_name_arabic, full_name_english, gender, birth_date
      FROM users
      WHERE (father_id = ? OR mother_id = ?)
        AND deleted_at IS NULL
      ORDER BY birth_date
    `;

    const children = await db.query(childrenSql, [userId, userId]);
    family.children = children.map((child) => this.sanitize(child));

    return family;
  }

  // Update family relationships
  async updateFamilyRelationships(userId, familyData) {
    const updates = {};

    if (familyData.father_id) {
      updates.father_id = familyData.father_id;
    }

    if (familyData.mother_id) {
      updates.mother_id = familyData.mother_id;
    }

    if (familyData.spouse_id) {
      updates.spouse_id = familyData.spouse_id;
    }

    if (familyData.family_info) {
      updates.family_info = JSON.stringify(familyData.family_info);
    }

    if (Object.keys(updates).length > 0) {
      await this.update(userId, updates);
    }
  }

  // Get family tree (limited depth)
  async getFamilyTree(userId, maxDepth = 3) {
    const user = await this.findById(userId);
    if (!user) return null;

    const tree = {
      ...this.sanitize(user),
      ancestors: await this.getAncestors(userId, maxDepth),
      descendants: await this.getDescendants(userId, maxDepth),
    };

    return tree;
  }

  // Get ancestors (parents, grandparents)
  async getAncestors(userId, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];

    const user = await this.findById(userId);
    if (!user) return [];

    const ancestors = [];

    // Get father
    if (user.father_id) {
      const father = await this.findById(user.father_id, {
        selectFields: [
          "id",
          "full_name_arabic",
          "full_name_english",
          "gender",
          "birth_date",
        ],
      });
      if (father) {
        ancestors.push({
          ...this.sanitize(father),
          relationship: "father",
          depth: currentDepth,
          ancestors: await this.getAncestors(
            father.id,
            maxDepth,
            currentDepth + 1,
          ),
        });
      }
    }

    // Get mother
    if (user.mother_id) {
      const mother = await this.findById(user.mother_id, {
        selectFields: [
          "id",
          "full_name_arabic",
          "full_name_english",
          "gender",
          "birth_date",
        ],
      });
      if (mother) {
        ancestors.push({
          ...this.sanitize(mother),
          relationship: "mother",
          depth: currentDepth,
          ancestors: await this.getAncestors(
            mother.id,
            maxDepth,
            currentDepth + 1,
          ),
        });
      }
    }

    return ancestors;
  }

  // Get descendants (children, grandchildren)
  async getDescendants(userId, maxDepth, currentDepth = 0) {
    if (currentDepth >= maxDepth) return [];

    const childrenSql = `
      SELECT id, full_name_arabic, full_name_english, gender, birth_date
      FROM users
      WHERE (father_id = ? OR mother_id = ?)
        AND deleted_at IS NULL
    `;

    const children = await db.query(childrenSql, [userId, userId]);
    const descendants = [];

    for (const child of children) {
      const sanitizedChild = this.sanitize(child);
      descendants.push({
        ...sanitizedChild,
        relationship: "child",
        depth: currentDepth,
        descendants: await this.getDescendants(
          child.id,
          maxDepth,
          currentDepth + 1,
        ),
      });
    }

    return descendants;
  }
}

// Create and export a singleton instance
const userModel = new User();

export { User };
export default userModel;

// import BaseModel from "../libs/BaseModel.js";
// import bcrypt from "bcryptjs";
// import crypto from "crypto";
// import validator from "validator";
// import Person from "./Person.js";
// import db from "../database/database.js";

// class User extends BaseModel {
//   constructor() {
//     super("users", "id");
//     this.jsonFields = [
//       "additional_roles",
//       "permissions_override",
//       "preferences",
//       "notification_settings",
//       "metadata",
//     ];
//     this.passwordMinLength = 8;
//   }

//   // Validation rules
//   validate(data, isUpdate = false) {
//     const errors = [];

//     // Required fields for new users
//     if (!isUpdate) {
//       if (!data.email && !data.phone_number) {
//         errors.push("Email or phone number is required");
//       }
//       if (!data.password) {
//         errors.push("Password is required");
//       }
//     }

//     // Email validation
//     if (data.email && !validator.isEmail(data.email)) {
//       errors.push("Invalid email format");
//     }

//     // Phone validation (Saudi format)
//     if (
//       data.phone_number &&
//       !/^(009665|9665|\+9665|05|5)([0-9]{8})$/.test(data.phone_number)
//     ) {
//       errors.push("Invalid Saudi phone number format");
//     }

//     // Password strength
//     if (data.password && !this.isStrongPassword(data.password)) {
//       errors.push(
//         `Password must be at least ${this.passwordMinLength} characters with uppercase, lowercase, number, and special character`,
//       );
//     }

//     // User type validation
//     const validUserTypes = [
//       "FAMILY_MEMBER",
//       "BOARD_MEMBER",
//       "EXECUTIVE",
//       "FINANCE_MANAGER",
//       "SOCIAL_COMMITTEE",
//       "CULTURAL_COMMITTEE",
//       "RECONCILIATION_COMMITTEE",
//       "SPORTS_COMMITTEE",
//       "MEDIA_CENTER",
//       "SUPER_ADMIN",
//     ];

//     if (data.user_type && !validUserTypes.includes(data.user_type)) {
//       errors.push("Invalid user type");
//     }

//     // Status validation
//     const validStatuses = [
//       "PENDING_VERIFICATION",
//       "ACTIVE",
//       "SUSPENDED",
//       "DEACTIVATED",
//       "BANNED",
//     ];

//     if (data.status && !validStatuses.includes(data.status)) {
//       errors.push("Invalid status");
//     }

//     return errors;
//   }

//   // Check password strength
//   isStrongPassword(password) {
//     const hasUpperCase = /[A-Z]/.test(password);
//     const hasLowerCase = /[a-z]/.test(password);
//     const hasNumbers = /\d/.test(password);
//     const hasSpecialChar = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(
//       password,
//     );

//     return (
//       password.length >= this.passwordMinLength &&
//       hasUpperCase &&
//       hasLowerCase &&
//       hasNumbers &&
//       hasSpecialChar
//     );
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
//     return crypto.randomBytes(20).toString("base64");
//   }

//   // Generate backup codes
//   generateBackupCodes(count = 10) {
//     const codes = [];
//     for (let i = 0; i < count; i++) {
//       codes.push(
//         crypto.randomBytes(5).toString("hex").toUpperCase().slice(0, 8),
//       );
//     }
//     return codes;
//   }

//   /**
//    * Find a single user matching the criteria
//    * @param {Object} where - WHERE conditions (supports both simple and Sequelize-style)
//    * @param {Object} options - Additional options
//    * @returns {Promise<Object|null>} - User object or null if not found
//    */
//   async findOne(where = {}, options = {}) {
//     try {
//       const {
//         includeDeleted = false,
//         includePerson = false,
//         selectFields = ["*"],
//         orderBy = "created_at",
//         orderDirection = "DESC",
//         strictMode = true, // If true, only exact matches. If false, use LIKE for strings
//         caseSensitive = false, // If false, use LOWER() for case-insensitive search
//       } = options;

//       // Handle Sequelize-style syntax: { where: { email: 'test@example.com' } }
//       let whereConditions = where;
//       if (where.where && typeof where.where === "object") {
//         whereConditions = where.where;
//       }

//       // Build WHERE clause
//       let whereClause = "WHERE 1=1";
//       const params = [];

//       // Process WHERE conditions
//       Object.entries(whereConditions).forEach(([key, value]) => {
//         if (value === undefined || value === null) {
//           return; // Skip undefined/null values
//         }

//         // Handle operators like $ne, $like, $in, $gt, $lt, etc.
//         if (typeof value === "object" && !Array.isArray(value)) {
//           // Handle MongoDB/Sequelize-style operators
//           Object.entries(value).forEach(([operator, operatorValue]) => {
//             switch (operator) {
//               case "$ne": // Not equal
//                 whereClause += ` AND u.${key} != ?`;
//                 params.push(operatorValue);
//                 break;
//               case "$like": // LIKE operator
//                 whereClause += ` AND u.${key} LIKE ?`;
//                 params.push(`%${operatorValue}%`);
//                 break;
//               case "$in": // IN operator
//                 if (Array.isArray(operatorValue) && operatorValue.length > 0) {
//                   const placeholders = operatorValue.map(() => "?").join(", ");
//                   whereClause += ` AND u.${key} IN (${placeholders})`;
//                   params.push(...operatorValue);
//                 }
//                 break;
//               case "$nin": // NOT IN operator
//                 if (Array.isArray(operatorValue) && operatorValue.length > 0) {
//                   const placeholders = operatorValue.map(() => "?").join(", ");
//                   whereClause += ` AND u.${key} NOT IN (${placeholders})`;
//                   params.push(...operatorValue);
//                 }
//                 break;
//               case "$gt": // Greater than
//                 whereClause += ` AND u.${key} > ?`;
//                 params.push(operatorValue);
//                 break;
//               case "$gte": // Greater than or equal
//                 whereClause += ` AND u.${key} >= ?`;
//                 params.push(operatorValue);
//                 break;
//               case "$lt": // Less than
//                 whereClause += ` AND u.${key} < ?`;
//                 params.push(operatorValue);
//                 break;
//               case "$lte": // Less than or equal
//                 whereClause += ` AND u.${key} <= ?`;
//                 params.push(operatorValue);
//                 break;
//               case "$between": // BETWEEN operator
//                 if (
//                   Array.isArray(operatorValue) &&
//                   operatorValue.length === 2
//                 ) {
//                   whereClause += ` AND u.${key} BETWEEN ? AND ?`;
//                   params.push(...operatorValue);
//                 }
//                 break;
//               case "$isNull": // IS NULL
//                 whereClause += ` AND u.${key} IS NULL`;
//                 break;
//               case "$isNotNull": // IS NOT NULL
//                 whereClause += ` AND u.${key} IS NOT NULL`;
//                 break;
//               default:
//                 // Default to equality for unknown operators
//                 whereClause += ` AND u.${key} = ?`;
//                 params.push(operatorValue);
//             }
//           });
//         } else {
//           // Handle simple equality with optional case-insensitive search for strings
//           if (typeof value === "string" && !strictMode) {
//             if (caseSensitive) {
//               whereClause += ` AND u.${key} = ?`;
//             } else {
//               whereClause += ` AND LOWER(u.${key}) = LOWER(?)`;
//             }
//             params.push(value);
//           } else if (Array.isArray(value)) {
//             // Handle array values with IN operator
//             if (value.length > 0) {
//               const placeholders = value.map(() => "?").join(", ");
//               whereClause += ` AND u.${key} IN (${placeholders})`;
//               params.push(...value);
//             } else {
//               whereClause += ` AND 1=0`; // Empty array should return no results
//             }
//           } else {
//             // Simple equality for other types
//             whereClause += ` AND u.${key} = ?`;
//             params.push(value);
//           }
//         }
//       });

//       if (!includeDeleted) {
//         whereClause += " AND u.deleted_at IS NULL";
//       }

//       // Build SELECT clause with specific fields
//       let selectClause;
//       if (selectFields[0] === "*") {
//         selectClause = "SELECT u.*";
//       } else {
//         // Validate and sanitize field names
//         const validFields = selectFields.filter(
//           (field) =>
//             typeof field === "string" && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(field),
//         );
//         if (validFields.length === 0) {
//           selectClause = "SELECT u.*";
//         } else {
//           selectClause = `SELECT ${validFields.map((field) => `u.${field}`).join(", ")}`;
//         }
//       }

//       let fromClause = "FROM users u";

//       if (includePerson) {
//         selectClause += ", p.*";
//         fromClause +=
//           " LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL";
//       }

//       // Build ORDER BY with validation
//       const validOrderDirections = ["ASC", "DESC", "asc", "desc"];
//       const safeOrderBy = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(orderBy)
//         ? orderBy
//         : "created_at";
//       const safeOrderDirection = validOrderDirections.includes(orderDirection)
//         ? orderDirection.toUpperCase()
//         : "DESC";

//       const orderClause = `ORDER BY u.${safeOrderBy} ${safeOrderDirection}`;

//       const sql = `
//         ${selectClause}
//         ${fromClause}
//         ${whereClause}
//         ${orderClause}
//         LIMIT 1
//       `;

//       // Debug logging (optional)
//       if (options.debug) {
//         console.log("SQL Query:", sql);
//         console.log("Params:", params);
//       }

//       const results = await db.query(sql, params);

//       if (results.length === 0) {
//         return null;
//       }

//       // Process the result
//       const user = results[0];

//       // Parse JSON fields automatically
//       if (user) {
//         this.jsonFields.forEach((field) => {
//           if (user[field] && typeof user[field] === "string") {
//             try {
//               user[field] = JSON.parse(user[field]);
//             } catch (error) {
//               if (options.debug) {
//                 console.warn(
//                   `Failed to parse JSON field "${field}":`,
//                   user[field],
//                 );
//               }
//               // Keep as string if parsing fails
//             }
//           }
//         });
//       }

//       return user;
//     } catch (error) {
//       console.error("Error in User.findOne:", error);

//       // Provide more specific error messages
//       if (error.code === "ER_NO_SUCH_TABLE") {
//         throw new Error(
//           `Table "users" does not exist. Please run migrations first.`,
//         );
//       }

//       if (error.code === "ER_BAD_FIELD_ERROR") {
//         throw new Error(`Invalid field in WHERE clause: ${error.message}`);
//       }

//       throw error;
//     }
//   }

//   async createUserWithPerson(userData, personData = {}) {
//     return await db.transaction(async (connection) => {
//       // Create person first using the transaction connection
//       const personModel = new Person();

//       // Pass the transaction connection to the createPerson method
//       // OR use connection.query directly
//       const person = await personModel.createPerson(
//         {
//           ...personData,
//           email: userData.email,
//           phone_number: userData.phone_number,
//         },
//         connection,
//       ); // Pass connection to ensure it's within transaction

//       // Create user with person_id
//       const hashedPassword = await this.hashPassword(userData.password);

//       const user = await this.create(
//         {
//           ...userData,
//           person_id: person.id,
//           password: hashedPassword,
//           password_changed_at: this.formatDate(new Date()),
//           status: userData.status || "PENDING_VERIFICATION",
//           user_type: userData.user_type || "FAMILY_MEMBER",
//         },
//         connection,
//       ); // Pass connection to ensure it's within transaction

//       console.log(`Person is created ${JSON.stringify(person)}`);
//       console.log(`User is created ${JSON.stringify(user)}`);

//       return { user, person };
//     });
//   }

//   // // In User.js, update createUserWithPerson method:
//   // async createUserWithPerson(userData, personData = {}) {
//   //   return await db.transaction(async () => {
//   //     // Remove connection parameter
//   //     // Create person first
//   //     const personModel = new Person();

//   //     // Use regular query instead of connection.query
//   //     const person = await personModel.createPerson({
//   //       ...personData,
//   //       email: userData.email,
//   //       phone_number: userData.phone_number,
//   //     });

//   //     // Create user with person_id
//   //     const hashedPassword = await this.hashPassword(userData.password);

//   //     const user = await this.create({
//   //       ...userData,
//   //       person_id: person.id,
//   //       password: hashedPassword,
//   //       password_changed_at: this.formatDate(new Date()),
//   //       status: userData.status || "PENDING_VERIFICATION",
//   //       user_type: userData.user_type || "FAMILY_MEMBER",
//   //     });
//   //     console.log(`Person is created ${person}`);
//   //     console.log(`User is created ${user}`);

//   //     return { user, person };
//   //   });
//   // }

//   // Convenience methods
//   async findByEmail(email, options = {}) {
//     return await this.findOne({ email }, options);
//   }

//   async findByUsername(username, options = {}) {
//     return await this.findOne({ username }, options);
//   }

//   async findByPhone(phone_number, options = {}) {
//     return await this.findOne({ phone_number }, options);
//   }

//   async authenticate(email, password) {
//     try {
//       const user = await this.findByEmail(email, { includeDeleted: false });

//       if (!user) {
//         return { success: false, error: "User not found" };
//       }

//       // Check password
//       const isPasswordValid = await bcrypt.compare(password, user.password);

//       if (!isPasswordValid) {
//         return { success: false, error: "Invalid password" };
//       }

//       // Remove sensitive data
//       const userData = { ...user };
//       delete userData.password;
//       delete userData.mfa_secret;
//       delete userData.mfa_backup_codes;

//       return {
//         success: true,
//         user: userData,
//         requiresMFA: user.mfa_enabled || false,
//       };
//     } catch (error) {
//       console.error("Authentication error:", error);
//       return { success: false, error: "Authentication failed" };
//     }
//   }

//   // Record failed login attempt
//   async recordFailedLogin(userId) {
//     const user = await this.findById(userId);
//     if (!user) return;

//     const failedAttempts = (user.failed_login_attempts || 0) + 1;
//     let lockedUntil = null;
//     let newStatus = user.status;

//     // Lock account after 5 failed attempts for 30 minutes
//     if (failedAttempts >= 5) {
//       const lockTime = new Date();
//       lockTime.setMinutes(lockTime.getMinutes() + 30);
//       lockedUntil = this.formatDate(lockTime);
//       newStatus = "SUSPENDED";
//     }

//     await this.update(userId, {
//       failed_login_attempts: failedAttempts,
//       locked_until: lockedUntil,
//       status: newStatus,
//       last_activity_at: this.formatDate(new Date()),
//     });
//   }

//   // Reset failed login attempts
//   async resetFailedAttempts(userId) {
//     await this.update(userId, {
//       failed_login_attempts: 0,
//       locked_until: null,
//       last_activity_at: this.formatDate(new Date()),
//     });
//   }

//   // Update login information
//   async updateLoginInfo(userId, ipAddress = null) {
//     const updateData = {
//       last_login_at: this.formatDate(new Date()),
//       last_activity_at: this.formatDate(new Date()),
//       login_count: await this.incrementLoginCount(userId),
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
//       mfa_backup_codes: JSON.stringify(backupCodes),
//       mfa_enabled_at: this.formatDate(new Date()),
//     });

//     return { mfaSecret, backupCodes };
//   }

//   // Disable MFA
//   async disableMFA(userId) {
//     await this.update(userId, {
//       mfa_enabled: false,
//       mfa_secret: null,
//       mfa_backup_codes: null,
//       mfa_enabled_at: null,
//       last_mfa_used_at: null,
//     });
//   }

//   // Verify MFA code
//   async verifyMFA(userId, code) {
//     const user = await this.findById(userId);
//     if (!user) {
//       throw new Error("User not found");
//     }

//     if (!user.mfa_enabled || !user.mfa_secret) {
//       throw new Error("MFA not enabled for this user");
//     }

//     // TODO: Implement TOTP verification with library like 'otplib'
//     // For now, simple verification with backup codes
//     const backupCodes = user.mfa_backup_codes || [];

//     if (backupCodes.includes(code)) {
//       // Remove used backup code
//       const updatedCodes = backupCodes.filter((c) => c !== code);

//       await this.update(userId, {
//         mfa_backup_codes: JSON.stringify(updatedCodes),
//         last_mfa_used_at: this.formatDate(new Date()),
//       });

//       return { success: true, isBackupCode: true };
//     }

//     // TODO: Verify TOTP code with mfa_secret
//     const isValidTOTP = true; // Placeholder

//     if (isValidTOTP) {
//       await this.update(userId, {
//         last_mfa_used_at: this.formatDate(new Date()),
//       });
//     }

//     return { success: isValidTOTP, isBackupCode: false };
//   }

//   // Change password
//   async changePassword(userId, currentPassword, newPassword) {
//     const user = await this.findById(userId);
//     if (!user) {
//       throw new Error("User not found");
//     }

//     // Verify current password
//     const isValid = await this.verifyPassword(currentPassword, user.password);
//     if (!isValid) {
//       throw new Error("Current password is incorrect");
//     }

//     // Validate new password
//     if (!this.isStrongPassword(newPassword)) {
//       throw new Error("New password does not meet security requirements");
//     }

//     // Update password
//     const hashedPassword = await this.hashPassword(newPassword);

//     await this.update(userId, {
//       password: hashedPassword,
//       password_changed_at: this.formatDate(new Date()),
//     });

//     return true;
//   }

//   // Update user status
//   async updateStatus(userId, status, reason = "", updatedBy = null) {
//     const validStatuses = [
//       "PENDING_VERIFICATION",
//       "ACTIVE",
//       "SUSPENDED",
//       "DEACTIVATED",
//       "BANNED",
//     ];

//     if (!validStatuses.includes(status)) {
//       throw new Error("Invalid status");
//     }

//     const updateData = {
//       status,
//       last_activity_at: this.formatDate(new Date()),
//     };

//     if (status === "SUSPENDED") {
//       updateData.suspended_at = this.formatDate(new Date());
//       updateData.suspended_by = updatedBy;
//       updateData.suspension_reason = reason;
//     }

//     return await this.update(userId, updateData);
//   }

//   // Get user permissions
//   async getPermissions(userId) {
//     const user = await this.findById(userId);
//     if (!user) {
//       throw new Error("User not found");
//     }

//     const basePermissions = this.getBasePermissions(user.user_type);
//     const overridePermissions = user.permissions_override || {};

//     // Merge base permissions with overrides
//     const permissions = { ...basePermissions };

//     Object.entries(overridePermissions).forEach(([key, value]) => {
//       if (value === false) {
//         delete permissions[key];
//       } else {
//         permissions[key] = value;
//       }
//     });

//     return permissions;
//   }

//   // Base permissions by user type
//   getBasePermissions(userType) {
//     const permissionTemplates = {
//       FAMILY_MEMBER: {
//         view_profile: true,
//         edit_own_profile: true,
//         view_family_tree: true,
//         view_events: true,
//         register_events: true,
//         view_donations: true,
//         make_donations: true,
//         view_announcements: true,
//       },
//       BOARD_MEMBER: {
//         ...this.getBasePermissions("FAMILY_MEMBER"),
//         view_all_profiles: true,
//         manage_events: true,
//         view_financial_reports: true,
//         manage_announcements: true,
//       },
//       EXECUTIVE: {
//         ...this.getBasePermissions("BOARD_MEMBER"),
//         manage_users: true,
//         manage_committees: true,
//         approve_financial_transactions: true,
//         access_analytics: true,
//       },
//       FINANCE_MANAGER: {
//         ...this.getBasePermissions("BOARD_MEMBER"),
//         manage_donations: true,
//         manage_invoices: true,
//         generate_financial_reports: true,
//         approve_payments: true,
//       },
//       SUPER_ADMIN: {
//         all: true,
//       },
//     };

//     return (
//       permissionTemplates[userType] || permissionTemplates["FAMILY_MEMBER"]
//     );
//   }

//   // Search users
//   async searchUsers(query, options = {}) {
//     const {
//       page = 1,
//       limit = 20,
//       user_type = null,
//       status = null,
//       includeDeleted = false,
//     } = options;

//     const offset = (page - 1) * limit;
//     let sql = `
//       SELECT
//         u.id,
//         u.email,
//         u.phone_number,
//         u.user_type,
//         u.status,
//         u.created_at,
//         u.last_login_at,
//         p.full_name_arabic,
//         p.full_name_english,
//         p.gender,
//         p.birth_date
//       FROM users u
//       LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL
//       WHERE 1=1
//     `;

//     const params = [];

//     if (!includeDeleted) {
//       sql += " AND u.deleted_at IS NULL";
//     }

//     if (query) {
//       sql +=
//         " AND (u.email LIKE ? OR u.phone_number LIKE ? OR p.full_name_arabic LIKE ? OR p.full_name_english LIKE ?)";
//       params.push(`%${query}%`, `%${query}%`, `%${query}%`, `%${query}%`);
//     }

//     if (user_type) {
//       sql += " AND u.user_type = ?";
//       params.push(user_type);
//     }

//     if (status) {
//       sql += " AND u.status = ?";
//       params.push(status);
//     }

//     // Count total
//     const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
//     const countResult = await db.query(countSql, params);
//     const total = countResult[0]?.total || 0;

//     // Get data
//     sql += " ORDER BY u.created_at DESC LIMIT ? OFFSET ?";
//     params.push(limit, offset);

//     const data = await db.query(sql, params);

//     return {
//       data,
//       pagination: {
//         total,
//         page,
//         limit,
//         totalPages: Math.ceil(total / limit),
//         hasNext: page < Math.ceil(total / limit),
//         hasPrevious: page > 1,
//       },
//     };
//   }

//   // Get user statistics
//   async getUserStatistics(userId = null) {
//     let sql = "";
//     const params = [];

//     if (userId) {
//       // Individual user statistics
//       sql = `
//         SELECT
//           u.login_count,
//           u.total_donations,
//           u.donation_count,
//           u.last_donation_at,
//           u.last_login_at,
//           u.last_activity_at,
//           u.created_at,
//           u.failed_login_attempts,
//           u.status,
//           u.user_type,
//           TIMESTAMPDIFF(DAY, u.created_at, NOW()) as days_since_join,
//           p.full_name_arabic,
//           p.full_name_english
//         FROM users u
//         LEFT JOIN persons p ON u.person_id = p.id
//         WHERE u.id = ?
//       `;
//       params.push(userId);
//     } else {
//       // System-wide statistics
//       sql = `
//         SELECT
//           COUNT(*) as total_users,
//           SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) as active_users,
//           SUM(CASE WHEN status = 'PENDING_VERIFICATION' THEN 1 ELSE 0 END) as pending_users,
//           SUM(CASE WHEN status = 'SUSPENDED' THEN 1 ELSE 0 END) as suspended_users,
//           SUM(CASE WHEN status = 'DEACTIVATED' THEN 1 ELSE 0 END) as deactivated_users,
//           SUM(CASE WHEN status = 'BANNED' THEN 1 ELSE 0 END) as banned_users,
//           SUM(CASE WHEN mfa_enabled = 1 THEN 1 ELSE 0 END) as mfa_enabled_users,
//           AVG(login_count) as avg_login_count,
//           SUM(total_donations) as total_donations_amount,
//           SUM(donation_count) as total_donations_count,
//           MAX(last_login_at) as most_recent_login,
//           MIN(created_at) as oldest_account,
//           MAX(created_at) as newest_account
//         FROM users
//         WHERE deleted_at IS NULL
//       `;
//     }

//     const results = await db.query(sql, params);
//     return userId ? results[0] : results[0];
//   }

//   // Get users by type
//   async getUsersByType(userType, options = {}) {
//     const { page = 1, limit = 20, includeDeleted = false } = options;

//     const sql = `
//       SELECT u.*, p.full_name_arabic, p.full_name_english
//       FROM users u
//       LEFT JOIN persons p ON u.person_id = p.id AND p.deleted_at IS NULL
//       WHERE u.user_type = ?
//       ${!includeDeleted ? "AND u.deleted_at IS NULL" : ""}
//       ORDER BY u.created_at DESC
//       LIMIT ? OFFSET ?
//     `;

//     const offset = (page - 1) * limit;
//     const results = await db.query(sql, [userType, limit, offset]);

//     return results.map((record) =>
//       this.parseJSONFields(record, this.jsonFields),
//     );
//   }

//   // Sanitize user object (remove sensitive data)
//   sanitize(user) {
//     const sanitized = { ...user };

//     // Remove sensitive fields
//     delete sanitized.password;
//     delete sanitized.mfa_secret;
//     delete sanitized.mfa_backup_codes;
//     delete sanitized.last_login_ip;
//     delete sanitized.current_session_id;

//     return sanitized;
//   }

//   // Verify email
//   async verifyEmail(userId) {
//     await this.update(userId, {
//       email_verified_at: this.formatDate(new Date()),
//       status: "ACTIVE",
//     });
//   }

//   // Verify phone
//   async verifyPhone(userId) {
//     await this.update(userId, {
//       phone_verified_at: this.formatDate(new Date()),
//     });
//   }

//   // Check if user exists by email or phone
//   async existsByIdentifier(identifier) {
//     const sql = `
//       SELECT COUNT(*) as count
//       FROM users
//       WHERE (email = ? OR phone_number = ?)
//         AND deleted_at IS NULL
//     `;

//     const results = await db.query(sql, [identifier, identifier]);
//     return results[0]?.count > 0;
//   }

//   // Bulk update users
//   async bulkUpdate(userIds, updates) {
//     if (!Array.isArray(userIds) || userIds.length === 0) {
//       throw new Error("User IDs array is required");
//     }

//     const placeholders = userIds.map(() => "?").join(",");
//     const sql = `
//       UPDATE users
//       SET ${Object.keys(updates)
//         .map((key) => `${key} = ?`)
//         .join(", ")},
//           updated_at = ?
//       WHERE id IN (${placeholders})
//       AND deleted_at IS NULL
//     `;

//     const params = [
//       ...Object.values(updates),
//       this.formatDate(new Date()),
//       ...userIds,
//     ];

//     await db.query(sql, params);
//     return true;
//   }
// }

// // Create and export a singleton instance
// const userModel = new User();

// export { User };
// export default userModel;
