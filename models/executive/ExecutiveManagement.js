import BaseModel from '../../libs/BaseModel.js';

class ExecutiveManagement extends BaseModel {
  constructor() {
    super('executive_management', 'executive_id');
    this.jsonFields = ['responsibilities', 'decision_authority', 'metadata'];
  }

  // Position levels mapping
  static POSITION_LEVELS = {
    EXECUTIVE_DIRECTOR: 1,
    DEPUTY_DIRECTOR: 2,
    SECRETARY_GENERAL: 3,
    TREASURER: 4,
    DEPARTMENT_HEAD: 5,
    MANAGER: 6,
    ASSISTANT_DIRECTOR: 7,
    COORDINATOR: 8
  };

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields for creation
    if (!isUpdate) {
      if (!data.person_id) {
        errors.push('Person ID is required');
      }
      if (!data.position_arabic) {
        errors.push('Arabic position title is required');
      }
      if (!data.start_date) {
        errors.push('Start date is required');
      }
    }

    // Date validation
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate > endDate) {
        errors.push('Start date cannot be after end date');
      }
    }

    // Position level validation
    if (data.position_level) {
      if (data.position_level < 1 || data.position_level > 10) {
        errors.push('Position level must be between 1 and 10');
      }
    }

    // Email validation
    if (data.contact_email) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(data.contact_email)) {
        errors.push('Invalid email format');
      }
    }

    // Phone validation
    if (data.contact_phone) {
      const phoneRegex = /^[\d\s\+\-\(\)]{10,20}$/;
      if (!phoneRegex.test(data.contact_phone)) {
        errors.push('Invalid phone number format');
      }
    }

    // Check for self-reporting
    if (data.reporting_to && data.person_id && data.reporting_to === data.person_id) {
      errors.push('Cannot report to oneself');
    }

    return errors;
  }

  // Create executive with validation
  async createExecutive(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if person exists
    const personSql = `
      SELECT * FROM persons 
      WHERE person_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [data.person_id]);
    if (!person) {
      throw new Error('Person not found');
    }

    // Check if person already has an active executive position
    const existingSql = `
      SELECT * FROM ${this.tableName}
      WHERE person_id = ?
      AND is_current = TRUE
      AND deleted_at IS NULL
    `;
    
    const existing = await this.executeQuery(existingSql, [data.person_id]);
    if (existing.length > 0) {
      throw new Error('This person already has an active executive position');
    }

    // If reporting_to is provided, check if it exists
    if (data.reporting_to) {
      const reportingSql = `
        SELECT * FROM ${this.tableName}
        WHERE executive_id = ?
        AND is_current = TRUE
        AND deleted_at IS NULL
      `;
      
      const [reportingTo] = await this.executeQuery(reportingSql, [data.reporting_to]);
      if (!reportingTo) {
        throw new Error('Reporting executive not found or not active');
      }
    }

    // If assistant_id is provided, check if person exists
    if (data.assistant_id) {
      const [assistant] = await this.executeQuery(personSql, [data.assistant_id]);
      if (!assistant) {
        throw new Error('Assistant person not found');
      }
    }

    const executiveData = {
      ...data,
      created_by: userId,
      is_current: data.is_current !== undefined ? data.is_current : true,
      position_level: data.position_level || 1,
      responsibilities: data.responsibilities || [],
      decision_authority: data.decision_authority || {},
      metadata: data.metadata || {}
    };

    return await this.create(executiveData);
  }

  // Get executive with full details
  async getExecutiveWithDetails(executiveId) {
    const executive = await this.findById(executiveId);
    if (!executive) {
      throw new Error('Executive not found');
    }

    // Get person details
    const personSql = `
      SELECT 
        p.*,
        u.email as user_email,
        u.user_type
      FROM persons p
      LEFT JOIN users u ON p.person_id = u.person_id
      WHERE p.person_id = ?
      AND p.deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [executive.person_id]);

    // Get reporting executive details
    let reportingTo = null;
    if (executive.reporting_to) {
      const reportingSql = `
        SELECT 
          e.*,
          p.full_name_arabic,
          p.full_name_english,
          p.photo_path
        FROM ${this.tableName} e
        INNER JOIN persons p ON e.person_id = p.person_id
        WHERE e.executive_id = ?
        AND e.deleted_at IS NULL
      `;
      
      const [reportingResult] = await this.executeQuery(reportingSql, [executive.reporting_to]);
      reportingTo = reportingResult;
    }

    // Get assistant details
    let assistant = null;
    if (executive.assistant_id) {
      const assistantSql = `
        SELECT 
          p.*,
          em.position_arabic as assistant_position
        FROM persons p
        LEFT JOIN executive_management em ON p.person_id = em.person_id
        WHERE p.person_id = ?
        AND p.deleted_at IS NULL
      `;
      
      const [assistantResult] = await this.executeQuery(assistantSql, [executive.assistant_id]);
      assistant = assistantResult;
    }

    // Get subordinates (people who report to this executive)
    const subordinatesSql = `
      SELECT 
        e.*,
        p.full_name_arabic,
        p.full_name_english,
        p.photo_path
      FROM ${this.tableName} e
      INNER JOIN persons p ON e.person_id = p.person_id
      WHERE e.reporting_to = ?
      AND e.is_current = TRUE
      AND e.deleted_at IS NULL
    `;
    
    const subordinates = await this.executeQuery(subordinatesSql, [executiveId]);

    // Get committees this executive is part of
    const committeesSql = `
      SELECT 
        ec.*,
        c.committee_name_arabic,
        c.committee_name_english,
        cm.role_in_committee
      FROM executive_committees ec
      INNER JOIN committees c ON ec.committee_id = c.committee_id
      INNER JOIN committee_members cm ON ec.committee_id = cm.committee_id 
        AND ec.person_id = cm.person_id
      WHERE ec.executive_id = ?
      AND ec.deleted_at IS NULL
      AND c.is_active = TRUE
    `;
    
    const committees = await this.executeQuery(committeesSql, [executiveId]);

    // Get performance metrics (if available)
    const metricsSql = `
      SELECT 
        YEAR(evaluation_date) as year,
        AVG(overall_score) as avg_score,
        COUNT(*) as evaluations_count
      FROM executive_evaluations
      WHERE executive_id = ?
      GROUP BY YEAR(evaluation_date)
      ORDER BY year DESC
      LIMIT 3
    `;
    
    const performanceMetrics = await this.executeQuery(metricsSql, [executiveId]);

    return {
      ...executive,
      person: person || null,
      reporting_to: reportingTo,
      assistant: assistant,
      subordinates: subordinates,
      committees: committees,
      performance_metrics: performanceMetrics,
      hierarchy_level: await this.calculateHierarchyLevel(executiveId)
    };
  }

  // Update executive
  async updateExecutive(executiveId, data, userId) {
    const executive = await this.findById(executiveId);
    if (!executive) {
      throw new Error('Executive not found');
    }

    const errors = this.validate(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Special handling for end_date and is_current
    const updateData = { ...data };
    
    if (data.end_date && !executive.end_date) {
      // Setting end date for the first time
      updateData.is_current = false;
      updateData.end_date = data.end_date;
    } else if (data.end_date === null || data.end_date === '') {
      // Removing end date (re-activating)
      updateData.is_current = true;
      updateData.end_date = null;
    }

    // If making current, check if person has other current positions
    if (updateData.is_current === true && executive.person_id) {
      const currentSql = `
        SELECT * FROM ${this.tableName}
        WHERE person_id = ?
        AND executive_id != ?
        AND is_current = TRUE
        AND deleted_at IS NULL
      `;
      
      const [current] = await this.executeQuery(currentSql, [executive.person_id, executiveId]);
      if (current) {
        throw new Error('Person already has an active executive position');
      }
    }

    return await this.update(executiveId, {
      ...updateData,
      updated_at: this.formatDate(new Date())
    });
  }

  // Calculate hierarchy level
  async calculateHierarchyLevel(executiveId, maxDepth = 10) {
    let level = 0;
    let currentId = executiveId;
    
    for (let i = 0; i < maxDepth; i++) {
      const sql = `
        SELECT reporting_to FROM ${this.tableName}
        WHERE executive_id = ?
        AND deleted_at IS NULL
      `;
      
      const [result] = await this.executeQuery(sql, [currentId]);
      
      if (!result || !result.reporting_to || result.reporting_to === currentId) {
        break;
      }
      
      level++;
      currentId = result.reporting_to;
      
      // Prevent infinite loops
      if (level >= maxDepth) {
        break;
      }
    }
    
    return level;
  }

  // Get executives by department
  async getExecutivesByDepartment(department, options = {}) {
    const {
      isCurrent = true,
      positionLevel = null,
      page = 1,
      limit = 50
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        e.*,
        p.full_name_arabic,
        p.full_name_english,
        p.photo_path,
        TIMESTAMPDIFF(YEAR, e.start_date, COALESCE(e.end_date, CURDATE())) as tenure_years
      FROM ${this.tableName} e
      INNER JOIN persons p ON e.person_id = p.person_id
      WHERE e.department = ?
      AND e.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;
    
    const params = [department];

    if (isCurrent) {
      sql += ' AND e.is_current = TRUE';
    }

    if (positionLevel) {
      sql += ' AND e.position_level = ?';
      params.push(positionLevel);
    }

    sql += ' ORDER BY e.position_level, e.start_date DESC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const executives = await this.executeQuery(sql, params);
    const processedExecutives = executives.map(record => this.processResult(record));

    return {
      executives: processedExecutives,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1
      }
    };
  }

  // Get organizational hierarchy
  async getOrganizationalHierarchy(rootExecutiveId = null) {
    let rootSql = `
      SELECT executive_id FROM ${this.tableName}
      WHERE reporting_to IS NULL
      AND is_current = TRUE
      AND deleted_at IS NULL
      ORDER BY position_level
      LIMIT 1
    `;
    
    let rootId = rootExecutiveId;
    
    if (!rootId) {
      const [root] = await this.executeQuery(rootSql);
      rootId = root?.executive_id;
    }

    if (!rootId) {
      throw new Error('No root executive found');
    }

    // Recursive function to build hierarchy
    const buildHierarchy = async (executiveId) => {
      const executive = await this.getExecutiveWithDetails(executiveId);
      
      const sql = `
        SELECT executive_id FROM ${this.tableName}
        WHERE reporting_to = ?
        AND is_current = TRUE
        AND deleted_at IS NULL
        ORDER BY position_level, start_date
      `;
      
      const subordinates = await this.executeQuery(sql, [executiveId]);
      
      const children = [];
      for (const sub of subordinates) {
        const childHierarchy = await buildHierarchy(sub.executive_id);
        children.push(childHierarchy);
      }
      
      return {
        ...executive,
        children: children
      };
    };

    return await buildHierarchy(rootId);
  }

  // Search executives
  async searchExecutives(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      includeDetails = false
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        e.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        p.photo_path
      FROM ${this.tableName} e
      INNER JOIN persons p ON e.person_id = p.person_id
      WHERE e.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;
    
    const params = [];

    // Apply filters
    if (filters.is_current !== undefined) {
      sql += ' AND e.is_current = ?';
      params.push(filters.is_current);
    }

    if (filters.department) {
      sql += ' AND e.department = ?';
      params.push(filters.department);
    }

    if (filters.position_level) {
      sql += ' AND e.position_level = ?';
      params.push(filters.position_level);
    }

    if (filters.position_arabic) {
      sql += ' AND e.position_arabic LIKE ?';
      params.push(`%${filters.position_arabic}%`);
    }

    if (filters.search) {
      sql += ' AND (p.full_name_arabic LIKE ? OR p.full_name_english LIKE ? OR e.position_arabic LIKE ? OR e.position_english LIKE ?)';
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }

    if (filters.start_date_from) {
      sql += ' AND e.start_date >= ?';
      params.push(filters.start_date_from);
    }

    if (filters.start_date_to) {
      sql += ' AND e.start_date <= ?';
      params.push(filters.start_date_to);
    }

    // Sort
    sql += ' ORDER BY e.position_level, e.start_date DESC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const executives = await this.executeQuery(sql, params);
    let processedExecutives = executives.map(record => this.processResult(record));

    // Include details if requested
    if (includeDetails) {
      const detailedExecutives = [];
      for (const exec of processedExecutives) {
        try {
          const details = await this.getExecutiveWithDetails(exec.executive_id);
          detailedExecutives.push(details);
        } catch (error) {
          console.error(`Error getting details for executive ${exec.executive_id}:`, error);
          detailedExecutives.push(exec);
        }
      }
      processedExecutives = detailedExecutives;
    }

    return {
      executives: processedExecutives,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1
      }
    };
  }

  // Get executives with expiring terms
  async getExecutivesWithExpiringTerms(daysThreshold = 30) {
    const sql = `
      SELECT 
        e.*,
        p.full_name_arabic,
        p.full_name_english,
        p.contact_email,
        p.contact_phone,
        DATEDIFF(e.end_date, CURDATE()) as days_remaining
      FROM ${this.tableName} e
      INNER JOIN persons p ON e.person_id = p.person_id
      WHERE e.is_current = TRUE
      AND e.end_date IS NOT NULL
      AND e.end_date > CURDATE()
      AND DATEDIFF(e.end_date, CURDATE()) <= ?
      AND e.deleted_at IS NULL
      AND p.deleted_at IS NULL
      ORDER BY e.end_date ASC
    `;
    
    return await this.executeQuery(sql, [daysThreshold]);
  }

  // Get executive statistics
  async getExecutiveStatistics() {
    const sql = `
      SELECT 
        COUNT(*) as total_executives,
        COUNT(CASE WHEN is_current = TRUE THEN 1 END) as active_executives,
        COUNT(CASE WHEN gender = 'M' THEN 1 END) as male_executives,
        COUNT(CASE WHEN gender = 'F' THEN 1 END) as female_executives,
        COUNT(DISTINCT department) as total_departments,
        AVG(TIMESTAMPDIFF(YEAR, start_date, COALESCE(end_date, CURDATE()))) as avg_tenure_years,
        MIN(start_date) as earliest_start,
        MAX(COALESCE(end_date, CURDATE())) as latest_end
      FROM ${this.tableName} e
      INNER JOIN persons p ON e.person_id = p.person_id
      WHERE e.deleted_at IS NULL
    `;
    
    const [stats] = await this.executeQuery(sql);

    // Department-wise statistics
    const deptSql = `
      SELECT 
        department,
        COUNT(*) as count,
        COUNT(CASE WHEN gender = 'M' THEN 1 END) as males,
        COUNT(CASE WHEN gender = 'F' THEN 1 END) as females,
        AVG(TIMESTAMPDIFF(YEAR, start_date, COALESCE(end_date, CURDATE()))) as avg_tenure
      FROM ${this.tableName} e
      INNER JOIN persons p ON e.person_id = p.person_id
      WHERE e.deleted_at IS NULL
      AND e.department IS NOT NULL
      GROUP BY department
      ORDER BY count DESC
    `;
    
    const departmentStats = await this.executeQuery(deptSql);

    // Position level statistics
    const positionSql = `
      SELECT 
        position_level,
        COUNT(*) as count,
        AVG(TIMESTAMPDIFF(YEAR, start_date, COALESCE(end_date, CURDATE()))) as avg_tenure
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
      GROUP BY position_level
      ORDER BY position_level
    `;
    
    const positionStats = await this.executeQuery(positionSql);

    return {
      summary: stats || {},
      department_stats: departmentStats,
      position_stats: positionStats
    };
  }

  // Promote/demote executive
  async changeExecutivePosition(executiveId, newPositionLevel, newPositionArabic, effectiveDate, userId) {
    const executive = await this.findById(executiveId);
    if (!executive) {
      throw new Error('Executive not found');
    }

    // End current position
    await this.update(executiveId, {
      end_date: effectiveDate,
      is_current: false,
      updated_at: this.formatDate(new Date())
    });

    // Create new position
    const newPositionData = {
      person_id: executive.person_id,
      position_arabic: newPositionArabic,
      position_level: newPositionLevel,
      department: executive.department,
      start_date: effectiveDate,
      reporting_to: executive.reporting_to,
      responsibilities: executive.responsibilities,
      decision_authority: executive.decision_authority,
      office_location: executive.office_location,
      contact_email: executive.contact_email,
      contact_phone: executive.contact_phone,
      assistant_id: executive.assistant_id,
      metadata: {
        ...executive.metadata,
        promoted_from: executive.executive_id,
        promotion_date: new Date().toISOString()
      }
    };

    return await this.createExecutive(newPositionData, userId);
  }

  // Transfer executive to different department
  async transferExecutive(executiveId, newDepartment, effectiveDate, userId) {
    const executive = await this.findById(executiveId);
    if (!executive) {
      throw new Error('Executive not found');
    }

    // End current position
    await this.update(executiveId, {
      end_date: effectiveDate,
      is_current: false,
      updated_at: this.formatDate(new Date())
    });

    // Create new position in new department
    const transferData = {
      person_id: executive.person_id,
      position_arabic: executive.position_arabic,
      position_english: executive.position_english,
      position_level: executive.position_level,
      department: newDepartment,
      start_date: effectiveDate,
      reporting_to: executive.reporting_to,
      responsibilities: executive.responsibilities,
      decision_authority: executive.decision_authority,
      office_location: null, // Reset office location
      contact_email: executive.contact_email,
      contact_phone: executive.contact_phone,
      assistant_id: executive.assistant_id,
      metadata: {
        ...executive.metadata,
        transferred_from: executive.department,
        transfer_date: new Date().toISOString()
      }
    };

    return await this.createExecutive(transferData, userId);
  }

  // Get executive timeline
  async getExecutiveTimeline(personId) {
    const sql = `
      SELECT 
        *,
        TIMESTAMPDIFF(MONTH, start_date, COALESCE(end_date, CURDATE())) as duration_months
      FROM ${this.tableName}
      WHERE person_id = ?
      AND deleted_at IS NULL
      ORDER BY start_date DESC
    `;
    
    const positions = await this.executeQuery(sql, [personId]);
    
    // Calculate career progression
    let careerProgression = [];
    if (positions.length > 1) {
      for (let i = 0; i < positions.length - 1; i++) {
        const current = positions[i];
        const next = positions[i + 1];
        
        const progression = {
          from_position: next.position_arabic,
          to_position: current.position_arabic,
          from_date: next.start_date,
          to_date: current.start_date,
          duration_days: Math.floor(
            (new Date(current.start_date) - new Date(next.start_date)) / (1000 * 60 * 60 * 24)
          ),
          is_promotion: current.position_level < next.position_level,
          is_transfer: current.department !== next.department
        };
        
        careerProgression.push(progression);
      }
    }

    return {
      positions: positions.map(record => this.processResult(record)),
      career_progression: careerProgression,
      total_positions: positions.length,
      total_experience_years: positions.reduce((total, pos) => {
        const start = new Date(pos.start_date);
        const end = pos.end_date ? new Date(pos.end_date) : new Date();
        return total + (end.getFullYear() - start.getFullYear());
      }, 0)
    };
  }
}

export default ExecutiveManagement;
