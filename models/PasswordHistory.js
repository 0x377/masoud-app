import BaseModel from '../libs/BaseModel.js';
import db from '../database/database.js';

class PasswordHistory extends BaseModel {
  constructor() {
    super('password_history', 'id');
  }

  // Add password to history
  async addPassword(userId, passwordHash, changedByIp = null, changedByUser = null) {
    // Set all previous passwords as not current
    await this.clearCurrentFlag(userId);

    // Add new password
    const data = {
      user_id: userId,
      password_hash: passwordHash,
      changed_by_ip: changedByIp,
      changed_by_user: changedByUser,
      is_current: true
    };

    return await this.create(data);
  }

  // Clear current flag for user's passwords
  async clearCurrentFlag(userId) {
    const sql = `
      UPDATE ${this.tableName}
      SET is_current = FALSE
      WHERE user_id = ?
    `;

    await db.query(sql, [userId]);
  }

  // Check if password was used before
  async wasPasswordUsed(userId, passwordHash, lastN = 5) {
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE user_id = ?
      AND password_hash = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `;

    const results = await db.query(sql, [userId, passwordHash, lastN]);
    return results[0]?.count > 0;
  }

  // Get user password history
  async getUserHistory(userId, limit = 10) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      ORDER BY changed_at DESC
      LIMIT ?
    `;

    return await db.query(sql, [userId, limit]);
  }

  // Get current password
  async getCurrentPassword(userId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      AND is_current = TRUE
      ORDER BY changed_at DESC
      LIMIT 1
    `;

    const results = await db.query(sql, [userId]);
    return results[0] || null;
  }

  // Cleanup old password records
  async cleanupOldRecords(userId = null, keepLast = 10) {
    let sql = `
      DELETE ph1 FROM ${this.tableName} ph1
      LEFT JOIN (
        SELECT id 
        FROM ${this.tableName}
        WHERE 1=1
        ${userId ? 'AND user_id = ?' : ''}
        ORDER BY changed_at DESC
        LIMIT ?
      ) ph2 ON ph1.id = ph2.id
      WHERE ph2.id IS NULL
    `;

    const params = [];
    if (userId) {
      params.push(userId);
    }
    params.push(keepLast);

    const result = await db.query(sql, params);
    return result.affectedRows || 0;
  }

  // Get password change frequency
  async getChangeFrequency(userId) {
    const sql = `
      SELECT 
        COUNT(*) as total_changes,
        MIN(changed_at) as first_change,
        MAX(changed_at) as last_change,
        AVG(DATEDIFF(changed_at, LAG(changed_at) OVER (ORDER BY changed_at))) as avg_days_between_changes
      FROM ${this.tableName}
      WHERE user_id = ?
    `;

    const results = await db.query(sql, [userId]);
    return results[0] || {};
  }
}

export default PasswordHistory;
