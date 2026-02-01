import BaseModel from '../BaseModel.js';

class ExecutivePosition extends BaseModel {
  constructor() {
    super('executive_positions', 'position_id');
    this.jsonFields = ['requirements', 'benefits', 'metadata'];
  }

  // Pre-defined executive positions
  static POSITIONS = {
    EXECUTIVE_DIRECTOR: {
      level: 1,
      arabic: 'المدير التنفيذي',
      english: 'Executive Director'
    },
    DEPUTY_DIRECTOR: {
      level: 2,
      arabic: 'نائب المدير',
      english: 'Deputy Director'
    },
    SECRETARY_GENERAL: {
      level: 3,
      arabic: 'الأمين العام',
      english: 'Secretary General'
    },
    TREASURER: {
      level: 4,
      arabic: 'أمين الصندوق',
      english: 'Treasurer'
    },
    DEPARTMENT_HEAD: {
      level: 5,
      arabic: 'رئيس القسم',
      english: 'Department Head'
    }
  };

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate) {
      if (!data.position_arabic) {
        errors.push('Arabic position title is required');
      }
      if (!data.position_level) {
        errors.push('Position level is required');
      }
    }

    if (data.position_level && (data.position_level < 1 || data.position_level > 10)) {
      errors.push('Position level must be between 1 and 10');
    }

    if (data.min_salary && data.max_salary && data.min_salary > data.max_salary) {
      errors.push('Minimum salary cannot be greater than maximum salary');
    }

    return errors;
  }

  // Create position with validation
  async createPosition(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const positionData = {
      ...data,
      created_by: userId,
      is_active: data.is_active !== undefined ? data.is_active : true,
      requirements: data.requirements || [],
      benefits: data.benefits || [],
      metadata: data.metadata || {}
    };

    return await this.create(positionData);
  }

  // Get available positions (not currently filled)
  async getAvailablePositions(department = null) {
    let sql = `
      SELECT 
        p.*,
        (SELECT COUNT(*) FROM executive_management 
         WHERE position_arabic = p.position_arabic 
         AND is_current = TRUE 
         AND deleted_at IS NULL) as currently_filled
      FROM ${this.tableName} p
      WHERE p.is_active = TRUE
      AND p.deleted_at IS NULL
    `;
    
    const params = [];

    if (department) {
      sql += ' AND p.department = ?';
      params.push(department);
    }

    sql += ' ORDER BY p.position_level';

    const positions = await this.executeQuery(sql, params);
    
    return positions
      .filter(pos => pos.currently_filled < pos.required_count || pos.required_count === 0)
      .map(record => this.processResult(record));
  }

  // Get position statistics
  async getPositionStatistics() {
    const sql = `
      SELECT 
        p.position_level,
        p.position_arabic,
        p.position_english,
        COUNT(DISTINCT e.executive_id) as currently_filled,
        p.required_count,
        (p.required_count - COUNT(DISTINCT e.executive_id)) as vacancies,
        AVG(TIMESTAMPDIFF(YEAR, e.start_date, COALESCE(e.end_date, CURDATE()))) as avg_tenure
      FROM ${this.tableName} p
      LEFT JOIN executive_management e ON p.position_arabic = e.position_arabic 
        AND e.is_current = TRUE 
        AND e.deleted_at IS NULL
      WHERE p.deleted_at IS NULL
      AND p.is_active = TRUE
      GROUP BY p.position_id, p.position_arabic, p.position_english, p.position_level, p.required_count
      ORDER BY p.position_level
    `;
    
    return await this.executeQuery(sql);
  }
}

export default ExecutivePosition;
