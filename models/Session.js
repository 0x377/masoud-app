import BaseModel from './BaseModel.js';
import crypto from 'crypto';
import db from '../database/database.js';

class Session extends BaseModel {
  constructor() {
    super('sessions', 'id');
    this.softDelete = false; // Sessions don't use soft delete
  }

  // Create session
  async createSession(userId, payload, deviceInfo = {}, ipAddress = null) {
    const sessionId = this.generateSessionId();
    
    const data = {
      id: sessionId,
      user_id: userId,
      ip_address: ipAddress,
      user_agent: deviceInfo.userAgent || null,
      payload: JSON.stringify(payload),
      last_activity: Math.floor(Date.now() / 1000),
      device_id: deviceInfo.deviceId || null,
      device_name: deviceInfo.deviceName || null,
      device_type: deviceInfo.deviceType || 'web',
      browser: deviceInfo.browser || null,
      browser_version: deviceInfo.browserVersion || null,
      platform: deviceInfo.platform || null,
      is_mobile: deviceInfo.isMobile || false,
      is_tablet: deviceInfo.isTablet || false,
      is_desktop: deviceInfo.isDesktop || false,
      country: deviceInfo.country || null,
      city: deviceInfo.city || null,
      latitude: deviceInfo.latitude || null,
      longitude: deviceInfo.longitude || null,
      login_at: this.formatDate(new Date()),
      last_seen_at: this.formatDate(new Date()),
      is_active: true
    };

    return await this.create(data);
  }

  // Generate session ID
  generateSessionId() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Find active session
  async findActiveSession(sessionId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE id = ?
      AND is_active = TRUE
      AND last_activity > ?
    `;

    // Sessions expire after 24 hours of inactivity
    const minLastActivity = Math.floor(Date.now() / 1000) - (24 * 60 * 60);
    
    const results = await db.query(sql, [sessionId, minLastActivity]);
    return results[0] || null;
  }

  // Update session activity
  async updateActivity(sessionId) {
    const sql = `
      UPDATE ${this.tableName}
      SET 
        last_activity = ?,
        last_seen_at = ?
      WHERE id = ?
      AND is_active = TRUE
    `;

    await db.query(sql, [
      Math.floor(Date.now() / 1000),
      this.formatDate(new Date()),
      sessionId
    ]);
  }

  // End session
  async endSession(sessionId) {
    await this.update(sessionId, {
      is_active: false,
      last_seen_at: this.formatDate(new Date())
    });
  }

  // End all user sessions
  async endAllUserSessions(userId, excludeSessionId = null) {
    let sql = `
      UPDATE ${this.tableName}
      SET is_active = FALSE
      WHERE user_id = ?
      AND is_active = TRUE
    `;

    const params = [userId];
    
    if (excludeSessionId) {
      sql += ' AND id != ?';
      params.push(excludeSessionId);
    }

    await db.query(sql, params);
  }

  // Get user sessions
  async getUserSessions(userId, activeOnly = true) {
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
    `;

    if (activeOnly) {
      sql += ' AND is_active = TRUE';
    }

    sql += ' ORDER BY last_activity DESC';

    return await db.query(sql, [userId]);
  }

  // Clean up expired sessions
  async cleanupExpiredSessions() {
    // Delete sessions inactive for more than 30 days
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE last_activity < ?
    `;

    const minLastActivity = Math.floor(Date.now() / 1000) - (30 * 24 * 60 * 60);
    const result = await db.query(sql, [minLastActivity]);
    return result.affectedRows || 0;
  }

  // Get session statistics
  async getSessionStats(userId = null) {
    let sql = '';
    const params = [];

    if (userId) {
      sql = `
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_sessions,
          MIN(login_at) as first_login,
          MAX(last_seen_at) as last_activity,
          AVG(TIMESTAMPDIFF(SECOND, login_at, last_seen_at)) as avg_session_duration
        FROM ${this.tableName}
        WHERE user_id = ?
      `;
      params.push(userId);
    } else {
      sql = `
        SELECT 
          COUNT(*) as total_sessions,
          SUM(CASE WHEN is_active = TRUE THEN 1 ELSE 0 END) as active_sessions,
          COUNT(DISTINCT user_id) as unique_users,
          MIN(login_at) as oldest_session,
          MAX(last_seen_at) as most_recent_activity,
          AVG(TIMESTAMPDIFF(SECOND, login_at, last_seen_at)) as avg_session_duration
        FROM ${this.tableName}
      `;
    }

    const results = await db.query(sql, params);
    return results[0] || {};
  }

  // Update device info
  async updateDeviceInfo(sessionId, deviceInfo) {
    const updates = {
      device_name: deviceInfo.deviceName,
      device_type: deviceInfo.deviceType,
      browser: deviceInfo.browser,
      browser_version: deviceInfo.browserVersion,
      platform: deviceInfo.platform,
      is_mobile: deviceInfo.isMobile,
      is_tablet: deviceInfo.isTablet,
      is_desktop: deviceInfo.isDesktop,
      country: deviceInfo.country,
      city: deviceInfo.city,
      latitude: deviceInfo.latitude,
      longitude: deviceInfo.longitude
    };

    // Remove null values
    Object.keys(updates).forEach(key => {
      if (updates[key] === null) delete updates[key];
    });

    if (Object.keys(updates).length > 0) {
      await this.update(sessionId, updates);
    }
  }

  // Check if session exists for user
  async hasActiveSession(userId, deviceId = null) {
    let sql = `
      SELECT COUNT(*) as count 
      FROM ${this.tableName}
      WHERE user_id = ?
      AND is_active = TRUE
    `;

    const params = [userId];
    
    if (deviceId) {
      sql += ' AND device_id = ?';
      params.push(deviceId);
    }

    const results = await db.query(sql, params);
    return results[0]?.count > 0;
  }
}

export default Session;
