import BaseModel from './BaseModel.js';
import crypto from 'crypto';
import db from '../config/database.js';

class VerificationCode extends BaseModel {
  constructor() {
    super('verification_codes', 'id');
    this.softDelete = false;
  }

  // Generate 6-digit code
  generateCode() {
    return Math.floor(100000 + Math.random() * 900000).toString();
  }

  // Create verification code
  async createCode(userId, type, recipient, channel = 'sms', expiresInMinutes = 10) {
    const code = this.generateCode();
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

    const data = {
      user_id: userId,
      code,
      type,
      recipient,
      channel,
      expires_at: this.formatDate(expiresAt),
      attempts: 0,
      is_used: false,
      is_expired: false,
      is_locked: false
    };

    // Invalidate previous codes of same type for this user
    await this.invalidatePreviousCodes(userId, type);

    return await this.create(data);
  }

  // Invalidate previous codes
  async invalidatePreviousCodes(userId, type) {
    const sql = `
      UPDATE ${this.tableName}
      SET is_expired = TRUE
      WHERE user_id = ?
      AND type = ?
      AND is_used = FALSE
      AND is_expired = FALSE
    `;

    await db.query(sql, [userId, type]);
  }

  // Verify code
  async verifyCode(userId, code, type) {
    const verification = await this.findValidCode(userId, code, type);
    
    if (!verification) {
      return { success: false, error: 'Invalid or expired code' };
    }

    // Check if code is locked
    if (verification.is_locked && verification.locked_until > new Date()) {
      return { success: false, error: 'Code is temporarily locked' };
    }

    // Check attempts
    if (verification.attempts >= 3) {
      await this.lockCode(verification.id);
      return { success: false, error: 'Too many attempts, code locked' };
    }

    // Verify code
    if (verification.code !== code) {
      await this.recordAttempt(verification.id);
      return { success: false, error: 'Invalid code', attempts: verification.attempts + 1 };
    }

    // Check if expired
    if (new Date(verification.expires_at) < new Date()) {
      await this.expireCode(verification.id);
      return { success: false, error: 'Code has expired' };
    }

    // Mark as used
    await this.markAsUsed(verification.id);

    return { success: true, verification };
  }

  // Find valid code
  async findValidCode(userId, code, type) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
      AND type = ?
      AND is_used = FALSE
      AND is_expired = FALSE
      AND (expires_at IS NULL OR expires_at > NOW())
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const results = await db.query(sql, [userId, type]);
    return results[0] || null;
  }

  // Record attempt
  async recordAttempt(verificationId) {
    const sql = `
      UPDATE ${this.tableName}
      SET 
        attempts = attempts + 1,
        last_attempt_at = ?
      WHERE id = ?
    `;

    await db.query(sql, [this.formatDate(new Date()), verificationId]);
  }

  // Lock code
  async lockCode(verificationId, lockMinutes = 15) {
    const lockedUntil = new Date();
    lockedUntil.setMinutes(lockedUntil.getMinutes() + lockMinutes);

    await this.update(verificationId, {
      is_locked: true,
      locked_until: this.formatDate(lockedUntil)
    });
  }

  // Expire code
  async expireCode(verificationId) {
    await this.update(verificationId, {
      is_expired: true
    });
  }

  // Mark as used
  async markAsUsed(verificationId, ipAddress = null, deviceId = null) {
    await this.update(verificationId, {
      is_used: true,
      used_at: this.formatDate(new Date()),
      used_ip: ipAddress,
      used_device_id: deviceId,
      verified_at: this.formatDate(new Date())
    });
  }

  // Get user's verification history
  async getUserVerifications(userId, type = null, limit = 10) {
    let sql = `
      SELECT * FROM ${this.tableName}
      WHERE user_id = ?
    `;

    const params = [userId];

    if (type) {
      sql += ' AND type = ?';
      params.push(type);
    }

    sql += ' ORDER BY created_at DESC LIMIT ?';
    params.push(limit);

    return await db.query(sql, params);
  }

  // Clean up expired codes
  async cleanupExpiredCodes() {
    // Delete codes expired more than 7 days ago
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE (expires_at IS NOT NULL AND expires_at < DATE_SUB(NOW(), INTERVAL 7 DAY))
      OR (is_used = TRUE AND used_at < DATE_SUB(NOW(), INTERVAL 30 DAY))
    `;

    const result = await db.query(sql);
    return result.affectedRows || 0;
  }

  // Check if user has pending verification
  async hasPendingVerification(userId, type) {
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE user_id = ?
      AND type = ?
      AND is_used = FALSE
      AND is_expired = FALSE
      AND (expires_at IS NULL OR expires_at > NOW())
    `;

    const results = await db.query(sql, [userId, type]);
    return results[0]?.count > 0;
  }

  // Resend code
  async resendCode(userId, type, recipient, channel = 'sms') {
    // Check rate limiting (max 3 codes per hour)
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    const sql = `
      SELECT COUNT(*) as count
      FROM ${this.tableName}
      WHERE user_id = ?
      AND type = ?
      AND created_at > ?
    `;

    const results = await db.query(sql, [userId, type, this.formatDate(hourAgo)]);
    
    if (results[0]?.count >= 3) {
      throw new Error('Too many verification attempts. Please try again later.');
    }

    // Create new code
    return await this.createCode(userId, type, recipient, channel);
  }
}

export default VerificationCode;
