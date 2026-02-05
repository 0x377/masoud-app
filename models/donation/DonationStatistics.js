import BaseModel from '../../libs/BaseModel.js';

class DonationStatistics extends BaseModel {
  constructor() {
    super("donation_statistics", "stat_id");
    this.jsonFields = ["top_donors", "donation_trend"];
  }

  // Calculate and update statistics
  async calculateStatistics(periodType = "DAILY", force = false) {
    const periodStart = this.getPeriodStart(periodType);

    // Check if already calculated for this period
    if (!force) {
      const existingSql = `
        SELECT * FROM ${this.tableName}
        WHERE period_type = ?
        AND period_start = ?
        ORDER BY calculated_at DESC
        LIMIT 1
      `;

      const existing = await this.executeQuery(existingSql, [
        periodType,
        periodStart,
      ]);
      if (existing.length > 0) {
        const hoursSinceCalc =
          (Date.now() - new Date(existing[0].calculated_at)) / (1000 * 60 * 60);
        if (hoursSinceCalc < 1) {
          // Updated within last hour, skip
          return existing[0];
        }
      }
    }

    // Calculate campaign statistics
    const campaignStatsSql = `
      SELECT 
        dc.campaign_id,
        dc.category_id,
        COUNT(DISTINCT d.donation_id) as total_donations,
        SUM(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END) as total_amount,
        AVG(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END) as average_donation,
        MAX(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END) as max_donation,
        MIN(CASE WHEN d.status = 'COMPLETED' THEN d.amount ELSE 0 END) as min_donation,
        COUNT(CASE WHEN d.is_anonymous = TRUE AND d.status = 'COMPLETED' THEN 1 END) as anonymous_count,
        MAX(d.created_at) as last_donation_at
      FROM donation_campaigns dc
      LEFT JOIN donations d ON dc.campaign_id = d.campaign_id
        AND d.deleted_at IS NULL
        AND d.created_at >= ?
      WHERE dc.deleted_at IS NULL
      GROUP BY dc.campaign_id, dc.category_id
    `;

    const periodDate = this.getPeriodDate(periodType);
    const campaignStats = await this.executeQuery(campaignStatsSql, [
      periodDate,
    ]);

    // Calculate top donors
    const topDonorsSql = `
      SELECT 
        d.donor_id,
        COALESCE(p.full_name_arabic, d.donor_name) as donor_name,
        COUNT(d.donation_id) as donation_count,
        SUM(d.amount) as total_amount
      FROM donations d
      LEFT JOIN users u ON d.donor_id = u.id
      LEFT JOIN persons p ON u.person_id = p.id
      WHERE d.status = 'COMPLETED'
      AND d.deleted_at IS NULL
      AND d.created_at >= ?
      GROUP BY d.donor_id, d.donor_name, p.full_name_arabic
      ORDER BY total_amount DESC
      LIMIT 10
    `;

    const topDonors = await this.executeQuery(topDonorsSql, [periodDate]);

    // Calculate donation trend
    const trendSql = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        SUM(CASE WHEN status = 'COMPLETED' THEN amount ELSE 0 END) as amount
      FROM donations
      WHERE deleted_at IS NULL
      AND created_at >= ?
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `;

    const trendData = await this.executeQuery(trendSql, [periodDate]);

    // Insert/update statistics for each campaign
    const updates = [];
    for (const stat of campaignStats) {
      const statData = {
        campaign_id: stat.campaign_id,
        category_id: stat.category_id,
        total_donations: stat.total_donations || 0,
        total_amount: stat.total_amount || 0,
        average_donation: stat.average_donation || 0,
        max_donation: stat.max_donation || 0,
        min_donation: stat.min_donation || 0,
        anonymous_count: stat.anonymous_count || 0,
        top_donors: JSON.stringify(topDonors),
        donation_trend: JSON.stringify(trendData),
        last_donation_at: stat.last_donation_at,
        period_type: periodType,
        period_start: periodStart,
        period_end: this.getPeriodEnd(periodType),
      };

      // Check if exists
      const existsSql = `
        SELECT stat_id FROM ${this.tableName}
        WHERE campaign_id = ?
        AND period_type = ?
        AND period_start = ?
      `;

      const existing = await this.executeQuery(existsSql, [
        stat.campaign_id,
        periodType,
        periodStart,
      ]);

      if (existing.length > 0) {
        // Update existing
        await this.update(existing[0].stat_id, statData);
      } else {
        // Create new
        await this.create(statData);
      }
    }

    return {
      message: "Statistics calculated successfully",
      campaigns_processed: campaignStats.length,
      period_type: periodType,
      period_start: periodStart,
    };
  }

  // Helper methods for period calculation
  getPeriodStart(periodType) {
    const now = new Date();
    switch (periodType) {
      case "DAILY":
        return now.toISOString().split("T")[0];
      case "WEEKLY":
        const weekStart = new Date(now);
        weekStart.setDate(now.getDate() - now.getDay());
        return weekStart.toISOString().split("T")[0];
      case "MONTHLY":
        return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
      case "YEARLY":
        return `${now.getFullYear()}-01-01`;
      default:
        return "1970-01-01";
    }
  }

  getPeriodEnd(periodType) {
    const now = new Date();
    switch (periodType) {
      case "DAILY":
        return now.toISOString().split("T")[0];
      case "WEEKLY":
        const weekEnd = new Date(now);
        weekEnd.setDate(now.getDate() + (6 - now.getDay()));
        return weekEnd.toISOString().split("T")[0];
      case "MONTHLY":
        const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        return lastDay.toISOString().split("T")[0];
      case "YEARLY":
        return `${now.getFullYear()}-12-31`;
      default:
        return "9999-12-31";
    }
  }

  getPeriodDate(periodType) {
    const now = new Date();
    switch (periodType) {
      case "DAILY":
        now.setDate(now.getDate() - 1);
        break;
      case "WEEKLY":
        now.setDate(now.getDate() - 7);
        break;
      case "MONTHLY":
        now.setMonth(now.getMonth() - 1);
        break;
      case "YEARLY":
        now.setFullYear(now.getFullYear() - 1);
        break;
    }
    return now.toISOString().split("T")[0];
  }

  // Get campaign statistics
  async getCampaignStats(campaignId, periodType = "ALL_TIME") {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE campaign_id = ?
      AND period_type = ?
      ORDER BY period_start DESC
      LIMIT 1
    `;

    const results = await this.executeQuery(sql, [campaignId, periodType]);
    return results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Get category statistics
  async getCategoryStats(categoryId, periodType = "ALL_TIME") {
    const sql = `
      SELECT 
        category_id,
        SUM(total_donations) as total_donations,
        SUM(total_amount) as total_amount,
        AVG(average_donation) as average_donation,
        MAX(max_donation) as max_donation,
        MIN(min_donation) as min_donation,
        SUM(anonymous_count) as anonymous_count
      FROM ${this.tableName}
      WHERE category_id = ?
      AND period_type = ?
      GROUP BY category_id
    `;

    const results = await this.executeQuery(sql, [categoryId, periodType]);
    return results[0] || null;
  }

  // Get overall statistics
  async getOverallStats(periodType = "ALL_TIME") {
    const sql = `
      SELECT 
        period_type,
        period_start,
        SUM(total_donations) as total_donations,
        SUM(total_amount) as total_amount,
        AVG(average_donation) as average_donation,
        MAX(max_donation) as max_donation,
        MIN(min_donation) as min_donation,
        SUM(anonymous_count) as anonymous_count,
        COUNT(DISTINCT campaign_id) as active_campaigns
      FROM ${this.tableName}
      WHERE period_type = ?
      GROUP BY period_type, period_start
      ORDER BY period_start DESC
      LIMIT 1
    `;

    const results = await this.executeQuery(sql, [periodType]);
    return results[0] || null;
  }

  // Get statistics trend
  async getStatisticsTrend(periodType = "MONTHLY", limit = 12) {
    const sql = `
      SELECT 
        period_start,
        SUM(total_donations) as total_donations,
        SUM(total_amount) as total_amount,
        AVG(average_donation) as average_donation
      FROM ${this.tableName}
      WHERE period_type = ?
      GROUP BY period_start
      ORDER BY period_start DESC
      LIMIT ?
    `;

    const results = await this.executeQuery(sql, [periodType, limit]);
    return results.map((record) => this.processResult(record));
  }

  // Cleanup old statistics
  async cleanupOldStatistics(daysToKeep = 365) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE period_start < DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND period_type != 'ALL_TIME'
    `;

    const result = await this.executeQuery(sql, [daysToKeep]);
    return {
      deleted_rows: result.affectedRows || 0,
      days_kept: daysToKeep,
    };
  }
}

export default DonationStatistics;
