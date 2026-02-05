import BaseModel from '../../libs/BaseModel.js';

class WaqfTransaction extends BaseModel {
  constructor() {
    super("waqf_transactions", "transaction_id");
    this.jsonFields = ["metadata"];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.waqf_id) {
        errors.push("Waqf ID is required");
      }
      if (!data.transaction_type) {
        errors.push("Transaction type is required");
      }
      if (!data.amount || data.amount <= 0) {
        errors.push("Valid amount is required");
      }
      if (!data.transaction_date) {
        errors.push("Transaction date is required");
      }
    }

    // Transaction type validation
    const validTypes = [
      "INCOME",
      "EXPENSE",
      "INVESTMENT",
      "DISTRIBUTION",
      "VALUATION_UPDATE",
      "TRANSFER",
    ];
    if (data.transaction_type && !validTypes.includes(data.transaction_type)) {
      errors.push(
        `Invalid transaction type. Must be one of: ${validTypes.join(", ")}`,
      );
    }

    // Amount validation
    if (data.amount !== undefined && data.amount <= 0) {
      errors.push("Amount must be greater than 0");
    }

    // Currency validation
    const validCurrencies = ["SAR", "USD", "EUR", "GBP"];
    if (data.currency && !validCurrencies.includes(data.currency)) {
      errors.push(
        `Invalid currency. Must be one of: ${validCurrencies.join(", ")}`,
      );
    }

    // Date validation
    if (data.transaction_date) {
      const transactionDate = new Date(data.transaction_date);
      if (transactionDate > new Date()) {
        errors.push("Transaction date cannot be in the future");
      }
    }

    if (data.approval_date && data.transaction_date) {
      const transactionDate = new Date(data.transaction_date);
      const approvalDate = new Date(data.approval_date);
      if (approvalDate < transactionDate) {
        errors.push("Approval date cannot be before transaction date");
      }
    }

    return errors;
  }

  // Create transaction with validation
  async createTransaction(data, userId = null) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    // Check waqf exists and is active
    const waqfSql = `
      SELECT * FROM family_waqf 
      WHERE waqf_id = ? 
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
    `;

    const [waqf] = await this.executeQuery(waqfSql, [data.waqf_id]);
    if (!waqf) {
      throw new Error("Waqf not found or not active");
    }

    // Check for distribution to beneficiary
    if (data.transaction_type === "DISTRIBUTION" && data.beneficiary_id) {
      const beneficiarySql = `
        SELECT * FROM waqf_beneficiaries
        WHERE waqf_id = ?
        AND person_id = ?
        AND status = 'ACTIVE'
        AND deleted_at IS NULL
      `;

      const [beneficiary] = await this.executeQuery(beneficiarySql, [
        data.waqf_id,
        data.beneficiary_id,
      ]);
      if (!beneficiary) {
        throw new Error("Beneficiary not found or not active for this waqf");
      }
    }

    const transactionData = {
      ...data,
      created_by: userId,
      currency: data.currency || "SAR",
      transaction_date: data.transaction_date || this.formatDate(new Date()),
    };

    return await this.create(transactionData);
  }

  // Approve transaction
  async approveTransaction(id, approverId, approvalDate = null) {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    if (transaction.approved_by) {
      throw new Error("Transaction already approved");
    }

    return await this.update(id, {
      approved_by: approverId,
      approval_date: approvalDate || this.formatDate(new Date()),
    });
  }

  // Get transaction with details
  async getTransactionWithDetails(id) {
    const transaction = await this.findById(id);
    if (!transaction) {
      throw new Error("Transaction not found");
    }

    // Get waqf details
    const waqfSql = `
      SELECT 
        fw.*,
        p.full_name_arabic as founder_name
      FROM family_waqf fw
      LEFT JOIN persons p ON fw.founder_id = p.id
      WHERE fw.waqf_id = ?
      AND fw.deleted_at IS NULL
    `;

    const [waqf] = await this.executeQuery(waqfSql, [transaction.waqf_id]);

    // Get beneficiary details
    let beneficiary = null;
    if (transaction.beneficiary_id) {
      const beneficiarySql = `
        SELECT 
          p.*,
          wb.share_percentage,
          wb.share_amount,
          wb.distribution_frequency
        FROM persons p
        LEFT JOIN waqf_beneficiaries wb ON p.id = wb.person_id AND wb.waqf_id = ?
        WHERE p.id = ?
        AND p.deleted_at IS NULL
      `;

      const [beneficiaryResult] = await this.executeQuery(beneficiarySql, [
        transaction.waqf_id,
        transaction.beneficiary_id,
      ]);
      beneficiary = beneficiaryResult;
    }

    // Get approver details
    let approver = null;
    if (transaction.approved_by) {
      const approverSql = `
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

      const [approverResult] = await this.executeQuery(approverSql, [
        transaction.approved_by,
      ]);
      approver = approverResult;
    }

    // Get creator details
    let creator = null;
    if (transaction.created_by) {
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
        transaction.created_by,
      ]);
      creator = creatorResult;
    }

    return {
      ...transaction,
      waqf: waqf || null,
      beneficiary: beneficiary || null,
      approver: approver || null,
      creator: creator || null,
    };
  }

  // Search transactions
  async searchTransactions(filters = {}, options = {}) {
    const { page = 1, limit = 50, userId = null } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        wt.*,
        fw.name_arabic as waqf_name_arabic,
        fw.name_english as waqf_name_english,
        p.full_name_arabic as beneficiary_name,
        u.email as approver_email,
        u2.email as creator_email
      FROM ${this.tableName} wt
      LEFT JOIN family_waqf fw ON wt.waqf_id = fw.waqf_id
      LEFT JOIN persons p ON wt.beneficiary_id = p.id
      LEFT JOIN users u ON wt.approved_by = u.id
      LEFT JOIN users u2 ON wt.created_by = u2.id
      WHERE wt.deleted_at IS NULL
    `;

    const params = [];

    // Apply filters
    if (filters.waqf_id) {
      sql += " AND wt.waqf_id = ?";
      params.push(filters.waqf_id);
    }

    if (filters.transaction_type) {
      sql += " AND wt.transaction_type = ?";
      params.push(filters.transaction_type);
    }

    if (filters.category) {
      sql += " AND wt.category = ?";
      params.push(filters.category);
    }

    if (filters.beneficiary_id) {
      sql += " AND wt.beneficiary_id = ?";
      params.push(filters.beneficiary_id);
    }

    if (filters.approved_by) {
      sql += " AND wt.approved_by = ?";
      params.push(filters.approved_by);
    }

    if (filters.created_by) {
      sql += " AND wt.created_by = ?";
      params.push(filters.created_by);
    }

    if (filters.search) {
      sql += " AND (wt.description LIKE ? OR wt.reference_number LIKE ?)";
      params.push(`%${filters.search}%`, `%${filters.search}%`);
    }

    // Date filters
    if (filters.date_from) {
      sql += " AND wt.transaction_date >= ?";
      params.push(filters.date_from);
    }

    if (filters.date_to) {
      sql += " AND wt.transaction_date <= ?";
      params.push(filters.date_to);
    }

    if (filters.amount_min) {
      sql += " AND wt.amount >= ?";
      params.push(filters.amount_min);
    }

    if (filters.amount_max) {
      sql += " AND wt.amount <= ?";
      params.push(filters.amount_max);
    }

    if (filters.approved !== undefined) {
      if (filters.approved) {
        sql += " AND wt.approved_by IS NOT NULL";
      } else {
        sql += " AND wt.approved_by IS NULL";
      }
    }

    // Sort
    sql += " ORDER BY wt.transaction_date DESC, wt.created_at DESC";

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

  // Get transactions summary by period
  async getTransactionsSummary(waqfId, period = "MONTH") {
    let dateFormat = "";
    switch (period) {
      case "DAY":
        dateFormat = "%Y-%m-%d";
        break;
      case "WEEK":
        dateFormat = "%Y-%u";
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
        transaction_type,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
      FROM ${this.tableName}
      WHERE waqf_id = ?
      AND deleted_at IS NULL
      GROUP BY period, transaction_type
      ORDER BY period DESC, transaction_type
    `;

    const results = await this.executeQuery(sql, [dateFormat, waqfId]);
    return results;
  }

  // Get transactions by category
  async getTransactionsByCategory(waqfId, category) {
    const sql = `
      SELECT 
        wt.*,
        p.full_name_arabic as beneficiary_name
      FROM ${this.tableName} wt
      LEFT JOIN persons p ON wt.beneficiary_id = p.id
      WHERE wt.waqf_id = ?
      AND wt.category = ?
      AND wt.deleted_at IS NULL
      ORDER BY wt.transaction_date DESC
    `;

    const results = await this.executeQuery(sql, [waqfId, category]);
    return results.map((record) => this.processResult(record));
  }

  // Get pending approvals
  async getPendingApprovals(waqfId = null) {
    let sql = `
      SELECT 
        wt.*,
        fw.name_arabic as waqf_name_arabic,
        u.email as creator_email
      FROM ${this.tableName} wt
      LEFT JOIN family_waqf fw ON wt.waqf_id = fw.waqf_id
      LEFT JOIN users u ON wt.created_by = u.id
      WHERE wt.approved_by IS NULL
      AND wt.deleted_at IS NULL
    `;

    const params = [];

    if (waqfId) {
      sql += " AND wt.waqf_id = ?";
      params.push(waqfId);
    }

    sql += " ORDER BY wt.transaction_date ASC, wt.created_at ASC";

    const results = await this.executeQuery(sql, params);
    return results.map((record) => this.processResult(record));
  }

  // Get transactions by beneficiary
  async getTransactionsByBeneficiary(beneficiaryId) {
    const sql = `
      SELECT 
        wt.*,
        fw.name_arabic as waqf_name_arabic,
        fw.name_english as waqf_name_english
      FROM ${this.tableName} wt
      LEFT JOIN family_waqf fw ON wt.waqf_id = fw.waqf_id
      WHERE wt.beneficiary_id = ?
      AND wt.transaction_type = 'DISTRIBUTION'
      AND wt.deleted_at IS NULL
      ORDER BY wt.transaction_date DESC
    `;

    const results = await this.executeQuery(sql, [beneficiaryId]);
    return results.map((record) => this.processResult(record));
  }

  // Calculate total distributions to beneficiary
  async getTotalDistributionsToBeneficiary(waqfId, beneficiaryId) {
    const sql = `
      SELECT 
        SUM(amount) as total_distributed
      FROM ${this.tableName}
      WHERE waqf_id = ?
      AND beneficiary_id = ?
      AND transaction_type = 'DISTRIBUTION'
      AND deleted_at IS NULL
    `;

    const results = await this.executeQuery(sql, [waqfId, beneficiaryId]);
    return results[0]?.total_distributed || 0;
  }

  // Export transactions
  async exportTransactions(filters = {}, format = "csv") {
    const { data } = await this.searchTransactions(filters, { limit: 10000 });

    return {
      transactions: data,
      export_date: new Date().toISOString(),
      total_count: data.length,
      total_amount: data.reduce(
        (sum, transaction) => sum + (transaction.amount || 0),
        0,
      ),
      format,
    };
  }
}

export default WaqfTransaction;
