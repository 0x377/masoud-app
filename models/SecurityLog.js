import BaseModel from './BaseModel.js';
import db from '../config/database.js';

class SecurityLog extends BaseModel {
  constructor() {
    super('security_logs', 'id');
  }

  // Log security event
  async logEvent(data) {
    const eventData = {
      user_id: data.userId || null,
      severity: data.severity || 'MEDIUM',
      action: data.action,
      description: data.description,
      ip_address: data.ipAddress || null,
      user_agent: data.userAgent || null,
      old_values: data.oldValues ? JSON.stringify(data.oldValues) : null,
      new_values: data.newValues ? JSON.stringify(data.newValues) : null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      affected_user_id: data.affectedUserId || null,
      affected_table: data.affectedTable || null,
      affected_record_id: data.affectedRecordId || null
    };

    return await this.create(eventData);
  }

  // Get security events
  async getEvents(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 50,
      severity = null,
      userId = null,
      affectedUserId = null,
      startDate = null,
      endDate = null
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        sl.*,
        u.email as user_email,
        u.user_type as user_type,
        au.email as affected_user_email
      FROM ${this.tableName} sl
      LEFT JOIN users u ON sl.user_id = u.id
      LEFT JOIN users au ON sl.affected_user_id = au.id
      WHERE 1=1
    `;

    const params = [];

    if (severity) {
      sql += ' AND sl.severity = ?';
      params.push(severity);
    }

    if (userId) {
      sql += ' AND sl.user_id = ?';
      params.push(userId);
    }

    if (affectedUserId) {
      sql += ' AND sl.affected_user_id = ?';
      params.push(affectedUserId);
    }

    if (startDate) {
      sql += ' AND sl.created_at >= ?';
      params.push(this.formatDate(startDate));
    }

    if (endDate) {
      sql += ' AND sl.created_at <= ?';
      params.push(this.formatDate(endDate));
    }

    // Apply additional filters
    if (filters.action) {
      sql += ' AND sl.action LIKE ?';
      params.push(`%${filters.action}%`);
    }

    if (filters.affectedTable) {
      sql += ' AND sl.affected_table = ?';
      params.push(filters.affectedTable);
    }

    // Get total count
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const countResult = await db.query(countSql, params);
    const total = countResult[0]?.total || 0;

    // Get data with pagination
    sql += ' ORDER BY sl.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const data = await db.query(sql, params);

    // Parse JSON fields
    const parsedData = data.map(record => {
      if (record.old_values) {
        try {
          record.old_values = JSON.parse(record.old_values);
        } catch {}
      }
      if (record.new_values) {
        try {
          record.new_values = JSON.parse(record.new_values);
        } catch {}
      }
      if (record.metadata) {
        try {
          record.metadata = JSON.parse(record.metadata);
        } catch {}
      }
      return record;
    });

    return {
      data: parsedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  // Get security statistics
  async getSecurityStats(days = 30) {
    const sql = `
      SELECT 
        COUNT(*) as total_events,
        SUM(CASE WHEN severity = 'CRITICAL' THEN 1 ELSE 0 END) as critical_events,
        SUM(CASE WHEN severity = 'HIGH' THEN 1 ELSE 0 END) as high_events,
        SUM(CASE WHEN severity = 'MEDIUM' THEN 1 ELSE 0 END) as medium_events,
        SUM(CASE WHEN severity = 'LOW' THEN 1 ELSE 0 END) as low_events,
        COUNT(DISTINCT user_id) as unique_users,
        COUNT(DISTINCT ip_address) as unique_ips,
        MIN(created_at) as first_event,
        MAX(created_at) as last_event
      FROM ${this.tableName}
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const results = await db.query(sql, [days]);
    return results[0] || {};
  }

  // Get events by action type
  async getEventsByAction(action, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE action = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    return await db.query(sql, [action, limit, offset]);
  }

  // Get events by affected table
  async getEventsByTable(tableName, options = {}) {
    const { page = 1, limit = 20 } = options;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE affected_table = ?
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `;

    return await db.query(sql, [tableName, limit, offset]);
  }

  // Cleanup old events
  async cleanupOldEvents(days = 365) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
      AND severity IN ('LOW', 'MEDIUM')
    `;

    const result = await db.query(sql, [days]);
    return result.affectedRows || 0;
  }

  // Log user activity change
  async logUserActivityChange(userId, action, oldValues, newValues, metadata = {}) {
    return await this.logEvent({
      userId,
      action,
      description: `User ${action}`,
      severity: 'MEDIUM',
      oldValues,
      newValues,
      metadata,
      affectedUserId: userId,
      affectedTable: 'users'
    });
  }

  // Log permission change
  async logPermissionChange(adminId, userId, permission, oldValue, newValue) {
    return await this.logEvent({
      userId: adminId,
      action: 'PERMISSION_CHANGE',
      description: `Changed permission ${permission} for user`,
      severity: 'HIGH',
      oldValues: { [permission]: oldValue },
      newValues: { [permission]: newValue },
      affectedUserId: userId,
      affectedTable: 'user_permissions'
    });
  }

  // Log failed access attempt
  async logFailedAccess(userId, action, resource, ipAddress = null) {
    return await this.logEvent({
      userId,
      action: 'ACCESS_DENIED',
      description: `Failed to access ${resource}`,
      severity: 'HIGH',
      ipAddress,
      metadata: { resource, action },
      affectedTable: resource
    });
  }
}

export default SecurityLog;
