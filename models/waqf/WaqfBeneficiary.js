import BaseModel from '../../libs/BaseModel.js';

class WaqfBeneficiary extends BaseModel {
  constructor() {
    super("waqf_beneficiaries", "beneficiary_id");
    this.jsonFields = ["special_conditions", "metadata"];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.waqf_id) {
        errors.push("Waqf ID is required");
      }
      if (!data.person_id) {
        errors.push("Person ID is required");
      }
    }

    // Relationship validation
    const validRelationships = [
      "FAMILY_MEMBER",
      "ORPHAN",
      "STUDENT",
      "NEEDY",
      "OTHER",
    ];
    if (data.relationship && !validRelationships.includes(data.relationship)) {
      errors.push(
        `Invalid relationship. Must be one of: ${validRelationships.join(", ")}`,
      );
    }

    // Share validation
    if (data.share_percentage !== undefined) {
      if (data.share_percentage < 0 || data.share_percentage > 100) {
        errors.push("Share percentage must be between 0 and 100");
      }
    }

    if (data.share_amount !== undefined && data.share_amount < 0) {
      errors.push("Share amount cannot be negative");
    }

    // Distribution frequency validation
    const validFrequencies = [
      "MONTHLY",
      "QUARTERLY",
      "BIANNUALLY",
      "ANNUALLY",
      "ON_DEMAND",
    ];
    if (
      data.distribution_frequency &&
      !validFrequencies.includes(data.distribution_frequency)
    ) {
      errors.push(
        `Invalid distribution frequency. Must be one of: ${validFrequencies.join(", ")}`,
      );
    }

    // Status validation
    const validStatuses = ["ACTIVE", "SUSPENDED", "TERMINATED"];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push(
        `Invalid status. Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    // Date validation
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate > endDate) {
        errors.push("Start date cannot be after end date");
      }
    }

    return errors;
  }

  // Add beneficiary with validation
  async addBeneficiary(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    // Check if waqf exists and is active
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

    // Check if person exists
    const personSql = `
      SELECT * FROM persons 
      WHERE id = ? 
      AND deleted_at IS NULL
    `;

    const [person] = await this.executeQuery(personSql, [data.person_id]);
    if (!person) {
      throw new Error("Person not found");
    }

    // Check if beneficiary already exists for this waqf
    const existingSql = `
      SELECT * FROM ${this.tableName}
      WHERE waqf_id = ?
      AND person_id = ?
      AND deleted_at IS NULL
    `;

    const existing = await this.executeQuery(existingSql, [
      data.waqf_id,
      data.person_id,
    ]);
    if (existing.length > 0) {
      throw new Error("This person is already a beneficiary of this waqf");
    }

    const beneficiaryData = {
      ...data,
      created_by: userId,
      status: data.status || "ACTIVE",
      start_date: data.start_date || this.formatDate(new Date()),
    };

    return await this.create(beneficiaryData);
  }

  // Update beneficiary
  async updateBeneficiary(id, data) {
    const errors = this.validate(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    const beneficiary = await this.findById(id);
    if (!beneficiary) {
      throw new Error("Beneficiary not found");
    }

    return await this.update(id, data);
  }

  // Get beneficiary with details
  async getBeneficiaryWithDetails(id) {
    const beneficiary = await this.findById(id);
    if (!beneficiary) {
      throw new Error("Beneficiary not found");
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

    const [waqf] = await this.executeQuery(waqfSql, [beneficiary.waqf_id]);

    // Get person details
    const personSql = `
      SELECT 
        p.*,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM persons p
      WHERE p.id = ?
      AND p.deleted_at IS NULL
    `;

    const [person] = await this.executeQuery(personSql, [
      beneficiary.person_id,
    ]);

    // Get creator details
    let creator = null;
    if (beneficiary.created_by) {
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
        beneficiary.created_by,
      ]);
      creator = creatorResult;
    }

    // Get total distributions received
    const distributionsSql = `
      SELECT 
        COUNT(*) as distribution_count,
        SUM(amount) as total_received
      FROM waqf_transactions
      WHERE waqf_id = ?
      AND beneficiary_id = ?
      AND transaction_type = 'DISTRIBUTION'
      AND deleted_at IS NULL
    `;

    const [distributions] = await this.executeQuery(distributionsSql, [
      beneficiary.waqf_id,
      beneficiary.person_id,
    ]);

    // Get last distribution
    const lastDistributionSql = `
      SELECT * FROM waqf_transactions
      WHERE waqf_id = ?
      AND beneficiary_id = ?
      AND transaction_type = 'DISTRIBUTION'
      AND deleted_at IS NULL
      ORDER BY transaction_date DESC
      LIMIT 1
    `;

    const [lastDistribution] = await this.executeQuery(lastDistributionSql, [
      beneficiary.waqf_id,
      beneficiary.person_id,
    ]);

    return {
      ...beneficiary,
      waqf: waqf || null,
      person: person || null,
      creator: creator || null,
      statistics: {
        distribution_count: distributions?.distribution_count || 0,
        total_received: distributions?.total_received || 0,
        last_distribution: lastDistribution || null,
      },
    };
  }

  // Get beneficiaries by waqf
  async getBeneficiariesByWaqf(waqfId, options = {}) {
    const { activeOnly = true, page = 1, limit = 20 } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        wb.*,
        p.full_name_arabic,
        p.full_name_english,
        p.birth_date,
        p.gender,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        (
          SELECT SUM(amount) 
          FROM waqf_transactions wt 
          WHERE wt.waqf_id = wb.waqf_id 
          AND wt.beneficiary_id = wb.person_id 
          AND wt.transaction_type = 'DISTRIBUTION'
          AND wt.deleted_at IS NULL
        ) as total_received
      FROM ${this.tableName} wb
      INNER JOIN persons p ON wb.person_id = p.id
      WHERE wb.waqf_id = ?
      AND wb.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;

    const params = [waqfId];

    if (activeOnly) {
      sql += ' AND wb.status = "ACTIVE"';
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += " ORDER BY wb.share_percentage DESC, p.full_name_arabic ASC";
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const data = await this.executeQuery(sql, params);
    const processedData = data.map((record) => this.processResult(record));

    // Calculate total shares for percentage calculation
    const totalSharesSql = `
      SELECT 
        SUM(share_percentage) as total_percentage,
        SUM(share_amount) as total_amount
      FROM ${this.tableName}
      WHERE waqf_id = ?
      AND status = 'ACTIVE'
      AND deleted_at IS NULL
    `;

    const [totalShares] = await this.executeQuery(totalSharesSql, [waqfId]);

    return {
      data: processedData,
      total_shares: totalShares,
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

  // Get beneficiaries by person
  async getBeneficiariesByPerson(personId) {
    const sql = `
      SELECT 
        wb.*,
        fw.name_arabic as waqf_name_arabic,
        fw.name_english as waqf_name_english,
        fw.current_value,
        fw.estimated_annual_return
      FROM ${this.tableName} wb
      INNER JOIN family_waqf fw ON wb.waqf_id = fw.waqf_id
      WHERE wb.person_id = ?
      AND wb.status = 'ACTIVE'
      AND wb.deleted_at IS NULL
      AND fw.deleted_at IS NULL
      ORDER BY fw.name_arabic ASC
    `;

    const results = await this.executeQuery(sql, [personId]);
    return results.map((record) => this.processResult(record));
  }

  // Calculate expected annual distribution
  async calculateExpectedAnnualDistribution(waqfId, beneficiaryId) {
    const beneficiary = await this.findByWaqfAndPerson(waqfId, beneficiaryId);
    if (!beneficiary) {
      throw new Error("Beneficiary not found");
    }

    // Get waqf estimated annual return
    const waqfSql = `
      SELECT estimated_annual_return 
      FROM family_waqf 
      WHERE waqf_id = ?
      AND deleted_at IS NULL
    `;

    const [waqf] = await this.executeQuery(waqfSql, [waqfId]);

    if (!waqf || !waqf.estimated_annual_return) {
      return 0;
    }

    let expectedAnnual = 0;

    if (beneficiary.share_percentage) {
      expectedAnnual =
        (waqf.estimated_annual_return * beneficiary.share_percentage) / 100;
    } else if (beneficiary.share_amount) {
      // Convert to annual based on distribution frequency
      const frequencyMultiplier = {
        MONTHLY: 12,
        QUARTERLY: 4,
        BIANNUALLY: 2,
        ANNUALLY: 1,
        ON_DEMAND: 0,
      };

      const multiplier =
        frequencyMultiplier[beneficiary.distribution_frequency] || 0;
      expectedAnnual = beneficiary.share_amount * multiplier;
    }

    return expectedAnnual;
  }

  // Find beneficiary by waqf and person
  async findByWaqfAndPerson(waqfId, personId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE waqf_id = ?
      AND person_id = ?
      AND deleted_at IS NULL
      LIMIT 1
    `;

    const results = await this.executeQuery(sql, [waqfId, personId]);
    return results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Update beneficiary status
  async updateBeneficiaryStatus(id, status, reason = "") {
    const beneficiary = await this.findById(id);
    if (!beneficiary) {
      throw new Error("Beneficiary not found");
    }

    const updateData = { status };

    if (reason) {
      updateData.special_conditions = {
        ...(beneficiary.special_conditions || {}),
        status_change_reason: reason,
        status_changed_at: this.formatDate(new Date()),
      };
    }

    return await this.update(id, updateData);
  }

  // Get beneficiaries requiring distribution
  async getBeneficiariesRequiringDistribution(waqfId, distributionPeriod) {
    let dateCondition = "";
    switch (distributionPeriod) {
      case "MONTHLY":
        dateCondition = "DATE_SUB(CURDATE(), INTERVAL 1 MONTH)";
        break;
      case "QUARTERLY":
        dateCondition = "DATE_SUB(CURDATE(), INTERVAL 3 MONTH)";
        break;
      case "BIANNUALLY":
        dateCondition = "DATE_SUB(CURDATE(), INTERVAL 6 MONTH)";
        break;
      case "ANNUALLY":
        dateCondition = "DATE_SUB(CURDATE(), INTERVAL 1 YEAR)";
        break;
      default:
        return [];
    }

    const sql = `
      SELECT 
        wb.*,
        p.full_name_arabic,
        p.full_name_english,
        (
          SELECT MAX(transaction_date)
          FROM waqf_transactions wt
          WHERE wt.waqf_id = wb.waqf_id
          AND wt.beneficiary_id = wb.person_id
          AND wt.transaction_type = 'DISTRIBUTION'
          AND wt.deleted_at IS NULL
        ) as last_distribution_date
      FROM ${this.tableName} wb
      INNER JOIN persons p ON wb.person_id = p.id
      WHERE wb.waqf_id = ?
      AND wb.status = 'ACTIVE'
      AND wb.distribution_frequency = ?
      AND wb.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND (
        (
          SELECT MAX(transaction_date)
          FROM waqf_transactions wt
          WHERE wt.waqf_id = wb.waqf_id
          AND wt.beneficiary_id = wb.person_id
          AND wt.transaction_type = 'DISTRIBUTION'
          AND wt.deleted_at IS NULL
        ) IS NULL
        OR (
          SELECT MAX(transaction_date)
          FROM waqf_transactions wt
          WHERE wt.waqf_id = wb.waqf_id
          AND wt.beneficiary_id = wb.person_id
          AND wt.transaction_type = 'DISTRIBUTION'
          AND wt.deleted_at IS NULL
        ) < ${dateCondition}
      )
      ORDER BY wb.share_percentage DESC
    `;

    const results = await this.executeQuery(sql, [waqfId, distributionPeriod]);
    return results.map((record) => this.processResult(record));
  }
}

export default WaqfBeneficiary;
