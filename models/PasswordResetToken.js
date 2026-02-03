import BaseModel from './BaseModel.js';
import crypto from 'crypto';
import db from '../database/database.js';

class PasswordResetToken extends BaseModel {
  constructor() {
    super('password_reset_tokens', 'email');
    this.softDelete = false;
  }

  // Create reset token
  async createToken(email) {
    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    // Delete existing tokens for this email
    await this.deleteByEmail(email);

    const data = {
      email,
      token: hashedToken,
      created_at: this.formatDate(new Date())
    };

    await this.create(data);
    return token;
  }

  // Verify token
  async verifyToken(email, token) {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE email = ?
      AND token = ?
      AND created_at >= DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `;

    const results = await db.query(sql, [email, hashedToken]);
    return results[0] || null;
  }

  // Delete token
  async deleteToken(email, token) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE email = ?
      AND token = ?
    `;

    await db.query(sql, [email, token]);
  }

  // Delete by email
  async deleteByEmail(email) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE email = ?
    `;

    await db.query(sql, [email]);
  }

  // Cleanup expired tokens
  async cleanupExpiredTokens() {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE created_at < DATE_SUB(NOW(), INTERVAL 1 HOUR)
    `;

    const result = await db.query(sql);
    return result.affectedRows || 0;
  }
}

export default PasswordResetToken;
