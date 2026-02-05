import BaseModel from '../../libs/BaseModel.js';
import crypto from "crypto";

class Donation extends BaseModel {
  constructor() {
    super("donations", "donation_id");
    this.jsonFields = ["metadata"];
    this.encryptedFields = ["donor_email", "donor_phone", "bank_reference"];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.campaign_id) {
        errors.push("Campaign ID is required");
      }
      if (!data.amount || data.amount <= 0) {
        errors.push("Valid amount is required");
      }
      if (!data.donation_method) {
        errors.push("Donation method is required");
      }
    }

    // Amount validation
    if (data.amount !== undefined) {
      if (data.amount <= 0) {
        errors.push("Amount must be greater than 0");
      }
      if (data.amount > 9999999999999.99) {
        errors.push("Amount is too large");
      }
    }

    // Currency validation
    const validCurrencies = ["SAR", "USD", "EUR", "GBP"];
    if (data.currency && !validCurrencies.includes(data.currency)) {
      errors.push(
        `Invalid currency. Must be one of: ${validCurrencies.join(", ")}`,
      );
    }

    // Method validation
    const validMethods = [
      "BANK_TRANSFER",
      "CREDIT_CARD",
      "PAYPAL",
      "APPLE_PAY",
      "CASH",
    ];
    if (data.donation_method && !validMethods.includes(data.donation_method)) {
      errors.push(
        `Invalid donation method. Must be one of: ${validMethods.join(", ")}`,
      );
    }

    // Status validation
    const validStatuses = [
      "PENDING",
      "COMPLETED",
      "FAILED",
      "REFUNDED",
      "CANCELLED",
    ];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    // Email validation for anonymous donations
    if (
      data.is_anonymous &&
      data.donor_email &&
      !this.isValidEmail(data.donor_email)
    ) {
      errors.push("Invalid email format for anonymous donation");
    }

    return errors;
  }

  // Email validation
  isValidEmail(email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  // Generate transaction ID
  generateTransactionId() {
    const timestamp = Date.now();
    const random = crypto.randomBytes(4).toString("hex").toUpperCase();
    return `DON-${timestamp}-${random}`;
  }

  // Create donation with validation
  async createDonation(data, userId = null) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    // Check campaign exists and is active
    const campaignSql = `
      SELECT * FROM donation_campaigns 
      WHERE campaign_id = ? 
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
      AND (end_date IS NULL OR end_date >= CURDATE())
    `;

    const [campaign] = await this.executeQuery(campaignSql, [data.campaign_id]);
    if (!campaign) {
      throw new Error("Campaign not found or not active");
    }

    // Check if campaign is accessible
    if (campaign.visibility === "PRIVATE" && !userId) {
      throw new Error("This campaign is private and requires authentication");
    }

    if (campaign.visibility === "FAMILY_ONLY" && !userId) {
      throw new Error("This campaign is for family members only");
    }

    // Generate transaction ID
    const transactionId = data.transaction_id || this.generateTransactionId();

    const donationData = {
      ...data,
      donor_id: userId,
      transaction_id: transactionId,
      currency: data.currency || "SAR",
      status: data.status || "PENDING",
    };

    // Remove donor info if anonymous
    if (donationData.is_anonymous && !donationData.donor_name) {
      donationData.donor_name = "Anonymous";
    }

    return await this.create(donationData);
  }

  // Update donation status
  async updateDonationStatus(id, status, adminId = null) {
    const donation = await this.findById(id);
    if (!donation) {
      throw new Error("Donation not found");
    }

    const updateData = { status };

    // Handle completed status
    if (status === "COMPLETED" && donation.status !== "COMPLETED") {
      updateData.completed_at = this.formatDate(new Date());

      // Update donor statistics in users table
      if (donation.donor_id) {
        const updateDonorSql = `
          UPDATE users 
          SET 
            total_donations = total_donations + ?,
            donation_count = donation_count + 1,
            last_donation_at = ?
          WHERE id = ?
        `;

        await this.executeQuery(updateDonorSql, [
          donation.amount,
          this.formatDate(new Date()),
          donation.donor_id,
        ]);
      }
    }

    // Handle refund
    if (status === "REFUNDED") {
      updateData.refunded_at = this.formatDate(new Date());
      if (adminId) {
        updateData.refunded_by = adminId;
      }
    }

    return await this.update(id, updateData);
  }

  // Get donation with details
  async getDonationWithDetails(id) {
    const donation = await this.findById(id);
    if (!donation) {
      throw new Error("Donation not found");
    }

    // Get campaign details
    const campaignSql = `
      SELECT 
        dc.*,
        cat.name_arabic as category_name_arabic,
        cat.name_english as category_name_english
      FROM donation_campaigns dc
      LEFT JOIN donation_categories cat ON dc.category_id = cat.category_id
      WHERE dc.campaign_id = ?
      AND dc.deleted_at IS NULL
    `;

    const [campaign] = await this.executeQuery(campaignSql, [
      donation.campaign_id,
    ]);

    // Get donor details if not anonymous
    let donor = null;
    if (donation.donor_id && !donation.is_anonymous) {
      const donorSql = `
        SELECT 
          u.id,
          u.email,
          u.phone_number,
          u.user_type,
          p.full_name_arabic,
          p.full_name_english
        FROM users u
        LEFT JOIN persons p ON u.person_id = p.id
        WHERE u.id = ?
        AND u.deleted_at IS NULL
      `;

      [donor] = await this.executeQuery(donorSql, [donation.donor_id]);
    }

    // Get receipt if exists
    const receiptSql = `
      SELECT * FROM donation_receipts
      WHERE donation_id = ?
      AND deleted_at IS NULL
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const [receipt] = await this.executeQuery(receiptSql, [id]);

    return {
      ...donation,
      campaign: campaign || null,
      donor: donor || null,
      receipt: receipt || null,
    };
  }

  // Search donations
  async searchDonations(filters = {}, options = {}) {
    const { page = 1, limit = 50, includeAnonymous = false } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        d.*,
        dc.title_arabic as campaign_title_arabic,
        dc.title_english as campaign_title_english,
        cat.name_arabic as category_name_arabic,
        u.email as donor_email,
        p.full_name_arabic as donor_name_arabic,
        p.full_name_english as donor_name_english
      FROM ${this.tableName} d
      LEFT JOIN donation_campaigns dc ON d.campaign_id = dc.campaign_id
      LEFT JOIN donation_categories cat ON dc.category_id = cat.category_id
      LEFT JOIN users u ON d.donor_id = u.id
      LEFT JOIN persons p ON u.person_id = p.id
      WHERE d.deleted_at IS NULL
    `;

    const params = [];

    // Apply filters
    if (filters.campaign_id) {
      sql += " AND d.campaign_id = ?";
      params.push(filters.campaign_id);
    }

    if (filters.donor_id) {
      sql += " AND d.donor_id = ?";
      params.push(filters.donor_id);
    }

    if (filters.status) {
      sql += " AND d.status = ?";
      params.push(filters.status);
    }

    if (filters.donation_method) {
      sql += " AND d.donation_method = ?";
      params.push(filters.donation_method);
    }

    if (filters.is_anonymous !== undefined) {
      sql += " AND d.is_anonymous = ?";
      params.push(filters.is_anonymous);
    } else if (!includeAnonymous) {
      sql += " AND d.is_anonymous = FALSE";
    }

    if (filters.search) {
      sql +=
        " AND (d.transaction_id LIKE ? OR d.donor_name LIKE ? OR d.donor_email LIKE ? OR d.bank_reference LIKE ?)";
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
      );
    }

    // Date filters
    if (filters.date_from) {
      sql += " AND DATE(d.created_at) >= ?";
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += " AND DATE(d.created_at) <= ?";
      params.push(filters.date_to);
    }

    if (filters.amount_min) {
      sql += " AND d.amount >= ?";
      params.push(filters.amount_min);
    }

    if (filters.amount_max) {
      sql += " AND d.amount <= ?";
      params.push(filters.amount_max);
    }

    // Sort
    sql += " ORDER BY d.created_at DESC";

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const data = await this.executeQuery(sql, params);
    const processedData = data.map((record) => this.processResult(record));

    return {
      data: processedData,
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

  // Get donor's donation history
  async getDonorHistory(donorId, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        d.*,
        dc.title_arabic as campaign_title_arabic,
        dc.title_english as campaign_title_english,
        cat.name_arabic as category_name_arabic,
        dr.receipt_number,
        dr.file_path as receipt_path
      FROM ${this.tableName} d
      LEFT JOIN donation_campaigns dc ON d.campaign_id = dc.campaign_id
      LEFT JOIN donation_categories cat ON dc.category_id = cat.category_id
      LEFT JOIN donation_receipts dr ON d.donation_id = dr.donation_id AND dr.deleted_at IS NULL
      WHERE d.donor_id = ?
      AND d.deleted_at IS NULL
      ORDER BY d.created_at DESC
      LIMIT ? OFFSET ?
    `;

    const results = await this.executeQuery(sql, [donorId, limit, offset]);
    return results.map((record) => this.processResult(record));
  }

  // Get donations summary for dashboard
  async getDonationsSummary(period = "month") {
    let dateFilter = "";
    switch (period) {
      case "today":
        dateFilter = "DATE(created_at) = CURDATE()";
        break;
      case "week":
        dateFilter = "YEARWEEK(created_at) = YEARWEEK(CURDATE())";
        break;
      case "month":
        dateFilter =
          "YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())";
        break;
      case "year":
        dateFilter = "YEAR(created_at) = YEAR(CURDATE())";
        break;
      default:
        dateFilter = "1=1";
    }

    const sql = `
      SELECT 
        COUNT(*) as total_donations,
        SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as total_amount,
        AVG(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as average_donation,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_donations,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_donations,
        COUNT(CASE WHEN status = 'FAILED' THEN 1 END) as failed_donations,
        COUNT(CASE WHEN is_anonymous = TRUE THEN 1 END) as anonymous_donations,
        COUNT(DISTINCT donor_id) as unique_donors
      FROM ${this.tableName}
      WHERE ${dateFilter}
      AND deleted_at IS NULL
    `;

    const results = await this.executeQuery(sql);
    return results[0] || {};
  }

  // Get donation trends
  async getDonationTrends(startDate, endDate, groupBy = "day") {
    let dateFormat = "";
    switch (groupBy) {
      case "day":
        dateFormat = "%Y-%m-%d";
        break;
      case "week":
        dateFormat = "%Y-%u";
        break;
      case "month":
        dateFormat = "%Y-%m";
        break;
      case "year":
        dateFormat = "%Y";
        break;
      default:
        dateFormat = "%Y-%m-%d";
    }

    const sql = `
      SELECT 
        DATE_FORMAT(created_at, ?) as period,
        COUNT(*) as donation_count,
        SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as total_amount,
        COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completed_count,
        COUNT(CASE WHEN status = 'PENDING' THEN 1 END) as pending_count,
        AVG(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as average_amount
      FROM ${this.tableName}
      WHERE created_at BETWEEN ? AND ?
      AND deleted_at IS NULL
      GROUP BY period
      ORDER BY period ASC
    `;

    const results = await this.executeQuery(sql, [
      dateFormat,
      startDate,
      endDate,
    ]);
    return results;
  }

  // Send receipt
  async sendReceipt(
    donationId,
    sentVia = "EMAIL",
    sentTo = null,
    issuedBy = null,
  ) {
    const donation = await this.findById(donationId);
    if (!donation) {
      throw new Error("Donation not found");
    }

    if (donation.status !== "COMPLETED") {
      throw new Error("Receipt can only be sent for completed donations");
    }

    // Generate receipt number
    const receiptNumber = `REC-${Date.now()}-${crypto.randomBytes(3).toString("hex").toUpperCase()}`;

    // Create receipt record
    const receiptSql = `
      INSERT INTO donation_receipts (
        receipt_id, donation_id, receipt_number, receipt_date,
        issued_by, sent_via, sent_to
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    const receiptId = this.generateId();
    await this.executeQuery(receiptSql, [
      receiptId,
      donationId,
      receiptNumber,
      this.formatDate(new Date()),
      issuedBy,
      sentVia,
      sentTo || donation.donor_email,
    ]);

    // Update donation record
    await this.update(donationId, {
      receipt_sent: true,
      receipt_sent_at: this.formatDate(new Date()),
    });

    // TODO: Actually send the receipt via email/SMS/WhatsApp
    // This would integrate with your email service

    return {
      receipt_id: receiptId,
      receipt_number: receiptNumber,
      sent_via: sentVia,
      sent_to: sentTo || donation.donor_email,
    };
  }

  // Export donations for reporting
  async exportDonations(filters = {}, format = "csv") {
    const { data } = await this.searchDonations(filters, { limit: 10000 });

    return {
      donations: data,
      export_date: new Date().toISOString(),
      total_count: data.length,
      total_amount: data.reduce(
        (sum, donation) => sum + (donation.amount || 0),
        0,
      ),
      format,
    };
  }
}

export default Donation;
