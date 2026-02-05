import BaseModel from '../libs/BaseModel.js';
import db from '../database/database.js';

class UserPermission extends BaseModel {
  constructor() {
    super('user_permissions', 'id');
  }

  // Grant permission to user
  async grantPermission(userId, permission, options = {}) {
    const {
      restrictions = null,
      grantedBy = null,
      expiresAt = null,
      grantReason = null
    } = options;

    // Check if permission already exists
    const existing = await this.findUserPermission(userId, permission);
    
    if (existing) {
      // Update existing permission
      return await this.update(existing.id, {
        is_allowed: true,
        restrictions,
        expires_at: expiresAt ? this.formatDate(expiresAt) : null,
        grant_reason: grantReason
      });
    }

    // Create new permission
    return await this.create({
      user_id: userId,
      permission,
      is_allowed: true,
      restrictions,
      granted_by: grantedBy,
      expires_at: expiresAt ? this.formatDate(expiresAt) : null,
      grant_reason: grantReason
    });
  }

  // Revoke permission
  async revokePermission(userId, permission, revokedBy = null) {
    const permissionRecord = await this.findUserPermission(userId, permission);
    
    if (permissionRecord) {
      return await this.update(permissionRecord.id, {
        is_allowed: false,
        expires_at: this.formatDate(new Date()),
        grant_reason: `Revoked by ${revokedBy || 'system'}`
      });
    }
    
    return null;
  }

  // Find user permission
  async findUserPermission(userId, permission) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      AND permission = ?
      ORDER BY granted_at DESC
      LIMIT 1
    `;

    const results = await db.query(sql, [userId, permission]);
    return results[0] || null;
  }

  // Get all user permissions
  async getUserPermissions(userId, includeExpired = false, includeRevoked = false) {
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
    `;

    const conditions = [];
    if (!includeExpired) {
      conditions.push('(expires_at IS NULL OR expires_at > NOW())');
    }
    if (!includeRevoked) {
      conditions.push('is_allowed = TRUE');
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY permission ASC';

    return await db.query(sql, [userId]);
  }

  // Check if user has permission
  async hasPermission(userId, permission) {
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE user_id = ?
      AND permission = ?
      AND is_allowed = TRUE
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const results = await db.query(sql, [userId, permission]);
    return results[0]?.count > 0;
  }

  // Get users with specific permission
  async getUsersWithPermission(permission, options = {}) {
    const { includeExpired = false, includeRevoked = false } = options;
    
    let sql = `
      SELECT up.*, u.email, u.user_type, u.status, p.full_name_arabic
      FROM ${this.tableName} up
      INNER JOIN users u ON up.user_id = u.id
      LEFT JOIN persons p ON u.person_id = p.id
      WHERE up.permission = ?
    `;

    const conditions = [];
    if (!includeExpired) {
      conditions.push('(up.expires_at IS NULL OR up.expires_at > NOW())');
    }
    if (!includeRevoked) {
      conditions.push('up.is_allowed = TRUE');
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY up.granted_at DESC';

    return await db.query(sql, [permission]);
  }

  // Cleanup expired permissions
  async cleanupExpiredPermissions() {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
    `;

    const result = await db.query(sql);
    return result.affectedRows || 0;
  }

  // Bulk update permissions
  async bulkUpdatePermissions(userId, permissions) {
    // Start transaction
    return await db.transaction(async (connection) => {
      // Revoke all current permissions
      await connection.query(
        `UPDATE ${this.tableName} SET is_allowed = FALSE WHERE user_id = ?`,
        [userId]
      );

      // Grant new permissions
      for (const permission of permissions) {
        await this.grantPermission(userId, permission);
      }

      return true;
    });
  }

  // Get permission statistics
  async getPermissionStats() {
    const sql = `
      SELECT 
        COUNT(*) as total_grants,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT permission) as unique_permissions,
        SUM(CASE WHEN is_allowed = TRUE THEN 1 ELSE 0 END) as active_grants,
        SUM(CASE WHEN is_allowed = FALSE THEN 1 ELSE 0 END) as revoked_grants,
        SUM(CASE WHEN expires_at IS NOT NULL AND expires_at < NOW() THEN 1 ELSE 0 END) as expired_grants,
        MIN(granted_at) as first_grant,
        MAX(granted_at) as last_grant
      FROM ${this.tableName}
    `;

    const results = await db.query(sql);
    return results[0] || {};
  }
}

export default UserPermission;
