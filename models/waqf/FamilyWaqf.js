import BaseModel from "../BaseModel.js";

class FamilyWaqf extends BaseModel {
  constructor() {
    super("family_waqf", "waqf_id");
    this.jsonFields = [
      "beneficiaries",
      "management_committee",
      "documents",
      "location",
      "income_distribution_rules",
      "metadata",
    ];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.name_arabic) {
        errors.push("Arabic name is required");
      }
      if (!data.waqf_type) {
        errors.push("Waqf type is required");
      }
    }

    // Waqf type validation
    const validWaqfTypes = ["CASH", "PROPERTY", "LAND", "BUSINESS", "OTHER"];
    if (data.waqf_type && !validWaqfTypes.includes(data.waqf_type)) {
      errors.push(
        `Invalid waqf type. Must be one of: ${validWaqfTypes.join(", ")}`,
      );
    }

    // Status validation
    const validStatuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "LIQUIDATED"];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    // Financial validation
    if (data.current_value !== undefined && data.current_value < 0) {
      errors.push("Current value cannot be negative");
    }

    if (
      data.estimated_annual_return !== undefined &&
      data.estimated_annual_return < 0
    ) {
      errors.push("Estimated annual return cannot be negative");
    }

    // Date validation
    if (data.establishment_date) {
      const establishmentDate = new Date(data.establishment_date);
      if (establishmentDate > new Date()) {
        errors.push("Establishment date cannot be in the future");
      }
    }

    return errors;
  }

  // Create waqf with validation
  async createWaqf(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const waqfData = {
      ...data,
      created_by: userId,
      status: data.status || "ACTIVE",
      current_value: data.current_value || 0,
      estimated_annual_return: data.estimated_annual_return || 0,
    };

    return await this.create(waqfData);
  }

  // Update waqf with validation
  async updateWaqf(id, data) {
    const errors = this.validate(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const waqf = await this.findById(id);
    if (!waqf) {
      throw new Error("Waqf not found");
    }

    return await this.update(id, data);
  }

  // Get waqf with full details
  async getWaqfWithDetails(id, userId = null) {
    const waqf = await this.findById(id);
    if (!waqf) {
      throw new Error("Waqf not found");
    }

    // Get founder details
    let founder = null;
    if (waqf.founder_id) {
      const founderSql = `
        SELECT 
          p.*,
          u.email as user_email
        FROM persons p
        LEFT JOIN users u ON p.id = u.person_id
        WHERE p.id = ?
        AND p.deleted_at IS NULL
      `;

      const [founderResult] = await this.executeQuery(founderSql, [
        waqf.founder_id,
      ]);
      founder = founderResult;
    }

    // Get creator details
    let creator = null;
    if (waqf.created_by) {
      const creatorSql = `
        SELECT 
          u.id,
          u.email,
          u.user_type,
          p.full_name_arabic,
          p.full_name_english
        FROM users u
        LEFT JOIN persons p ON u.person_id = p.id
        WHERE u.id = ?
        AND u.deleted_at IS NULL
      `;

      const [creatorResult] = await this.executeQuery(creatorSql, [
        waqf.created_by,
      ]);
      creator = creatorResult;
    }

    // Get beneficiaries count
    const beneficiariesSql = `
      SELECT COUNT(*) as count FROM waqf_beneficiaries
      WHERE waqf_id = ?
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
    `;

    const [beneficiariesCount] = await this.executeQuery(beneficiariesSql, [
      id,
    ]);

    // Get management committee count
    const committeeSql = `
      SELECT COUNT(*) as count FROM waqf_management_committee
      WHERE waqf_id = ?
      AND is_active = TRUE
      AND deleted_at IS NULL
    `;

    const [committeeCount] = await this.executeQuery(committeeSql, [id]);

    // Get transactions summary
    const transactionsSql = `
      SELECT 
        transaction_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM waqf_transactions
      WHERE waqf_id = ?
      AND deleted_at IS NULL
      GROUP BY transaction_type
    `;

    const transactionsSummary = await this.executeQuery(transactionsSql, [id]);

    // Calculate total income and expenses
    let totalIncome = 0;
    let totalExpenses = 0;
    let totalDistributions = 0;

    transactionsSummary.forEach((transaction) => {
      if (transaction.transaction_type === "INCOME") {
        totalIncome = transaction.total_amount || 0;
      } else if (transaction.transaction_type === "EXPENSE") {
        totalExpenses = transaction.total_amount || 0;
      } else if (transaction.transaction_type === "DISTRIBUTION") {
        totalDistributions = transaction.total_amount || 0;
      }
    });

    // Get latest transactions
    const latestTransactionsSql = `
      SELECT 
        t.*,
        p.full_name_arabic as beneficiary_name,
        u.email as approver_email
      FROM waqf_transactions t
      LEFT JOIN persons p ON t.beneficiary_id = p.id
      LEFT JOIN users u ON t.approved_by = u.id
      WHERE t.waqf_id = ?
      AND t.deleted_at IS NULL
      ORDER BY t.transaction_date DESC, t.created_at DESC
      LIMIT 10
    `;

    const latestTransactions = await this.executeQuery(latestTransactionsSql, [
      id,
    ]);

    // Get financial summary
    const financialSummarySql = `
      SELECT * FROM waqf_financial_summary
      WHERE waqf_id = ?
      AND period_type = 'MONTHLY'
      ORDER BY period_start DESC
      LIMIT 1
    `;

    const [financialSummary] = await this.executeQuery(financialSummarySql, [
      id,
    ]);

    return {
      ...waqf,
      founder: founder,
      creator: creator,
      statistics: {
        beneficiaries_count: beneficiariesCount?.count || 0,
        committee_count: committeeCount?.count || 0,
        total_income: totalIncome,
        total_expenses: totalExpenses,
        total_distributions: totalDistributions,
        net_worth: waqf.current_value || 0,
        return_rate: waqf.estimated_annual_return
          ? (waqf.estimated_annual_return / (waqf.current_value || 1)) * 100
          : 0,
      },
      transactions_summary: transactionsSummary,
      latest_transactions: latestTransactions,
      financial_summary: financialSummary || null,
    };
  }

  // Search waqf
  async searchWaqf(filters = {}, options = {}) {
    const { page = 1, limit = 20, userId = null } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        fw.*,
        p.full_name_arabic as founder_name,
        u.email as creator_email
      FROM ${this.tableName} fw
      LEFT JOIN persons p ON fw.founder_id = p.id
      LEFT JOIN users u ON fw.created_by = u.id
      WHERE fw.deleted_at IS NULL
    `;

    const params = [];

    // Apply filters
    if (filters.waqf_type) {
      sql += " AND fw.waqf_type = ?";
      params.push(filters.waqf_type);
    }

    if (filters.status) {
      sql += " AND fw.status = ?";
      params.push(filters.status);
    }

    if (filters.search) {
      sql +=
        " AND (fw.name_arabic LIKE ? OR fw.name_english LIKE ? OR fw.description LIKE ?)";
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
      );
    }

    if (filters.establishment_date_from) {
      sql += " AND fw.establishment_date >= ?";
      params.push(filters.establishment_date_from);
    }

    if (filters.establishment_date_to) {
      sql += " AND fw.establishment_date <= ?";
      params.push(filters.establishment_date_to);
    }

    if (filters.current_value_min) {
      sql += " AND fw.current_value >= ?";
      params.push(filters.current_value_min);
    }

    if (filters.current_value_max) {
      sql += " AND fw.current_value <= ?";
      params.push(filters.current_value_max);
    }

    if (filters.created_by) {
      sql += " AND fw.created_by = ?";
      params.push(filters.created_by);
    }

    // Sort
    if (filters.sort_by === "value_desc") {
      sql += " ORDER BY fw.current_value DESC";
    } else if (filters.sort_by === "value_asc") {
      sql += " ORDER BY fw.current_value ASC";
    } else if (filters.sort_by === "date_desc") {
      sql += " ORDER BY fw.establishment_date DESC";
    } else if (filters.sort_by === "date_asc") {
      sql += " ORDER BY fw.establishment_date ASC";
    } else if (filters.sort_by === "name_arabic") {
      sql += " ORDER BY fw.name_arabic ASC";
    } else if (filters.sort_by === "name_english") {
      sql += " ORDER BY fw.name_english ASC";
    } else {
      sql += " ORDER BY fw.created_at DESC";
    }

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

  // Update waqf value
  async updateWaqfValue(id, newValue, reason = "Valuation update") {
    const waqf = await this.findById(id);
    if (!waqf) {
      throw new Error("Waqf not found");
    }

    const valueDifference = newValue - (waqf.current_value || 0);

    // Create valuation transaction
    const transactionModel = new WaqfTransaction();
    await transactionModel.createTransaction({
      waqf_id: id,
      transaction_type: "VALUATION_UPDATE",
      amount: Math.abs(valueDifference),
      description: reason,
      transaction_date: this.formatDate(new Date()),
      category: "VALUATION",
    });

    // Update waqf value
    return await this.update(id, {
      current_value: newValue,
      updated_at: this.formatDate(new Date()),
    });
  }

  // Get waqf statistics
  async getWaqfStatistics() {
    const sql = `
      SELECT 
        COUNT(*) as total_waqf,
        SUM(current_value) as total_value,
        AVG(current_value) as average_value,
        SUM(estimated_annual_return) as total_annual_return,
        COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as active_waqf,
        COUNT(CASE WHEN status = 'INACTIVE' THEN 1 END) as inactive_waqf,
        COUNT(CASE WHEN status = 'SUSPENDED' THEN 1 END) as suspended_waqf,
        COUNT(CASE WHEN status = 'LIQUIDATED' THEN 1 END) as liquidated_waqf,
        COUNT(CASE WHEN waqf_type = 'CASH' THEN 1 END) as cash_waqf,
        COUNT(CASE WHEN waqf_type = 'PROPERTY' THEN 1 END) as property_waqf,
        COUNT(CASE WHEN waqf_type = 'LAND' THEN 1 END) as land_waqf,
        COUNT(CASE WHEN waqf_type = 'BUSINESS' THEN 1 END) as business_waqf,
        COUNT(CASE WHEN waqf_type = 'OTHER' THEN 1 END) as other_waqf
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;

    const results = await this.executeQuery(sql);
    return results[0] || {};
  }

  // Get waqf by type
  async getWaqfByType(waqfType, options = {}) {
    const { activeOnly = true, limit = 10 } = options;

    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE waqf_type = ?
      AND deleted_at IS NULL
    `;

    const params = [waqfType];

    if (activeOnly) {
      sql += ' AND status = "ACTIVE"';
    }

    sql += " ORDER BY current_value DESC LIMIT ?";
    params.push(limit);

    const results = await this.executeQuery(sql, params);
    return results.map((record) => this.processResult(record));
  }

  // Get waqf value trend
  async getWaqfValueTrend(waqfId, period = "YEAR") {
    let dateFormat = "";
    switch (period) {
      case "DAY":
        dateFormat = "%Y-%m-%d";
        break;
      case "MONTH":
        dateFormat = "%Y-%m";
        break;
      case "YEAR":
        dateFormat = "%Y";
        break;
      default:
        dateFormat = "%Y-%m";
    }

    const sql = `
      SELECT 
        DATE_FORMAT(transaction_date, ?) as period,
        SUM(CASE WHEN transaction_type = 'INCOME' THEN amount ELSE 0 END) as income,
        SUM(CASE WHEN transaction_type = 'EXPENSE' THEN amount ELSE 0 END) as expenses,
        SUM(CASE WHEN transaction_type = 'DISTRIBUTION' THEN amount ELSE 0 END) as distributions,
        SUM(CASE WHEN transaction_type = 'VALUATION_UPDATE' THEN amount ELSE 0 END) as valuation_changes
      FROM waqf_transactions
      WHERE waqf_id = ?
      AND deleted_at IS NULL
      GROUP BY period
      ORDER BY period ASC
    `;

    const results = await this.executeQuery(sql, [dateFormat, waqfId]);
    return results;
  }

  // Export waqf data
  async exportWaqfData(waqfId, format = "csv") {
    const waqf = await this.getWaqfWithDetails(waqfId);

    // Get all transactions
    const transactionsSql = `
      SELECT 
        t.*,
        p.full_name_arabic as beneficiary_name,
        u.email as approver_email,
        u2.email as creator_email
      FROM waqf_transactions t
      LEFT JOIN persons p ON t.beneficiary_id = p.id
      LEFT JOIN users u ON t.approved_by = u.id
      LEFT JOIN users u2 ON t.created_by = u2.id
      WHERE t.waqf_id = ?
      AND t.deleted_at IS NULL
      ORDER BY t.transaction_date DESC
    `;

    const transactions = await this.executeQuery(transactionsSql, [waqfId]);

    // Get beneficiaries
    const beneficiariesSql = `
      SELECT 
        wb.*,
        p.full_name_arabic,
        p.full_name_english,
        p.birth_date,
        p.gender
      FROM waqf_beneficiaries wb
      INNER JOIN persons p ON wb.person_id = p.id
      WHERE wb.waqf_id = ?
      AND wb.deleted_at IS NULL
      ORDER BY wb.share_percentage DESC
    `;

    const beneficiaries = await this.executeQuery(beneficiariesSql, [waqfId]);

    // Get committee members
    const committeeSql = `
      SELECT 
        wc.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender
      FROM waqf_management_committee wc
      INNER JOIN persons p ON wc.person_id = p.id
      WHERE wc.waqf_id = ?
      AND wc.deleted_at IS NULL
      ORDER BY 
        CASE wc.role 
          WHEN 'CHAIRPERSON' THEN 1
          WHEN 'VICE_CHAIRPERSON' THEN 2
          WHEN 'TREASURER' THEN 3
          WHEN 'SECRETARY' THEN 4
          WHEN 'AUDITOR' THEN 5
          WHEN 'ADVISOR' THEN 6
          WHEN 'MEMBER' THEN 7
          ELSE 8
        END,
        wc.start_date DESC
    `;

    const committee = await this.executeQuery(committeeSql, [waqfId]);

    // Get documents
    const documentsSql = `
      SELECT * FROM waqf_documents
      WHERE waqf_id = ?
      AND deleted_at IS NULL
      ORDER BY document_type, created_at DESC
    `;

    const documents = await this.executeQuery(documentsSql, [waqfId]);

    return {
      waqf,
      transactions,
      beneficiaries,
      committee,
      documents,
      export_date: new Date().toISOString(),
      format,
    };
  }
}

// Import other models needed
import WaqfTransaction from "./WaqfTransaction.js";

export default FamilyWaqf;
