import BaseModel from '../../libs/BaseModel.js';

class DonationCategory extends BaseModel {
  constructor() {
    super("donation_categories", "category_id");
    this.jsonFields = ["metadata"];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate && !data.name_arabic) {
      errors.push("Arabic name is required");
    }

    // Name length validation
    if (data.name_arabic && data.name_arabic.length > 255) {
      errors.push("Arabic name is too long (max 255 characters)");
    }

    if (data.name_english && data.name_english.length > 255) {
      errors.push("English name is too long (max 255 characters)");
    }

    // Sort order validation
    if (data.sort_order !== undefined && !Number.isInteger(data.sort_order)) {
      errors.push("Sort order must be an integer");
    }

    return errors;
  }

  // Create category with validation
  async createCategory(data) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    return await this.create(data);
  }

  // Update category with validation
  async updateCategory(id, data) {
    const errors = this.validate(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const category = await this.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    return await this.update(id, data);
  }

  // Get all active categories sorted
  async getActiveCategories() {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE is_active = TRUE
      AND deleted_at IS NULL
      ORDER BY sort_order ASC, name_arabic ASC
    `;

    const results = await this.executeQuery(sql);
    return results.map((record) => this.processResult(record));
  }

  // Search categories
  async searchCategories(query, options = {}) {
    const { activeOnly = true, page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE deleted_at IS NULL
      AND (
        name_arabic LIKE ? OR 
        name_english LIKE ? OR 
        description LIKE ?
      )
    `;

    const params = [`%${query}%`, `%${query}%`, `%${query}%`];

    if (activeOnly) {
      sql += " AND is_active = TRUE";
    }

    sql += " ORDER BY sort_order ASC LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const results = await this.executeQuery(sql, params);
    return results.map((record) => this.processResult(record));
  }

  // Toggle category status
  async toggleStatus(id) {
    const category = await this.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    return await this.update(id, {
      is_active: !category.is_active,
    });
  }

  // Get category with statistics
  async getCategoryWithStats(id) {
    const category = await this.findById(id);
    if (!category) {
      throw new Error("Category not found");
    }

    // Get statistics for this category
    const statsSql = `
      SELECT 
        COUNT(DISTINCT dc.campaign_id) as total_campaigns,
        SUM(dc.current_amount) as total_amount,
        COUNT(DISTINCT d.donation_id) as total_donations
      FROM donation_campaigns dc
      LEFT JOIN donations d ON dc.campaign_id = d.campaign_id AND d.status = 'COMPLETED'
      WHERE dc.category_id = ?
      AND dc.deleted_at IS NULL
    `;

    const [stats] = await this.executeQuery(statsSql, [id]);

    return {
      ...category,
      statistics: stats || {
        total_campaigns: 0,
        total_amount: 0,
        total_donations: 0,
      },
    };
  }

  // Get categories tree (for nested categories if needed)
  async getCategoriesTree() {
    const sql = `
      SELECT 
        c.*,
        COUNT(DISTINCT dc.campaign_id) as campaign_count,
        COUNT(DISTINCT d.donation_id) as donation_count,
        SUM(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END) as total_amount
      FROM ${this.tableName} c
      LEFT JOIN donation_campaigns dc ON c.category_id = dc.category_id AND dc.deleted_at IS NULL
      LEFT JOIN donations d ON dc.campaign_id = d.campaign_id AND d.status = 'COMPLETED'
      WHERE c.deleted_at IS NULL
      AND c.is_active = TRUE
      GROUP BY c.category_id
      ORDER BY c.sort_order ASC, c.name_arabic ASC
    `;

    const results = await this.executeQuery(sql);
    return results.map((record) => this.processResult(record));
  }

  // Reorder categories
  async reorderCategories(orderMap) {
    const updates = [];

    for (const [categoryId, sortOrder] of Object.entries(orderMap)) {
      updates.push(this.update(categoryId, { sort_order: sortOrder }));
    }

    await Promise.all(updates);
    return true;
  }
}

export default DonationCategory;
