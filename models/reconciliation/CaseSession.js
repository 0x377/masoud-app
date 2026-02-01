import BaseModel from '../BaseModel.js';

class CaseSession extends BaseModel {
  constructor() {
    super('case_sessions', 'session_id');
    this.jsonFields = ['attendees', 'agreements', 'documents', 'metadata'];
  }

  // Session types
  static SESSION_TYPES = {
    INITIAL: 'INITIAL',
    MEDIATION: 'MEDIATION',
    SETTLEMENT: 'SETTLEMENT',
    FOLLOW_UP: 'FOLLOW_UP',
    OTHER: 'OTHER'
  };

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate) {
      if (!data.case_id) {
        errors.push('Case ID is required');
      }
      if (!data.session_date) {
        errors.push('Session date is required');
      }
    }

    // Session type validation
    if (data.session_type && !Object.values(CaseSession.SESSION_TYPES).includes(data.session_type)) {
      errors.push(`Invalid session type. Must be one of: ${Object.values(CaseSession.SESSION_TYPES).join(', ')}`);
    }

    // Date validation
    if (data.session_date && data.next_session_date) {
      const sessionDate = new Date(data.session_date);
      const nextSessionDate = new Date(data.next_session_date);
      if (nextSessionDate < sessionDate) {
        errors.push('Next session date cannot be before current session date');
      }
    }

    return errors;
  }

  // Create session with validation
  async createSession(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if case exists
    const caseSql = `
      SELECT * FROM reconciliation_cases 
      WHERE case_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [caseRecord] = await this.executeQuery(caseSql, [data.case_id]);
    if (!caseRecord) {
      throw new Error('Case not found');
    }

    // Verify attendees exist
    if (data.attendees && Array.isArray(data.attendees)) {
      for (const attendee of data.attendees) {
        if (attendee.person_id) {
          const personSql = `
            SELECT * FROM persons 
            WHERE person_id = ? 
            AND deleted_at IS NULL
          `;
          
          const [person] = await this.executeQuery(personSql, [attendee.person_id]);
          if (!person) {
            throw new Error(`Attendee with ID ${attendee.person_id} not found`);
          }
        }
      }
    }

    const sessionData = {
      ...data,
      created_by: userId,
      session_type: data.session_type || 'MEDIATION',
      attendees: data.attendees || [],
      agreements: data.agreements || [],
      documents: data.documents || [],
      metadata: data.metadata || {}
    };

    return await this.create(sessionData);
  }

  // Get session with details
  async getSessionWithDetails(sessionId) {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    // Get case details
    const caseSql = `
      SELECT 
        rc.*,
        p1.full_name_arabic as plaintiff_name,
        p2.full_name_arabic as defendant_name
      FROM reconciliation_cases rc
      LEFT JOIN persons p1 ON rc.plaintiff_id = p1.person_id
      LEFT JOIN persons p2 ON rc.defendant_id = p2.person_id
      WHERE rc.case_id = ?
      AND rc.deleted_at IS NULL
    `;
    
    const [caseRecord] = await this.executeQuery(caseSql, [session.case_id]);

    // Get attendee details
    const attendeesWithDetails = [];
    if (session.attendees && Array.isArray(session.attendees)) {
      for (const attendee of session.attendees) {
        if (attendee.person_id) {
          const personSql = `
            SELECT 
              p.*,
              u.email as user_email
            FROM persons p
            LEFT JOIN users u ON p.person_id = u.person_id
            WHERE p.person_id = ?
            AND p.deleted_at IS NULL
          `;
          
          const [person] = await this.executeQuery(personSql, [attendee.person_id]);
          if (person) {
            attendeesWithDetails.push({
              ...attendee,
              person_details: person
            });
          }
        }
      }
    }

    // Get creator details
    let creator = null;
    if (session.created_by) {
      const creatorSql = `
        SELECT 
          u.user_id,
          u.email,
          u.user_type,
          p.full_name_arabic,
          p.full_name_english
        FROM users u
        LEFT JOIN persons p ON u.person_id = p.person_id
        WHERE u.user_id = ?
        AND u.deleted_at IS NULL
      `;
      
      const [creatorResult] = await this.executeQuery(creatorSql, [session.created_by]);
      creator = creatorResult;
    }

    return {
      ...session,
      case: caseRecord,
      attendees: attendeesWithDetails,
      creator: creator
    };
  }

  // Get case sessions
  async getCaseSessions(caseId, sessionType = null) {
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE case_id = ?
      AND deleted_at IS NULL
    `;
    
    const params = [caseId];

    if (sessionType) {
      sql += ' AND session_type = ?';
      params.push(sessionType);
    }

    sql += ' ORDER BY session_date, session_time';

    const sessions = await this.executeQuery(sql, params);
    return sessions.map(record => this.processResult(record));
  }

  // Update session outcome
  async updateSessionOutcome(sessionId, outcomeData, userId) {
    const session = await this.findById(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    const { agreements, next_session_date, notes } = outcomeData;

    const updateData = {
      updated_at: this.formatDate(new Date())
    };

    if (agreements) {
      updateData.agreements = agreements;
    }

    if (next_session_date) {
      updateData.next_session_date = next_session_date;
    }

    if (notes) {
      const sessionNote = `[Session Outcome] ${new Date().toISOString()}: ${notes}\n${session.notes || ''}`;
      updateData.notes = sessionNote;
    }

    return await this.update(sessionId, updateData);
  }

  // Search sessions
  async searchSessions(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      includeDetails = false
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        cs.*,
        rc.case_number,
        rc.title_arabic as case_title,
        rc.title_english as case_title_en,
        rc.status as case_status
      FROM ${this.tableName} cs
      INNER JOIN reconciliation_cases rc ON cs.case_id = rc.case_id
      WHERE cs.deleted_at IS NULL
      AND rc.deleted_at IS NULL
    `;
    
    const params = [];

    // Apply filters
    if (filters.case_id) {
      sql += ' AND cs.case_id = ?';
      params.push(filters.case_id);
    }

    if (filters.session_type) {
      sql += ' AND cs.session_type = ?';
      params.push(filters.session_type);
    }

    if (filters.session_date_from) {
      sql += ' AND cs.session_date >= ?';
      params.push(filters.session_date_from);
    }

    if (filters.session_date_to) {
      sql += ' AND cs.session_date <= ?';
      params.push(filters.session_date_to);
    }

    if (filters.case_status) {
      sql += ' AND rc.status = ?';
      params.push(filters.case_status);
    }

    if (filters.search) {
      sql += ' AND (rc.case_number LIKE ? OR rc.title_arabic LIKE ? OR cs.discussion_summary LIKE ?)';
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }

    // Sort
    sql += ' ORDER BY cs.session_date DESC, cs.session_time DESC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const sessions = await this.executeQuery(sql, params);
    let processedSessions = sessions.map(record => this.processResult(record));

    // Include details if requested
    if (includeDetails) {
      const detailedSessions = [];
      for (const session of processedSessions) {
        try {
          const details = await this.getSessionWithDetails(session.session_id);
          detailedSessions.push(details);
        } catch (error) {
          console.error(`Error getting details for session ${session.session_id}:`, error);
          detailedSessions.push(session);
        }
      }
      processedSessions = detailedSessions;
    }

    return {
      sessions: processedSessions,
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

  // Get upcoming sessions
  async getUpcomingSessions(daysAhead = 7) {
    const today = new Date().toISOString().split('T')[0];
    const targetDate = new Date();
    targetDate.setDate(targetDate.getDate() + daysAhead);
    const targetDateStr = targetDate.toISOString().split('T')[0];

    const sql = `
      SELECT 
        cs.*,
        rc.case_number,
        rc.title_arabic as case_title,
        rc.priority as case_priority,
        p1.full_name_arabic as plaintiff_name,
        p2.full_name_arabic as defendant_name
      FROM ${this.tableName} cs
      INNER JOIN reconciliation_cases rc ON cs.case_id = rc.case_id
      LEFT JOIN persons p1 ON rc.plaintiff_id = p1.person_id
      LEFT JOIN persons p2 ON rc.defendant_id = p2.person_id
      WHERE cs.session_date BETWEEN ? AND ?
      AND cs.deleted_at IS NULL
      AND rc.deleted_at IS NULL
      ORDER BY cs.session_date, cs.session_time
    `;
    
    return await this.executeQuery(sql, [today, targetDateStr]);
  }

  // Get session statistics
  async getSessionStatistics(caseId = null, startDate = null, endDate = null) {
    let sql = `
      SELECT 
        COUNT(*) as total_sessions,
        session_type,
        COUNT(*) as count_by_type,
        AVG(TIMESTAMPDIFF(HOUR, CONCAT(session_date, ' ', session_time), created_at)) as avg_preparation_hours
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;
    
    const params = [];

    if (caseId) {
      sql += ' AND case_id = ?';
      params.push(caseId);
    }

    if (startDate) {
      sql += ' AND session_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      sql += ' AND session_date <= ?';
      params.push(endDate);
    }

    sql += ' GROUP BY session_type ORDER BY count_by_type DESC';

    return await this.executeQuery(sql, params);
  }
}

export default CaseSession;
