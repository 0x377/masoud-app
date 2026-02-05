import BaseModel from '../../libs/BaseModel.js';

class WaqfManagementCommittee extends BaseModel {
  constructor() {
    super('waqf_management_committee', 'committee_id');
    this.jsonFields = ['responsibilities', 'meeting_attendance', 'metadata'];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.waqf_id) {
        errors.push('Waqf ID is required');
      }
      if (!data.person_id) {
        errors.push('Person ID is required');
      }
      if (!data.start_date) {
        errors.push('Start date is required');
      }
      if (!data.role) {
        errors.push('Role is required');
      }
    }

    // Role validation
    const validRoles = ['CHAIRPERSON', 'VICE_CHAIRPERSON', 'TREASURER', 'SECRETARY', 'MEMBER', 'AUDITOR', 'ADVISOR'];
    if (data.role && !validRoles.includes(data.role)) {
      errors.push(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Date validation
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate > endDate) {
        errors.push('Start date cannot be after end date');
      }
    }

    return errors;
  }

  // Add committee member
  async addCommitteeMember(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if waqf exists
    const waqfSql = `
      SELECT * FROM family_waqf 
      WHERE waqf_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [waqf] = await this.executeQuery(waqfSql, [data.waqf_id]);
    if (!waqf) {
      throw new Error('Waqf not found');
    }

    // Check if person exists
    const personSql = `
      SELECT * FROM persons 
      WHERE id = ? 
      AND deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [data.person_id]);
    if (!person) {
      throw new Error('Person not found');
    }

    // Check for duplicate role (only one person per role per waqf)
    if (data.role !== 'MEMBER' && data.role !== 'ADVISOR') {
      const duplicateRoleSql = `
        SELECT * FROM ${this.tableName}
        WHERE waqf_id = ?
        AND role = ?
        AND is_active = TRUE
        AND deleted_at IS NULL
      `;
      
      const duplicate = await this.executeQuery(duplicateRoleSql, [data.waqf_id, data.role]);
      if (duplicate.length > 0) {
        throw new Error(`Role ${data.role} is already assigned to another person for this waqf`);
      }
    }

    const committeeData = {
      ...data,
      created_by: userId,
      is_active: data.is_active !== undefined ? data.is_active : true
    };

    return await this.create(committeeData);
  }

  // Get committee member with details
  async getCommitteeMemberWithDetails(id) {
    const member = await this.findById(id);
    if (!member) {
      throw new Error('Committee member not found');
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
    
    const [waqf] = await this.executeQuery(waqfSql, [member.waqf_id]);

    // Get person details
    const personSql = `
      SELECT 
        p.*,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        u.email as user_email,
        u.user_type
      FROM persons p
      LEFT JOIN users u ON p.id = u.person_id
      WHERE p.id = ?
      AND p.deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [member.person_id]);

    // Get creator details
    let creator = null;
    if (member.created_by) {
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
      
      const [creatorResult] = await this.executeQuery(creatorSql, [member.created_by]);
      creator = creatorResult;
    }

    // Get meeting attendance statistics
    const attendanceStats = member.meeting_attendance || {};
    const totalMeetings = Object.keys(attendanceStats).length;
    const attendedMeetings = Object.values(attendanceStats).filter(status => status === 'ATTENDED').length;
    const attendanceRate = totalMeetings > 0 ? (attendedMeetings / totalMeetings) * 100 : 0;

    return {
      ...member,
      waqf: waqf || null,
      person: person || null,
      creator: creator || null,
      attendance_stats: {
        total_meetings: totalMeetings,
        attended_meetings: attendedMeetings,
        attendance_rate: attendanceRate
      }
    };
  }

  // Get committee by waqf
  async getCommitteeByWaqf(waqfId, options = {}) {
    const {
      activeOnly = true,
      includeInactive = false
    } = options;

    let sql = `
      SELECT 
        wc.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        u.email as user_email
      FROM ${this.tableName} wc
      INNER JOIN persons p ON wc.person_id = p.id
      LEFT JOIN users u ON p.id = u.person_id
      WHERE wc.waqf_id = ?
      AND wc.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;
    
    const params = [waqfId];

    if (activeOnly && !includeInactive) {
      sql += ' AND wc.is_active = TRUE';
    }

    sql += ` ORDER BY 
      CASE wc.role 
        WHEN "CHAIRPERSON" THEN 1
        WHEN "VICE_CHAIRPERSON" THEN 2
        WHEN "TREASURER" THEN 3
        WHEN "SECRETARY" THEN 4
        WHEN "AUDITOR" THEN 5
        WHEN "ADVISOR" THEN 6
        WHEN "MEMBER" THEN 7
        ELSE 8
      END,
      wc.start_date DESC`;

    const results = await this.executeQuery(sql, params);
    return results.map(record => this.processResult(record));
  }

  // Update committee member status
  async updateCommitteeMemberStatus(id, isActive, endDate = null) {
    const member = await this.findById(id);
    if (!member) {
      throw new Error('Committee member not found');
    }

    const updateData = { is_active: isActive };
    
    if (endDate) {
      updateData.end_date = endDate;
    } else if (!isActive && !member.end_date) {
      updateData.end_date = this.formatDate(new Date());
    }

    return await this.update(id, updateData);
  }

  // Record meeting attendance
  async recordMeetingAttendance(waqfId, meetingDate, attendanceRecords) {
    const committeeMembers = await this.getCommitteeByWaqf(waqfId, { activeOnly: true });
    
    const updates = [];
    for (const member of committeeMembers) {
      const attendance = attendanceRecords[member.person_id] || 'ABSENT';
      
      const meetingAttendance = member.meeting_attendance || {};
      meetingAttendance[meetingDate] = attendance;
      
      updates.push(
        this.update(member.committee_id, {
          meeting_attendance: meetingAttendance
        })
      );
    }
    
    await Promise.all(updates);
    return true;
  }

  // Get committee statistics
  async getCommitteeStatistics(waqfId) {
    const sql = `
      SELECT 
        COUNT(*) as total_members,
        COUNT(CASE WHEN is_active = TRUE THEN 1 END) as active_members,
        COUNT(CASE WHEN is_active = FALSE THEN 1 END) as inactive_members,
        COUNT(CASE WHEN role = 'CHAIRPERSON' THEN 1 END) as chairpersons,
        COUNT(CASE WHEN role = 'VICE_CHAIRPERSON' THEN 1 END) as vice_chairpersons,
        COUNT(CASE WHEN role = 'TREASURER' THEN 1 END) as treasurers,
        COUNT(CASE WHEN role = 'SECRETARY' THEN 1 END) as secretaries,
        COUNT(CASE WHEN role = 'AUDITOR' THEN 1 END) as auditors,
        COUNT(CASE WHEN role = 'ADVISOR' THEN 1 END) as advisors,
        COUNT(CASE WHEN role = 'MEMBER' THEN 1 END) as members,
        MIN(start_date) as earliest_start,
        MAX(COALESCE(end_date, CURDATE())) as latest_end
      FROM ${this.tableName}
      WHERE waqf_id = ?
      AND deleted_at IS NULL
    `;
    
    const results = await this.executeQuery(sql, [waqfId]);
    return results[0] || {};
  }

  // Find committee member by role
  async findCommitteeMemberByRole(waqfId, role) {
    const sql = `
      SELECT 
        wc.*,
        p.full_name_arabic,
        p.full_name_english
      FROM ${this.tableName} wc
      INNER JOIN persons p ON wc.person_id = p.id
      WHERE wc.waqf_id = ?
      AND wc.role = ?
      AND wc.is_active = TRUE
      AND wc.deleted_at IS NULL
      AND p.deleted_at IS NULL
      LIMIT 1
    `;
    
    const results = await this.executeQuery(sql, [waqfId, role]);
    return results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Get committee tenure summary
  async getCommitteeTenureSummary(waqfId) {
    const sql = `
      SELECT 
        role,
        COUNT(*) as total_members,
        AVG(DATEDIFF(COALESCE(end_date, CURDATE()), start_date)) as avg_tenure_days,
        MIN(DATEDIFF(COALESCE(end_date, CURDATE()), start_date)) as min_tenure_days,
        MAX(DATEDIFF(COALESCE(end_date, CURDATE()), start_date)) as max_tenure_days
      FROM ${this.tableName}
      WHERE waqf_id = ?
      AND deleted_at IS NULL
      GROUP BY role
      ORDER BY 
        CASE role 
          WHEN 'CHAIRPERSON' THEN 1
          WHEN 'VICE_CHAIRPERSON' THEN 2
          WHEN 'TREASURER' THEN 3
          WHEN 'SECRETARY' THEN 4
          WHEN 'AUDITOR' THEN 5
          WHEN 'ADVISOR' THEN 6
          WHEN 'MEMBER' THEN 7
          ELSE 8
        END
    `;
    
    const results = await this.executeQuery(sql, [waqfId]);
    return results;
  }
}

export default WaqfManagementCommittee;
