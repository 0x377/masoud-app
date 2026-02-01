import BaseModel from './BaseModel.js';
import crypto from 'crypto';
import db from '../config/database.js';

class PersonalAccessToken extends BaseModel {
  constructor() {
    super('personal_access_tokens', 'id');
    this.softDelete = false; // Don't soft delete tokens
  }

  // Generate token
  generateToken() {
    return crypto.randomBytes(32).toString('hex');
  }

  // Create token for user
  async createToken(userId, name, abilities = ['*'], expiresInDays = 30) {
    const token = this.generateToken();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);

    const data = {
      tokenable_type: 'users',
      tokenable_id: userId,
      name,
      token,
      abilities: Array.isArray(abilities) ? abilities.join(',') : abilities,
      expires_at: this.formatDate(expiresAt),
      created_at: this.formatDate(new Date())
    };

    return await this.create(data);
  }

  // Find token
  async findToken(token, includeExpired = false) {
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE token = ?
      AND is_revoked = FALSE
    `;

    if (!includeExpired) {
      sql += ' AND (expires_at IS NULL OR expires_at > NOW())';
    }

    const results = await db.query(sql, [token]);
    return results[0] || null;
  }

  // Get user tokens
  async getUserTokens(userId, includeExpired = false, includeRevoked = false) {
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE tokenable_type = 'users'
      AND tokenable_id = ?
    `;

    const conditions = [];
    if (!includeExpired) {
      conditions.push('(expires_at IS NULL OR expires_at > NOW())');
    }
    if (!includeRevoked) {
      conditions.push('is_revoked = FALSE');
    }

    if (conditions.length > 0) {
      sql += ' AND ' + conditions.join(' AND ');
    }

    sql += ' ORDER BY created_at DESC';

    return await db.query(sql, [userId]);
  }

  // Revoke token
  async revokeToken(tokenId, revokedByIp = null, revokedByUser = null) {
    await this.update(tokenId, {
      is_revoked: true,
      revoked_at: this.formatDate(new Date()),
      revoked_by_ip: revokedByIp,
      revoked_by_user: revokedByUser
    });
  }

  // Revoke all user tokens
  async revokeAllUserTokens(userId, revokedByIp = null, revokedByUser = null) {
    const sql = `
      UPDATE ${this.tableName}
      SET 
        is_revoked = TRUE,
        revoked_at = ?,
        revoked_by_ip = ?,
        revoked_by_user = ?
      WHERE tokenable_type = 'users'
      AND tokenable_id = ?
      AND is_revoked = FALSE
    `;

    await db.query(sql, [
      this.formatDate(new Date()),
      revokedByIp,
      revokedByUser,
      userId
    ]);
  }

  // Update last used
  async updateLastUsed(tokenId, ipAddress = null, userAgent = null) {
    const updates = {
      last_used_at: this.formatDate(new Date())
    };

    if (ipAddress) updates.ip_address = ipAddress;
    if (userAgent) updates.user_agent = userAgent;

    await this.update(tokenId, updates);
  }

  // Check token validity
  async isValidToken(token) {
    const tokenRecord = await this.findToken(token);
    
    if (!tokenRecord) return false;
    if (tokenRecord.is_revoked) return false;
    if (tokenRecord.expires_at && new Date(tokenRecord.expires_at) < new Date()) return false;
    
    return true;
  }

  // Clean up expired tokens
  async cleanupExpiredTokens() {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE expires_at IS NOT NULL
      AND expires_at < NOW()
    `;

    const result = await db.query(sql);
    return result.affectedRows || 0;
  }

  // Get token with user info
  async getTokenWithUser(token) {
    const sql = `
      SELECT pat.*, u.*
      FROM ${this.tableName} pat
      INNER JOIN users u ON pat.tokenable_id = u.id
      WHERE pat.token = ?
      AND pat.is_revoked = FALSE
      AND (pat.expires_at IS NULL OR pat.expires_at > NOW())
      AND u.deleted_at IS NULL
    `;

    const results = await db.query(sql, [token]);
    return results[0] || null;
  }
}

export default PersonalAccessToken;
