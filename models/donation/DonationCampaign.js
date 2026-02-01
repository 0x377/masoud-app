import BaseModel from "../BaseModel.js";

class DonationCampaign extends BaseModel {
  constructor() {
    super("donation_campaigns", "campaign_id");
    this.jsonFields = ["gallery", "payment_methods", "metadata"];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate && !data.title_arabic) {
      errors.push("Arabic title is required");
    }

    if (data.target_amount !== undefined) {
      if (data.target_amount <= 0) {
        errors.push("Target amount must be greater than 0");
      }

      if (data.target_amount > 9999999999999.99) {
        errors.push("Target amount is too large");
      }
    }

    // Date validation
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);

      if (startDate > endDate) {
        errors.push("Start date cannot be after end date");
      }
    }

    // Status validation
    const validStatuses = [
      "DRAFT",
      "ACTIVE",
      "PAUSED",
      "COMPLETED",
      "CANCELLED",
    ];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    // Visibility validation
    const validVisibilities = ["PUBLIC", "PRIVATE", "FAMILY_ONLY"];
    if (data.visibility && !validVisibilities.includes(data.visibility)) {
      errors.push(
        `Invalid visibility. Must be one of: ${validVisibilities.join(", ")}`,
      );
    }

    return errors;
  }

  // Create campaign with validation
  async createCampaign(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const campaignData = {
      ...data,
      created_by: userId,
    };

    return await this.create(campaignData);
  }

  // Update campaign with validation
  async updateCampaign(id, data) {
    const errors = this.validate(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const campaign = await this.findById(id);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    return await this.update(id, data);
  }

  // Get campaign with details
  async getCampaignWithDetails(id, userId = null) {
    const campaign = await this.findById(id);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    // Check visibility
    if (campaign.visibility === "PRIVATE" && campaign.access_password) {
      // Password protected campaign
      if (!userId) {
        throw new Error("This campaign requires authentication");
      }
    } else if (campaign.visibility === "FAMILY_ONLY") {
      // Family members only
      if (!userId) {
        throw new Error("This campaign is for family members only");
      }
      // TODO: Check if user is a family member
    }

    // Get category details
    const categorySql = `
      SELECT * FROM donation_categories 
      WHERE category_id = ? 
      AND deleted_at IS NULL
    `;

    const [category] = await this.executeQuery(categorySql, [
      campaign.category_id,
    ]);

    // Get statistics
    const statsSql = `
      SELECT 
        COUNT(DISTINCT donation_id) as total_donations,
        SUM(amount) as total_amount,
        AVG(amount) as average_donation,
        MAX(amount) as max_donation,
        MIN(amount) as min_donation,
        COUNT(CASE WHEN is_anonymous = TRUE THEN 1 END) as anonymous_count,
        COUNT(DISTINCT donor_id) as unique_donors
      FROM donations 
      WHERE campaign_id = ? 
      AND status = 'COMPLETED'
      AND deleted_at IS NULL
    `;

    const [stats] = await this.executeQuery(statsSql, [id]);

    // Calculate progress
    const progress =
      campaign.target_amount > 0
        ? ((stats?.total_amount || 0) / campaign.target_amount) * 100
        : 0;

    // Get recent donations
    const recentDonationsSql = `
      SELECT 
        d.donation_id,
        d.amount,
        d.currency,
        d.donation_method,
        d.is_anonymous,
        d.donor_name,
        d.dedication_message,
        d.created_at,
        u.email as donor_email
      FROM donations d
      LEFT JOIN users u ON d.donor_id = u.id
      WHERE d.campaign_id = ?
      AND d.status = 'COMPLETED'
      AND d.deleted_at IS NULL
      ORDER BY d.created_at DESC
      LIMIT 10
    `;

    const recentDonations = await this.executeQuery(recentDonationsSql, [id]);

    return {
      ...campaign,
      category: category || null,
      statistics: {
        ...stats,
        progress: Math.min(progress, 100),
        days_left: campaign.end_date
          ? Math.max(
              0,
              Math.ceil(
                (new Date(campaign.end_date) - new Date()) /
                  (1000 * 60 * 60 * 24),
              ),
            )
          : null,
      },
      recent_donations: recentDonations,
    };
  }

  // Search campaigns
  async searchCampaigns(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 12,
      userId = null,
      includePrivate = false,
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        dc.*,
        cat.name_arabic as category_name_arabic,
        cat.name_english as category_name_english,
        COUNT(DISTINCT d.donation_id) as donation_count,
        SUM(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END) as total_amount
      FROM ${this.tableName} dc
      LEFT JOIN donation_categories cat ON dc.category_id = cat.category_id AND cat.deleted_at IS NULL
      LEFT JOIN donations d ON dc.campaign_id = d.campaign_id AND d.deleted_at IS NULL
      WHERE dc.deleted_at IS NULL
    `;

    const params = [];

    // Apply filters
    if (filters.category_id) {
      sql += " AND dc.category_id = ?";
      params.push(filters.category_id);
    }

    if (filters.status) {
      sql += " AND dc.status = ?";
      params.push(filters.status);
    }

    if (filters.visibility) {
      sql += " AND dc.visibility = ?";
      params.push(filters.visibility);
    } else if (!includePrivate) {
      sql += ' AND dc.visibility IN ("PUBLIC", "FAMILY_ONLY")';
    }

    if (filters.is_featured !== undefined) {
      sql += " AND dc.is_featured = ?";
      params.push(filters.is_featured);
    }

    if (filters.search) {
      sql +=
        " AND (dc.title_arabic LIKE ? OR dc.title_english LIKE ? OR dc.description LIKE ?)";
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
      );
    }

    // Date filters
    if (filters.start_date_from) {
      sql += " AND dc.start_date >= ?";
      params.push(filters.start_date_from);
    }

    if (filters.start_date_to) {
      sql += " AND dc.start_date <= ?";
      params.push(filters.start_date_to);
    }

    if (filters.active_only) {
      sql += ' AND dc.status = "ACTIVE"';
      if (filters.current_only) {
        sql += " AND (dc.end_date IS NULL OR dc.end_date >= CURDATE())";
      }
    }

    // Group and order
    sql += " GROUP BY dc.campaign_id";

    // Sort by
    if (filters.sort_by === "popular") {
      sql += " ORDER BY donation_count DESC";
    } else if (filters.sort_by === "amount") {
      sql += " ORDER BY total_amount DESC";
    } else if (filters.sort_by === "recent") {
      sql += " ORDER BY dc.created_at DESC";
    } else if (filters.sort_by === "ending_soon") {
      sql += " ORDER BY dc.end_date ASC";
    } else {
      sql += " ORDER BY dc.is_featured DESC, dc.created_at DESC";
    }

    // Count total
    const countSql = `SELECT COUNT(DISTINCT dc.campaign_id) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const data = await this.executeQuery(sql, params);
    const processedData = data.map((record) => this.processResult(record));

    // Calculate progress for each campaign
    processedData.forEach((campaign) => {
      const progress =
        campaign.target_amount > 0
          ? ((campaign.total_amount || 0) / campaign.target_amount) * 100
          : 0;
      campaign.progress = Math.min(progress, 100);
      campaign.days_left = campaign.end_date
        ? Math.max(
            0,
            Math.ceil(
              (new Date(campaign.end_date) - new Date()) /
                (1000 * 60 * 60 * 24),
            ),
          )
        : null;
    });

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

  // Update campaign status
  async updateStatus(id, status, userId = null) {
    const campaign = await this.findById(id);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    const updateData = { status };

    if (status === "ACTIVE" && !campaign.start_date) {
      updateData.start_date = this.formatDate(new Date());
    } else if (status === "COMPLETED" && !campaign.end_date) {
      updateData.end_date = this.formatDate(new Date());
    }

    if (userId) {
      updateData.updated_by = userId;
    }

    return await this.update(id, updateData);
  }

  // Toggle featured status
  async toggleFeatured(id) {
    const campaign = await this.findById(id);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    return await this.update(id, {
      is_featured: !campaign.is_featured,
    });
  }

  // Get campaigns by category
  async getCampaignsByCategory(categoryId, options = {}) {
    const { activeOnly = true, limit = 10 } = options;

    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE category_id = ?
      AND deleted_at IS NULL
    `;

    const params = [categoryId];

    if (activeOnly) {
      sql +=
        ' AND status = "ACTIVE" AND (end_date IS NULL OR end_date >= CURDATE())';
    }

    sql += " ORDER BY is_featured DESC, created_at DESC LIMIT ?";
    params.push(limit);

    const results = await this.executeQuery(sql, params);
    return results.map((record) => this.processResult(record));
  }

  // Get featured campaigns
  async getFeaturedCampaigns(limit = 5) {
    const sql = `
      SELECT 
        dc.*,
        cat.name_arabic as category_name_arabic,
        SUM(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END) as total_amount
      FROM ${this.tableName} dc
      LEFT JOIN donation_categories cat ON dc.category_id = cat.category_id
      LEFT JOIN donations d ON dc.campaign_id = d.campaign_id
      WHERE dc.is_featured = TRUE
      AND dc.status = 'ACTIVE'
      AND dc.deleted_at IS NULL
      AND (dc.end_date IS NULL OR dc.end_date >= CURDATE())
      GROUP BY dc.campaign_id
      ORDER BY dc.created_at DESC
      LIMIT ?
    `;

    const results = await this.executeQuery(sql, [limit]);
    return results.map((record) => {
      const processed = this.processResult(record);
      const progress =
        processed.target_amount > 0
          ? ((processed.total_amount || 0) / processed.target_amount) * 100
          : 0;
      return {
        ...processed,
        progress: Math.min(progress, 100),
      };
    });
  }

  // Check if campaign is accessible by user
  async checkCampaignAccess(campaignId, userId = null) {
    const campaign = await this.findById(campaignId);
    if (!campaign) {
      throw new Error("Campaign not found");
    }

    if (campaign.visibility === "PUBLIC") {
      return { accessible: true, requiresAuth: false };
    }

    if (campaign.visibility === "PRIVATE") {
      if (!userId) {
        return {
          accessible: false,
          requiresAuth: true,
          requiresPassword: true,
        };
      }
      // TODO: Check if user has access to private campaign
      return { accessible: true, requiresAuth: true, requiresPassword: false };
    }

    if (campaign.visibility === "FAMILY_ONLY") {
      if (!userId) {
        return { accessible: false, requiresAuth: true };
      }
      // TODO: Check if user is a family member
      return { accessible: true, requiresAuth: true };
    }

    return { accessible: false, requiresAuth: false };
  }

  // Get campaign statistics
  async getCampaignStats(campaignId) {
    const sql = `
      SELECT 
        COUNT(*) as total_donations,
        SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as total_amount,
        AVG(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as average_donation,
        MAX(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as max_donation,
        MIN(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as min_donation,
        COUNT(CASE WHEN is_anonymous = TRUE AND status = 'COMPLETED' THEN 1 END) as anonymous_count,
        COUNT(DISTINCT donor_id) as unique_donors,
        COUNT(CASE WHEN donation_method = 'BANK_TRANSFER' AND status = 'COMPLETED' THEN 1 END) as bank_transfers,
        COUNT(CASE WHEN donation_method = 'CREDIT_CARD' AND status = 'COMPLETED' THEN 1 END) as credit_cards,
        COUNT(CASE WHEN donation_method = 'CASH' AND status = 'COMPLETED' THEN 1 END) as cash_donations
      FROM donations 
      WHERE campaign_id = ?
      AND deleted_at IS NULL
    `;

    const results = await this.executeQuery(sql, [campaignId]);
    return results[0] || {};
  }

  // Export campaign data
  async exportCampaignData(campaignId, format = "csv") {
    const campaign = await this.getCampaignWithDetails(campaignId);

    // Get all donations for this campaign
    const donationsSql = `
      SELECT 
        d.donation_id,
        d.transaction_id,
        d.amount,
        d.currency,
        d.donation_method,
        d.status,
        d.is_anonymous,
        COALESCE(d.donor_name, u.email) as donor,
        d.donor_email,
        d.donor_phone,
        d.dedication_name,
        d.dedication_message,
        d.created_at,
        d.receipt_sent,
        d.receipt_sent_at
      FROM donations d
      LEFT JOIN users u ON d.donor_id = u.id
      WHERE d.campaign_id = ?
      AND d.deleted_at IS NULL
      ORDER BY d.created_at DESC
    `;

    const donations = await this.executeQuery(donationsSql, [campaignId]);

    return {
      campaign,
      donations,
      export_date: new Date().toISOString(),
      format,
    };
  }
}

export default DonationCampaign;
