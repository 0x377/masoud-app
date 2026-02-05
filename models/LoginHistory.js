import BaseModel from '../libs/BaseModel.js';
import db from '../database/database.js';

class LoginHistory extends BaseModel {
  constructor() {
    super('login_histories', 'id');
  }

  // Record login event
  async recordEvent(userId, eventType, details = {}) {
    const data = {
      user_id: userId,
      event_type: eventType,
      ip_address: details.ipAddress || null,
      user_agent: details.userAgent || null,
      device_id: details.deviceId || null,
      device_name: details.deviceName || null,
      device_type: details.deviceType || 'web',
      country: details.country || null,
      city: details.city || null,
      latitude: details.latitude || null,
      longitude: details.longitude || null,
      browser: details.browser || null,
      browser_version: details.browserVersion || null,
      platform: details.platform || null,
      details: details.details ? JSON.stringify(details.details) : null,
      is_suspicious: details.isSuspicious || false,
      suspicious_reason: details.suspiciousReason || null,
      related_session_id: details.sessionId || null,
      related_token_id: details.tokenId || null
    };

    return await this.create(data);
  }

  // Get user login history
  async getUserHistory(userId, options = {}) {
    const {
      page = 1,
      limit = 20,
      eventType = null,
      startDate = null,
      endDate = null,
      suspiciousOnly = false
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
    `;

    const params = [userId];

    if (eventType) {
      sql += ' AND event_type = ?';
      params.push(eventType);
    }

    if (startDate) {
      sql += ' AND created_at >= ?';
      params.push(this.formatDate(startDate));
    }

    if (endDate) {
      sql += ' AND created_at <= ?';
      params.push(this.formatDate(endDate));
    }

    if (suspiciousOnly) {
      sql += ' AND is_suspicious = TRUE';
    }

    sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await db.query(sql, params);
  }

  // Get suspicious activities
  async getSuspiciousActivities(options = {}) {
    const { page = 1, limit = 20, userId = null } = options;
    const offset = (page - 1) * limit;

    let sql = `
      SELECT lh.*, u.email, u.phone_number, p.full_name_arabic
      FROM ${this.tableName} lh
      INNER JOIN users u ON lh.user_id = u.id
      LEFT JOIN persons p ON u.person_id = p.id
      WHERE lh.is_suspicious = TRUE
    `;

    const params = [];

    if (userId) {
      sql += ' AND lh.user_id = ?';
      params.push(userId);
    }

    sql += ' ORDER BY lh.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    return await db.query(sql, params);
  }

  // Mark activity as suspicious
  async markAsSuspicious(activityId, reason) {
    await this.update(activityId, {
      is_suspicious: true,
      suspicious_reason: reason
    });
  }

  // Get login statistics
  async getLoginStats(userId = null, period = 'month') {
    let dateFormat;
    let interval;

    switch (period) {
      case 'day':
        dateFormat = '%Y-%m-%d %H:00';
        interval = '24 HOUR';
        break;
      case 'week':
        dateFormat = '%Y-%m-%d';
        interval = '7 DAY';
        break;
      case 'month':
        dateFormat = '%Y-%m-%d';
        interval = '30 DAY';
        break;
      default:
        dateFormat = '%Y-%m-%d';
        interval = '30 DAY';
    }

    let sql = `
      SELECT 
        DATE_FORMAT(created_at, ?) as period,
        COUNT(*) as total_logins,
        SUM(CASE WHEN event_type = 'LOGIN_SUCCESS' THEN 1 ELSE 0 END) as successful_logins,
        SUM(CASE WHEN event_type = 'LOGIN_FAILED' THEN 1 ELSE 0 END) as failed_logins,
        SUM(CASE WHEN is_suspicious = TRUE THEN 1 ELSE 0 END) as suspicious_logins
      FROM ${this.tableName}
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL ?)
    `;

    const params = [dateFormat, interval];

    if (userId) {
      sql += ' AND user_id = ?';
      params.push(userId);
    }

    sql += ' GROUP BY period ORDER BY period';

    return await db.query(sql, params);
  }

  // Get failed login attempts by IP
  async getFailedAttemptsByIP(ipAddress, hours = 24) {
    const sql = `
      SELECT COUNT(*) as attempts
      FROM ${this.tableName}
      WHERE ip_address = ?
      AND event_type = 'LOGIN_FAILED'
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
    `;

    const results = await db.query(sql, [ipAddress, hours]);
    return results[0]?.attempts || 0;
  }

  // Cleanup old records
  async cleanupOldRecords(days = 90) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `;

    const result = await db.query(sql, [days]);
    return result.affectedRows || 0;
  }

  // Get last successful login
  async getLastSuccessfulLogin(userId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      AND event_type = 'LOGIN_SUCCESS'
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const results = await db.query(sql, [userId]);
    return results[0] || null;
  }

  // Get concurrent logins
  async getConcurrentLogins(userId, timeWindowMinutes = 5) {
    const sql = `
      SELECT COUNT(DISTINCT ip_address) as concurrent_logins
      FROM ${this.tableName}
      WHERE user_id = ?
      AND event_type = 'LOGIN_SUCCESS'
      AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE)
    `;

    const results = await db.query(sql, [userId, timeWindowMinutes]);
    return results[0]?.concurrent_logins || 0;
  }
}

export default LoginHistory;
