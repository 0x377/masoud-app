import BaseModel from '../BaseModel.js';

class ReconciliationCase extends BaseModel {
  constructor() {
    super('reconciliation_cases', 'case_id');
    this.jsonFields = ['documents', 'metadata'];
  }

  // Case types
  static CASE_TYPES = {
    FAMILY_DISPUTE: 'FAMILY_DISPUTE',
    FINANCIAL_DISPUTE: 'FINANCIAL_DISPUTE',
    INHERITANCE: 'INHERITANCE',
    MARITAL: 'MARITAL',
    BUSINESS: 'BUSINESS',
    OTHER: 'OTHER'
  };

  // Case statuses
  static CASE_STATUSES = {
    NEW: 'NEW',
    ASSIGNED: 'ASSIGNED',
    IN_PROGRESS: 'IN_PROGRESS',
    MEDIATION: 'MEDIATION',
    SETTLED: 'SETTLED',
    DISMISSED: 'DISMISSED',
    ESCALATED: 'ESCALATED'
  };

  // Priority levels
  static PRIORITY_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    URGENT: 'URGENT'
  };

  // Confidentiality levels
  static CONFIDENTIALITY_LEVELS = {
    LOW: 'LOW',
    MEDIUM: 'MEDIUM',
    HIGH: 'HIGH',
    TOP_SECRET: 'TOP_SECRET'
  };

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate) {
      if (!data.title_arabic) {
        errors.push('Arabic case title is required');
      }
      if (!data.case_type) {
        errors.push('Case type is required');
      }
      if (!data.filing_date) {
        errors.push('Filing date is required');
      }
    }

    // Case type validation
    if (data.case_type && !Object.values(ReconciliationCase.CASE_TYPES).includes(data.case_type)) {
      errors.push(`Invalid case type. Must be one of: ${Object.values(ReconciliationCase.CASE_TYPES).join(', ')}`);
    }

    // Status validation
    if (data.status && !Object.values(ReconciliationCase.CASE_STATUSES).includes(data.status)) {
      errors.push(`Invalid status. Must be one of: ${Object.values(ReconciliationCase.CASE_STATUSES).join(', ')}`);
    }

    // Priority validation
    if (data.priority && !Object.values(ReconciliationCase.PRIORITY_LEVELS).includes(data.priority)) {
      errors.push(`Invalid priority. Must be one of: ${Object.values(ReconciliationCase.PRIORITY_LEVELS).join(', ')}`);
    }

    // Confidential level validation
    if (data.confidential_level && !Object.values(ReconciliationCase.CONFIDENTIALITY_LEVELS).includes(data.confidential_level)) {
      errors.push(`Invalid confidential level. Must be one of: ${Object.values(ReconciliationCase.CONFIDENTIALITY_LEVELS).join(', ')}`);
    }

    // Check if plaintiff and defendant are different
    if (data.plaintiff_id && data.defendant_id && data.plaintiff_id === data.defendant_id) {
      errors.push('Plaintiff and defendant cannot be the same person');
    }

    // Settlement validation
    if (data.settlement_date && data.filing_date) {
      const filingDate = new Date(data.filing_date);
      const settlementDate = new Date(data.settlement_date);
      if (settlementDate < filingDate) {
        errors.push('Settlement date cannot be before filing date');
      }
    }

    // Settlement amount validation
    if (data.settlement_amount && data.settlement_amount < 0) {
      errors.push('Settlement amount cannot be negative');
    }

    return errors;
  }

  // Generate case number
  async generateCaseNumber(caseType) {
    const prefixMap = {
      'FAMILY_DISPUTE': 'FD',
      'FINANCIAL_DISPUTE': 'FI',
      'INHERITANCE': 'IN',
      'MARITAL': 'MA',
      'BUSINESS': 'BU',
      'OTHER': 'OT'
    };

    const prefix = prefixMap[caseType] || 'RC';
    const year = new Date().getFullYear();
    
    // Get last case number for this type and year
    const sql = `
      SELECT case_number FROM ${this.tableName}
      WHERE case_number LIKE ?
      ORDER BY case_number DESC
      LIMIT 1
    `;
    
    const [lastCase] = await this.executeQuery(sql, [`${prefix}-${year}-%`]);
    
    let sequence = 1;
    if (lastCase && lastCase.case_number) {
      const lastSequence = parseInt(lastCase.case_number.split('-')[2]) || 0;
      sequence = lastSequence + 1;
    }
    
    return `${prefix}-${year}-${sequence.toString().padStart(4, '0')}`;
  }

  // Create case with validation
  async createCase(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if plaintiff exists
    if (data.plaintiff_id) {
      const plaintiffSql = `
        SELECT * FROM persons 
        WHERE person_id = ? 
        AND deleted_at IS NULL
      `;
      
      const [plaintiff] = await this.executeQuery(plaintiffSql, [data.plaintiff_id]);
      if (!plaintiff) {
        throw new Error('Plaintiff not found');
      }
    }

    // Check if defendant exists
    if (data.defendant_id) {
      const defendantSql = `
        SELECT * FROM persons 
        WHERE person_id = ? 
        AND deleted_at IS NULL
      `;
      
      const [defendant] = await this.executeQuery(defendantSql, [data.defendant_id]);
      if (!defendant) {
        throw new Error('Defendant not found');
      }
    }

    // Check if mediator exists
    if (data.mediator_id) {
      const mediatorSql = `
        SELECT * FROM persons 
        WHERE person_id = ? 
        AND deleted_at IS NULL
      `;
      
      const [mediator] = await this.executeQuery(mediatorSql, [data.mediator_id]);
      if (!mediator) {
        throw new Error('Mediator not found');
      }
    }

    // Generate case number
    const caseNumber = await this.generateCaseNumber(data.case_type);

    const caseData = {
      ...data,
      case_number: caseNumber,
      created_by: userId,
      status: data.status || 'NEW',
      priority: data.priority || 'MEDIUM',
      confidential_level: data.confidential_level || 'MEDIUM',
      follow_up_required: data.follow_up_required || false,
      documents: data.documents || [],
      metadata: data.metadata || {}
    };

    return await this.create(caseData);
  }

  // Get case with full details
  async getCaseWithDetails(caseId) {
    const caseRecord = await this.findById(caseId);
    if (!caseRecord) {
      throw new Error('Case not found');
    }

    // Get plaintiff details
    let plaintiff = null;
    if (caseRecord.plaintiff_id) {
      const plaintiffSql = `
        SELECT 
          p.*,
          u.email as user_email
        FROM persons p
        LEFT JOIN users u ON p.person_id = u.person_id
        WHERE p.person_id = ?
        AND p.deleted_at IS NULL
      `;
      
      const [plaintiffResult] = await this.executeQuery(plaintiffSql, [caseRecord.plaintiff_id]);
      plaintiff = plaintiffResult;
    }

    // Get defendant details
    let defendant = null;
    if (caseRecord.defendant_id) {
      const defendantSql = `
        SELECT 
          p.*,
          u.email as user_email
        FROM persons p
        LEFT JOIN users u ON p.person_id = u.person_id
        WHERE p.person_id = ?
        AND p.deleted_at IS NULL
      `;
      
      const [defendantResult] = await this.executeQuery(defendantSql, [caseRecord.defendant_id]);
      defendant = defendantResult;
    }

    // Get mediator details
    let mediator = null;
    if (caseRecord.mediator_id) {
      const mediatorSql = `
        SELECT 
          p.*,
          u.email as user_email,
          u.user_type
        FROM persons p
        LEFT JOIN users u ON p.person_id = u.person_id
        WHERE p.person_id = ?
        AND p.deleted_at IS NULL
      `;
      
      const [mediatorResult] = await this.executeQuery(mediatorSql, [caseRecord.mediator_id]);
      mediator = mediatorResult;
    }

    // Get case sessions
    const CaseSession = (await import('./CaseSession.js')).default;
    const sessionModel = new CaseSession();
    const sessions = await sessionModel.getCaseSessions(caseId);

    // Get case timeline
    const timeline = await this.getCaseTimeline(caseId);

    // Calculate case duration
    const filingDate = new Date(caseRecord.filing_date);
    const endDate = caseRecord.settlement_date 
      ? new Date(caseRecord.settlement_date)
      : new Date();
    
    const durationDays = Math.ceil((endDate - filingDate) / (1000 * 60 * 60 * 24));

    // Get related cases (if any)
    const relatedCases = await this.getRelatedCases(caseRecord);

    return {
      ...caseRecord,
      plaintiff: plaintiff,
      defendant: defendant,
      mediator: mediator,
      sessions: sessions,
      timeline: timeline,
      duration_days: durationDays,
      related_cases: relatedCases
    };
  }

  // Update case status
  async updateCaseStatus(caseId, newStatus, notes = '', userId) {
    const caseRecord = await this.findById(caseId);
    if (!caseRecord) {
      throw new Error('Case not found');
    }

    const validStatuses = Object.values(ReconciliationCase.CASE_STATUSES);
    if (!validStatuses.includes(newStatus)) {
      throw new Error(`Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const updateData = {
      status: newStatus,
      updated_at: this.formatDate(new Date())
    };

    // Add status change to notes
    if (notes) {
      const statusNote = `[Status Change: ${newStatus}] ${new Date().toISOString()}: ${notes}\n${caseRecord.notes || ''}`;
      updateData.notes = statusNote;
    }

    // Set settlement date if status is SETTLED
    if (newStatus === 'SETTLED' && !caseRecord.settlement_date) {
      updateData.settlement_date = this.formatDate(new Date());
    }

    // Update follow-up if needed
    if (newStatus === 'SETTLED' && caseRecord.follow_up_required && !caseRecord.follow_up_date) {
      const followUpDate = new Date();
      followUpDate.setDate(followUpDate.getDate() + 30); // 30 days later
      updateData.follow_up_date = this.formatDate(followUpDate);
    }

    return await this.update(caseId, updateData);
  }

  // Assign mediator
  async assignMediator(caseId, mediatorId, userId) {
    const caseRecord = await this.findById(caseId);
    if (!caseRecord) {
      throw new Error('Case not found');
    }

    // Check if mediator exists
    const mediatorSql = `
      SELECT * FROM persons 
      WHERE person_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [mediator] = await this.executeQuery(mediatorSql, [mediatorId]);
    if (!mediator) {
      throw new Error('Mediator not found');
    }

    // Check mediator workload
    const workloadSql = `
      SELECT COUNT(*) as active_cases 
      FROM reconciliation_cases
      WHERE mediator_id = ?
      AND status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'MEDIATION')
      AND deleted_at IS NULL
    `;
    
    const [workload] = await this.executeQuery(workloadSql, [mediatorId]);
    
    if (workload.active_cases >= 10) { // Max 10 active cases per mediator
      throw new Error('Mediator has too many active cases');
    }

    const updateData = {
      mediator_id: mediatorId,
      status: 'ASSIGNED',
      updated_at: this.formatDate(new Date())
    };

    // Add assignment note
    const assignmentNote = `[Mediator Assigned] ${new Date().toISOString()}: Assigned to mediator ${mediatorId}\n${caseRecord.notes || ''}`;
    updateData.notes = assignmentNote;

    return await this.update(caseId, updateData);
  }

  // Settle case
  async settleCase(caseId, settlementData, userId) {
    const caseRecord = await this.findById(caseId);
    if (!caseRecord) {
      throw new Error('Case not found');
    }

    const { settlement_amount, settlement_terms, settlement_date } = settlementData;

    const updateData = {
      status: 'SETTLED',
      settlement_amount: settlement_amount || null,
      settlement_terms: settlement_terms || '',
      settlement_date: settlement_date || this.formatDate(new Date()),
      updated_at: this.formatDate(new Date())
    };

    // Add settlement note
    const settlementNote = `[Case Settled] ${new Date().toISOString()}: ${settlement_terms || 'Settlement reached'}\n${caseRecord.notes || ''}`;
    updateData.notes = settlementNote;

    // Set follow-up if needed
    if (settlementData.follow_up_required) {
      updateData.follow_up_required = true;
      const followUpDate = new Date(updateData.settlement_date);
      followUpDate.setDate(followUpDate.getDate() + 30); // 30 days later
      updateData.follow_up_date = this.formatDate(followUpDate);
    }

    return await this.update(caseId, updateData);
  }

  // Search cases
  async searchCases(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      includeDetails = false
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        rc.*,
        p1.full_name_arabic as plaintiff_name,
        p1.full_name_english as plaintiff_name_en,
        p2.full_name_arabic as defendant_name,
        p2.full_name_english as defendant_name_en,
        p3.full_name_arabic as mediator_name,
        p3.full_name_english as mediator_name_en
      FROM ${this.tableName} rc
      LEFT JOIN persons p1 ON rc.plaintiff_id = p1.person_id
      LEFT JOIN persons p2 ON rc.defendant_id = p2.person_id
      LEFT JOIN persons p3 ON rc.mediator_id = p3.person_id
      WHERE rc.deleted_at IS NULL
    `;
    
    const params = [];

    // Apply filters
    if (filters.case_type) {
      sql += ' AND rc.case_type = ?';
      params.push(filters.case_type);
    }

    if (filters.status) {
      sql += ' AND rc.status = ?';
      params.push(filters.status);
    }

    if (filters.priority) {
      sql += ' AND rc.priority = ?';
      params.push(filters.priority);
    }

    if (filters.mediator_id) {
      sql += ' AND rc.mediator_id = ?';
      params.push(filters.mediator_id);
    }

    if (filters.plaintiff_id) {
      sql += ' AND rc.plaintiff_id = ?';
      params.push(filters.plaintiff_id);
    }

    if (filters.defendant_id) {
      sql += ' AND rc.defendant_id = ?';
      params.push(filters.defendant_id);
    }

    if (filters.filing_date_from) {
      sql += ' AND rc.filing_date >= ?';
      params.push(filters.filing_date_from);
    }

    if (filters.filing_date_to) {
      sql += ' AND rc.filing_date <= ?';
      params.push(filters.filing_date_to);
    }

    if (filters.settlement_date_from) {
      sql += ' AND rc.settlement_date >= ?';
      params.push(filters.settlement_date_from);
    }

    if (filters.settlement_date_to) {
      sql += ' AND rc.settlement_date <= ?';
      params.push(filters.settlement_date_to);
    }

    if (filters.search) {
      sql += ' AND (rc.title_arabic LIKE ? OR rc.title_english LIKE ? OR rc.case_number LIKE ?)';
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }

    // Confidentiality filter based on user role
    if (filters.user_role && filters.user_role !== 'admin') {
      sql += ' AND rc.confidential_level IN ("LOW", "MEDIUM")';
    }

    // Sort
    sql += ' ORDER BY rc.priority DESC, rc.filing_date DESC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const cases = await this.executeQuery(sql, params);
    let processedCases = cases.map(record => this.processResult(record));

    // Include details if requested
    if (includeDetails) {
      const detailedCases = [];
      for (const caseRecord of processedCases) {
        try {
          const details = await this.getCaseWithDetails(caseRecord.case_id);
          detailedCases.push(details);
        } catch (error) {
          console.error(`Error getting details for case ${caseRecord.case_id}:`, error);
          detailedCases.push(caseRecord);
        }
      }
      processedCases = detailedCases;
    }

    return {
      cases: processedCases,
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

  // Get case statistics
  async getCaseStatistics(filters = {}) {
    let sql = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'NEW' THEN 1 END) as new_cases,
        COUNT(CASE WHEN status = 'ASSIGNED' THEN 1 END) as assigned_cases,
        COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as in_progress_cases,
        COUNT(CASE WHEN status = 'MEDIATION' THEN 1 END) as mediation_cases,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_cases,
        COUNT(CASE WHEN status = 'DISMISSED' THEN 1 END) as dismissed_cases,
        COUNT(CASE WHEN status = 'ESCALATED' THEN 1 END) as escalated_cases,
        AVG(settlement_amount) as avg_settlement_amount,
        MIN(filing_date) as oldest_case,
        MAX(filing_date) as newest_case
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;
    
    const params = [];

    // Apply filters
    if (filters.case_type) {
      sql += ' AND case_type = ?';
      params.push(filters.case_type);
    }

    if (filters.filing_date_from) {
      sql += ' AND filing_date >= ?';
      params.push(filters.filing_date_from);
    }

    if (filters.filing_date_to) {
      sql += ' AND filing_date <= ?';
      params.push(filters.filing_date_to);
    }

    const [stats] = await this.executeQuery(sql, params);

    // Get case type distribution
    const typeSql = `
      SELECT 
        case_type,
        COUNT(*) as count,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled,
        AVG(DATEDIFF(COALESCE(settlement_date, CURDATE()), filing_date)) as avg_duration_days
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
      ${filters.filing_date_from ? 'AND filing_date >= ?' : ''}
      ${filters.filing_date_to ? 'AND filing_date <= ?' : ''}
      GROUP BY case_type
      ORDER BY count DESC
    `;
    
    const typeParams = [];
    if (filters.filing_date_from) typeParams.push(filters.filing_date_from);
    if (filters.filing_date_to) typeParams.push(filters.filing_date_to);
    
    const typeStats = await this.executeQuery(typeSql, typeParams);

    // Get mediator performance
    const mediatorSql = `
      SELECT 
        p.full_name_arabic as mediator_name,
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_cases,
        AVG(DATEDIFF(COALESCE(settlement_date, CURDATE()), filing_date)) as avg_duration_days
      FROM ${this.tableName} rc
      INNER JOIN persons p ON rc.mediator_id = p.person_id
      WHERE rc.deleted_at IS NULL
      AND rc.mediator_id IS NOT NULL
      ${filters.filing_date_from ? 'AND rc.filing_date >= ?' : ''}
      ${filters.filing_date_to ? 'AND rc.filing_date <= ?' : ''}
      GROUP BY rc.mediator_id
      ORDER BY settled_cases DESC
      LIMIT 10
    `;
    
    const mediatorStats = await this.executeQuery(mediatorSql, typeParams);

    return {
      summary: stats || {},
      type_distribution: typeStats,
      mediator_performance: mediatorStats
    };
  }

  // Get cases requiring follow-up
  async getCasesRequiringFollowUp() {
    const sql = `
      SELECT 
        rc.*,
        DATEDIFF(rc.follow_up_date, CURDATE()) as days_until_follow_up,
        p1.full_name_arabic as plaintiff_name,
        p2.full_name_arabic as defendant_name
      FROM ${this.tableName} rc
      LEFT JOIN persons p1 ON rc.plaintiff_id = p1.person_id
      LEFT JOIN persons p2 ON rc.defendant_id = p2.person_id
      WHERE rc.follow_up_required = TRUE
      AND rc.follow_up_date IS NOT NULL
      AND rc.follow_up_date >= CURDATE()
      AND rc.status = 'SETTLED'
      AND rc.deleted_at IS NULL
      ORDER BY rc.follow_up_date ASC
    `;
    
    return await this.executeQuery(sql);
  }

  // Get case timeline
  async getCaseTimeline(caseId) {
    const timeline = [];

    // Get case record
    const caseRecord = await this.findById(caseId);
    if (!caseRecord) {
      return timeline;
    }

    // Add filing event
    timeline.push({
      date: caseRecord.filing_date,
      event: 'CASE_FILED',
      title: 'Case Filed',
      description: `Case ${caseRecord.case_number} filed`,
      data: {
        title: caseRecord.title_arabic,
        type: caseRecord.case_type,
        priority: caseRecord.priority
      }
    });

    // Get status changes from notes
    if (caseRecord.notes) {
      const noteLines = caseRecord.notes.split('\n');
      noteLines.forEach(line => {
        const statusMatch = line.match(/\[Status Change: (\w+)\]/);
        if (statusMatch) {
          const dateMatch = line.match(/(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)/);
          const descMatch = line.match(/:\s*(.+)$/);
          
          if (dateMatch) {
            timeline.push({
              date: dateMatch[1],
              event: 'STATUS_CHANGE',
              title: `Status Changed to ${statusMatch[1]}`,
              description: descMatch ? descMatch[1] : '',
              data: { new_status: statusMatch[1] }
            });
          }
        }
      });
    }

    // Get sessions
    const CaseSession = (await import('./CaseSession.js')).default;
    const sessionModel = new CaseSession();
    const sessions = await sessionModel.getCaseSessions(caseId);
    
    sessions.forEach(session => {
      timeline.push({
        date: session.session_date,
        event: 'SESSION',
        title: `${session.session_type} Session`,
        description: session.discussion_summary?.substring(0, 100) + '...' || '',
        data: {
          session_type: session.session_type,
          location: session.location,
          attendees_count: session.attendees?.length || 0
        }
      });
    });

    // Add settlement event if settled
    if (caseRecord.settlement_date) {
      timeline.push({
        date: caseRecord.settlement_date,
        event: 'SETTLED',
        title: 'Case Settled',
        description: `Case settled with amount: ${caseRecord.settlement_amount || 'N/A'}`,
        data: {
          settlement_amount: caseRecord.settlement_amount,
          settlement_terms: caseRecord.settlement_terms
        }
      });
    }

    // Sort by date
    timeline.sort((a, b) => new Date(a.date) - new Date(b.date));

    return timeline;
  }

  // Get related cases
  async getRelatedCases(caseRecord) {
    const relatedCases = [];

    // Find cases with same plaintiff or defendant
    if (caseRecord.plaintiff_id || caseRecord.defendant_id) {
      const sql = `
        SELECT 
          case_id,
          case_number,
          title_arabic,
          case_type,
          status,
          filing_date
        FROM ${this.tableName}
        WHERE case_id != ?
        AND (
          plaintiff_id = ? OR 
          defendant_id = ? OR
          plaintiff_id = ? OR
          defendant_id = ?
        )
        AND deleted_at IS NULL
        ORDER BY filing_date DESC
        LIMIT 5
      `;
      
      const params = [
        caseRecord.case_id,
        caseRecord.plaintiff_id,
        caseRecord.plaintiff_id,
        caseRecord.defendant_id,
        caseRecord.defendant_id
      ];
      
      const results = await this.executeQuery(sql, params);
      relatedCases.push(...results);
    }

    return relatedCases;
  }

  // Get mediator workload
  async getMediatorWorkload(mediatorId) {
    const sql = `
      SELECT 
        status,
        COUNT(*) as case_count
      FROM ${this.tableName}
      WHERE mediator_id = ?
      AND deleted_at IS NULL
      GROUP BY status
      ORDER BY 
        CASE status 
          WHEN 'NEW' THEN 1
          WHEN 'ASSIGNED' THEN 2
          WHEN 'IN_PROGRESS' THEN 3
          WHEN 'MEDIATION' THEN 4
          WHEN 'SETTLED' THEN 5
          WHEN 'DISMISSED' THEN 6
          WHEN 'ESCALATED' THEN 7
          ELSE 8
        END
    `;
    
    const workload = await this.executeQuery(sql, [mediatorId]);

    // Get average handling time
    const avgTimeSql = `
      SELECT 
        AVG(DATEDIFF(COALESCE(settlement_date, CURDATE()), filing_date)) as avg_days
      FROM ${this.tableName}
      WHERE mediator_id = ?
      AND deleted_at IS NULL
      AND status IN ('SETTLED', 'DISMISSED')
    `;
    
    const [avgTime] = await this.executeQuery(avgTimeSql, [mediatorId]);

    // Get success rate
    const successSql = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_cases
      FROM ${this.tableName}
      WHERE mediator_id = ?
      AND deleted_at IS NULL
    `;
    
    const [success] = await this.executeQuery(successSql, [mediatorId]);

    return {
      workload_by_status: workload,
      average_handling_days: Math.round(avgTime.avg_days || 0),
      success_rate: success.total_cases > 0 
        ? ((success.settled_cases / success.total_cases) * 100).toFixed(2)
        : 0,
      total_active_cases: workload.reduce((sum, w) => {
        const activeStatuses = ['NEW', 'ASSIGNED', 'IN_PROGRESS', 'MEDIATION'];
        return activeStatuses.includes(w.status) ? sum + w.case_count : sum;
      }, 0)
    };
  }
}

export default ReconciliationCase;
