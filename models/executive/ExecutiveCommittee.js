import BaseModel from '../../libs/BaseModel.js';

class ExecutiveCommittee extends BaseModel {
  constructor() {
    super('executive_committees', 'id');
  }

  // Add executive to committee
  async addExecutiveToCommittee(executiveId, committeeId, roleInCommittee = 'MEMBER') {
    // Check if executive exists
    const executiveSql = `
      SELECT * FROM executive_management
      WHERE executive_id = ?
      AND deleted_at IS NULL
    `;
    
    const [executive] = await this.executeQuery(executiveSql, [executiveId]);
    if (!executive) {
      throw new Error('Executive not found');
    }

    // Check if committee exists
    const committeeSql = `
      SELECT * FROM committees
      WHERE committee_id = ?
      AND deleted_at IS NULL
    `;
    
    const [committee] = await this.executeQuery(committeeSql, [committeeId]);
    if (!committee) {
      throw new Error('Committee not found');
    }

    // Check if already a member
    const existingSql = `
      SELECT * FROM ${this.tableName}
      WHERE executive_id = ?
      AND committee_id = ?
      AND deleted_at IS NULL
    `;
    
    const existing = await this.executeQuery(existingSql, [executiveId, committeeId]);
    if (existing.length > 0) {
      throw new Error('Executive is already a member of this committee');
    }

    return await this.create({
      executive_id: executiveId,
      committee_id: committeeId,
      role_in_committee: roleInCommittee,
      join_date: this.formatDate(new Date())
    });
  }

  // Get executive committees
  async getExecutiveCommittees(executiveId) {
    const sql = `
      SELECT 
        ec.*,
        c.committee_name_arabic,
        c.committee_name_english,
        c.description,
        c.is_active,
        c.meeting_frequency
      FROM ${this.tableName} ec
      INNER JOIN committees c ON ec.committee_id = c.committee_id
      WHERE ec.executive_id = ?
      AND ec.deleted_at IS NULL
      AND c.deleted_at IS NULL
      ORDER BY c.is_active DESC, c.committee_name_arabic
    `;
    
    return await this.executeQuery(sql, [executiveId]);
  }
}

export default ExecutiveCommittee;
