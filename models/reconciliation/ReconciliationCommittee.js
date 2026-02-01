import BaseModel from '../BaseModel.js';

class ReconciliationCommittee extends BaseModel {
  constructor() {
    super('reconciliation_committee', 'committee_id');
    this.jsonFields = ['members', 'procedures', 'metadata'];
  }

  // Committee types
  static COMMITTEE_TYPES = {
    FAMILY_DISPUTE: 'FAMILY_DISPUTE',
    FINANCIAL: 'FINANCIAL',
    INHERITANCE: 'INHERITANCE',
    MARITAL: 'MARITAL',
    BUSINESS: 'BUSINESS',
    GENERAL: 'GENERAL'
  };

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate) {
      if (!data.name_arabic) {
        errors.push('Arabic committee name is required');
      }
    }

    // Success rate validation
    if (data.success_rate !== undefined) {
      if (data.success_rate < 0 || data.success_rate > 100) {
        errors.push('Success rate must be between 0 and 100');
      }
    }

    // Members validation
    if (data.members && !Array.isArray(data.members)) {
      errors.push('Members must be an array');
    }

    return errors;
  }

  // Create committee with validation
  async createCommittee(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if chairman exists
    if (data.chairman_id) {
      const chairmanSql = `
        SELECT * FROM persons 
        WHERE person_id = ? 
        AND deleted_at IS NULL
      `;
      
      const [chairman] = await this.executeQuery(chairmanSql, [data.chairman_id]);
      if (!chairman) {
        throw new Error('Chairman not found');
      }
    }

    // Check if members exist
    if (data.members && Array.isArray(data.members)) {
      for (const member of data.members) {
        if (member.person_id) {
          const memberSql = `
            SELECT * FROM persons 
            WHERE person_id = ? 
            AND deleted_at IS NULL
          `;
          
          const [person] = await this.executeQuery(memberSql, [member.person_id]);
          if (!person) {
            throw new Error(`Member with ID ${member.person_id} not found`);
          }
        }
      }
    }

    const committeeData = {
      ...data,
      created_by: userId,
      members: data.members || [],
      procedures: data.procedures || {},
      metadata: data.metadata || {}
    };

    return await this.create(committeeData);
  }

  // Get committee with full details
  async getCommitteeWithDetails(committeeId) {
    const committee = await this.findById(committeeId);
    if (!committee) {
      throw new Error('Committee not found');
    }

    // Get chairman details
    let chairman = null;
    if (committee.chairman_id) {
      const chairmanSql = `
        SELECT 
          p.*,
          u.email as user_email,
          u.user_type
        FROM persons p
        LEFT JOIN users u ON p.person_id = u.person_id
        WHERE p.person_id = ?
        AND p.deleted_at IS NULL
      `;
      
      const [chairmanResult] = await this.executeQuery(chairmanSql, [committee.chairman_id]);
      chairman = chairmanResult;
    }

    // Get member details
    const membersWithDetails = [];
    if (committee.members && Array.isArray(committee.members)) {
      for (const member of committee.members) {
        if (member.person_id) {
          const memberSql = `
            SELECT 
              p.*,
              u.email as user_email
            FROM persons p
            LEFT JOIN users u ON p.person_id = u.person_id
            WHERE p.person_id = ?
            AND p.deleted_at IS NULL
          `;
          
          const [memberDetails] = await this.executeQuery(memberSql, [member.person_id]);
          if (memberDetails) {
            membersWithDetails.push({
              ...member,
              person_details: memberDetails
            });
          }
        }
      }
    }

    // Get committee statistics
    const stats = await this.getCommitteeStatistics(committeeId);

    // Get active cases
    const activeCasesSql = `
      SELECT COUNT(*) as count FROM reconciliation_cases
      WHERE mediator_id IN (
        SELECT person_id FROM persons 
        WHERE person_id IN (?)
      )
      AND status IN ('NEW', 'ASSIGNED', 'IN_PROGRESS', 'MEDIATION')
      AND deleted_at IS NULL
    `;
    
    const memberIds = committee.members.map(m => m.person_id).concat(committee.chairman_id);
    const [activeCases] = await this.executeQuery(activeCasesSql, [memberIds]);

    return {
      ...committee,
      chairman: chairman,
      members: membersWithDetails,
      statistics: {
        ...stats,
        active_cases: activeCases?.count || 0
      }
    };
  }

  // Get committee statistics
  async getCommitteeStatistics(committeeId) {
    const committee = await this.findById(committeeId);
    if (!committee) {
      throw new Error('Committee not found');
    }

    // Get cases handled by committee members
    const memberIds = committee.members.map(m => m.person_id);
    if (committee.chairman_id) {
      memberIds.push(committee.chairman_id);
    }

    if (memberIds.length === 0) {
      return {
        total_cases: 0,
        settled_cases: 0,
        success_rate: 0,
        avg_settlement_days: 0
      };
    }

    const placeholders = memberIds.map(() => '?').join(',');
    const statsSql = `
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_cases,
        AVG(
          CASE WHEN settlement_date IS NOT NULL AND filing_date IS NOT NULL 
          THEN DATEDIFF(settlement_date, filing_date) 
          ELSE NULL 
          END
        ) as avg_settlement_days
      FROM reconciliation_cases
      WHERE mediator_id IN (${placeholders})
      AND deleted_at IS NULL
    `;
    
    const [stats] = await this.executeQuery(statsSql, memberIds);

    const successRate = stats.total_cases > 0 
      ? ((stats.settled_cases / stats.total_cases) * 100).toFixed(2)
      : 0;

    return {
      total_cases: stats.total_cases || 0,
      settled_cases: stats.settled_cases || 0,
      success_rate: parseFloat(successRate),
      avg_settlement_days: Math.round(stats.avg_settlement_days || 0)
    };
  }

  // Add member to committee
  async addMember(committeeId, memberData) {
    const committee = await this.findById(committeeId);
    if (!committee) {
      throw new Error('Committee not found');
    }

    // Check if person exists
    const personSql = `
      SELECT * FROM persons 
      WHERE person_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [memberData.person_id]);
    if (!person) {
      throw new Error('Person not found');
    }

    // Check if already a member
    const members = committee.members || [];
    const isAlreadyMember = members.some(m => m.person_id === memberData.person_id);
    
    if (isAlreadyMember) {
      throw new Error('Person is already a committee member');
    }

    // Add new member
    const newMember = {
      person_id: memberData.person_id,
      role: memberData.role || 'MEMBER',
      join_date: new Date().toISOString().split('T')[0],
      expertise: memberData.expertise || []
    };

    members.push(newMember);

    return await this.update(committeeId, {
      members: members,
      updated_at: this.formatDate(new Date())
    });
  }

  // Remove member from committee
  async removeMember(committeeId, personId) {
    const committee = await this.findById(committeeId);
    if (!committee) {
      throw new Error('Committee not found');
    }

    const members = committee.members || [];
    const updatedMembers = members.filter(m => m.person_id !== personId);

    // Cannot remove chairman
    if (committee.chairman_id === personId) {
      throw new Error('Cannot remove chairman. Assign a new chairman first.');
    }

    return await this.update(committeeId, {
      members: updatedMembers,
      updated_at: this.formatDate(new Date())
    });
  }

  // Update chairman
  async updateChairman(committeeId, chairmanId) {
    const committee = await this.findById(committeeId);
    if (!committee) {
      throw new Error('Committee not found');
    }

    // Check if person exists
    const personSql = `
      SELECT * FROM persons 
      WHERE person_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [chairmanId]);
    if (!person) {
      throw new Error('Person not found');
    }

    // Add to members if not already a member
    const members = committee.members || [];
    const isMember = members.some(m => m.person_id === chairmanId);
    
    if (!isMember) {
      members.push({
        person_id: chairmanId,
        role: 'CHAIRMAN',
        join_date: new Date().toISOString().split('T')[0]
      });
    }

    return await this.update(committeeId, {
      chairman_id: chairmanId,
      members: members,
      updated_at: this.formatDate(new Date())
    });
  }

  // Search committees
  async searchCommittees(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      includeStats = false
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        rc.*,
        p.full_name_arabic as chairman_name_arabic,
        p.full_name_english as chairman_name_english
      FROM ${this.tableName} rc
      LEFT JOIN persons p ON rc.chairman_id = p.person_id
      WHERE rc.deleted_at IS NULL
    `;
    
    const params = [];

    // Apply filters
    if (filters.name_arabic) {
      sql += ' AND rc.name_arabic LIKE ?';
      params.push(`%${filters.name_arabic}%`);
    }

    if (filters.chairman_id) {
      sql += ' AND rc.chairman_id = ?';
      params.push(filters.chairman_id);
    }

    if (filters.formation_date_from) {
      sql += ' AND rc.formation_date >= ?';
      params.push(filters.formation_date_from);
    }

    if (filters.formation_date_to) {
      sql += ' AND rc.formation_date <= ?';
      params.push(filters.formation_date_to);
    }

    if (filters.search) {
      sql += ' AND (rc.name_arabic LIKE ? OR rc.name_english LIKE ? OR rc.description LIKE ?)';
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`
      );
    }

    // Sort
    sql += ' ORDER BY rc.formation_date DESC, rc.created_at DESC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const committees = await this.executeQuery(sql, params);
    const processedCommittees = committees.map(record => this.processResult(record));

    // Include statistics if requested
    if (includeStats) {
      for (const committee of processedCommittees) {
        try {
          const stats = await this.getCommitteeStatistics(committee.committee_id);
          committee.statistics = stats;
        } catch (error) {
          console.error(`Error getting stats for committee ${committee.committee_id}:`, error);
          committee.statistics = {};
        }
      }
    }

    return {
      committees: processedCommittees,
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

  // Get committees with expiring terms (if applicable)
  async getCommitteesWithExpiringTerms(daysThreshold = 30) {
    const sql = `
      SELECT 
        rc.*,
        JSON_LENGTH(rc.members) as member_count,
        p.full_name_arabic as chairman_name
      FROM ${this.tableName} rc
      LEFT JOIN persons p ON rc.chairman_id = p.person_id
      WHERE rc.deleted_at IS NULL
      AND rc.members IS NOT NULL
      AND JSON_LENGTH(rc.members) > 0
      ORDER BY rc.formation_date DESC
    `;
    
    const committees = await this.executeQuery(sql);
    
    // Filter committees with members whose terms are expiring
    const expiringCommittees = [];
    
    for (const committee of committees) {
      const members = committee.members || [];
      const expiringMembers = members.filter(member => {
        if (!member.term_end_date) return false;
        
        const termEnd = new Date(member.term_end_date);
        const today = new Date();
        const daysRemaining = Math.ceil((termEnd - today) / (1000 * 60 * 60 * 24));
        
        return daysRemaining <= daysThreshold && daysRemaining > 0;
      });
      
      if (expiringMembers.length > 0) {
        expiringCommittees.push({
          ...committee,
          expiring_members: expiringMembers,
          expiring_count: expiringMembers.length
        });
      }
    }
    
    return expiringCommittees;
  }

  // Generate committee report
  async generateCommitteeReport(committeeId, startDate, endDate) {
    const committee = await this.getCommitteeWithDetails(committeeId);
    if (!committee) {
      throw new Error('Committee not found');
    }

    const memberIds = committee.members.map(m => m.person_id);
    if (committee.chairman_id) {
      memberIds.push(committee.chairman_id);
    }

    if (memberIds.length === 0) {
      return {
        committee: committee,
        report: {
          period: { start_date: startDate, end_date: endDate },
          cases: [],
          statistics: {}
        }
      };
    }

    const placeholders = memberIds.map(() => '?').join(',');
    
    // Get cases for the period
    const casesSql = `
      SELECT 
        rc.*,
        p1.full_name_arabic as plaintiff_name,
        p2.full_name_arabic as defendant_name
      FROM reconciliation_cases rc
      LEFT JOIN persons p1 ON rc.plaintiff_id = p1.person_id
      LEFT JOIN persons p2 ON rc.defendant_id = p2.person_id
      WHERE rc.mediator_id IN (${placeholders})
      AND rc.filing_date BETWEEN ? AND ?
      AND rc.deleted_at IS NULL
      ORDER BY rc.filing_date DESC
    `;
    
    const cases = await this.executeQuery(casesSql, [...memberIds, startDate, endDate]);

    // Get session statistics
    const sessionsSql = `
      SELECT 
        COUNT(*) as total_sessions,
        session_type,
        COUNT(*) as count_by_type
      FROM case_sessions cs
      INNER JOIN reconciliation_cases rc ON cs.case_id = rc.case_id
      WHERE rc.mediator_id IN (${placeholders})
      AND cs.session_date BETWEEN ? AND ?
      AND cs.deleted_at IS NULL
      GROUP BY session_type
    `;
    
    const sessionStats = await this.executeQuery(sessionsSql, [...memberIds, startDate, endDate]);

    // Calculate success rate for period
    const periodStats = await this.executeQuery(`
      SELECT 
        COUNT(*) as total_cases,
        COUNT(CASE WHEN status = 'SETTLED' THEN 1 END) as settled_cases,
        AVG(settlement_amount) as avg_settlement_amount
      FROM reconciliation_cases
      WHERE mediator_id IN (${placeholders})
      AND filing_date BETWEEN ? AND ?
      AND deleted_at IS NULL
    `, [...memberIds, startDate, endDate]);

    return {
      committee: committee,
      report: {
        period: { start_date: startDate, end_date: endDate },
        cases: cases,
        statistics: {
          total_cases: periodStats[0]?.total_cases || 0,
          settled_cases: periodStats[0]?.settled_cases || 0,
          success_rate: periodStats[0]?.total_cases > 0 
            ? ((periodStats[0].settled_cases / periodStats[0].total_cases) * 100).toFixed(2)
            : 0,
          avg_settlement_amount: periodStats[0]?.avg_settlement_amount || 0,
          session_stats: sessionStats
        }
      }
    };
  }
}

export default ReconciliationCommittee;
