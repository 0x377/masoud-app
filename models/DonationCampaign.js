import BaseModel from './BaseModel.js';

class DonationCampaign extends BaseModel {
  constructor() {
    super('donation_campaigns', 'campaign_id');
  }

  // Validate campaign data
  validate(data) {
    const errors = [];

    // Required fields
    if (!data.title_arabic) {
      errors.push('Arabic title is required');
    }

    if (!data.description) {
      errors.push('Description is required');
    }

    // Date validation
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      
      if (startDate > endDate) {
        errors.push('Start date cannot be after end date');
      }
    }

    // Amount validation
    if (data.target_amount && data.target_amount <= 0) {
      errors.push('Target amount must be greater than 0');
    }

    // Status validation
    const validStatuses = ['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'CANCELLED'];
    if (data.status && !validStatuses.includes(data.status)) {
      errors.push('Invalid status');
    }

    return errors;
  }

  // Get active campaigns
  async getActiveCampaigns(options = {}) {
    const { page = 1, limit = 10, category_id = null } = options;
    
    let sql = `
      SELECT 
        dc.*,
        dc.name_arabic as category_name_arabic,
        dc.name_english as category_name_english,
        (SELECT COUNT(*) FROM donations d WHERE d.campaign_id = dc.campaign_id AND d.status = 'COMPLETED') as donation_count,
        (SELECT SUM(amount) FROM donations d WHERE d.campaign_id = dc.campaign_id AND d.status = 'COMPLETED') as total_raised
      FROM donation_campaigns dc
      LEFT JOIN donation_categories dc ON dc.category_id = dc.category_id
      WHERE dc.status = 'ACTIVE'
      AND dc.end_date >= CURDATE()
      AND dc.deleted_at IS NULL
    `;
    
    const params = [];
    
    if (category_id) {
      sql += ' AND dc.category_id = ?';
      params.push(category_id);
    }
    
    sql += ' ORDER BY dc.is_featured DESC, dc.created_at DESC LIMIT ? OFFSET ?';
    params.push(limit, (page - 1) * limit);
    
    return await this.executeQuery(sql, params);
  }

  // Get campaign statistics
  async getCampaignStatistics(campaignId) {
    const sql = `
      SELECT 
        COUNT(*) as total_donations,
        SUM(amount) as total_amount,
        AVG(amount) as average_donation,
        MAX(amount) as max_donation,
        MIN(amount) as min_donation,
        COUNT(CASE WHEN is_anonymous = 1 THEN 1 END) as anonymous_count,
        COUNT(DISTINCT donor_id) as unique_donors,
        MIN(created_at) as first_donation_date,
        MAX(created_at) as last_donation_date
      FROM donations
      WHERE campaign_id = ?
      AND status = 'COMPLETED'
      AND deleted_at IS NULL
    `;
    
    const results = await this.executeQuery(sql, [campaignId]);
    return results[0] || {};
  }

  // Get top donors for campaign
  async getTopDonors(campaignId, limit = 10) {
    const sql = `
      SELECT 
        d.donor_id,
        u.email,
        p.full_name_arabic,
        p.full_name_english,
        SUM(d.amount) as total_donated,
        COUNT(d.donation_id) as donation_count,
        MAX(d.created_at) as last_donation_date
      FROM donations d
      LEFT JOIN users u ON d.donor_id = u.id AND u.deleted_at IS NULL
      LEFT JOIN persons p ON u.person_id = p.person_id AND p.deleted_at IS NULL
      WHERE d.campaign_id = ?
      AND d.status = 'COMPLETED'
      AND d.is_anonymous = 0
      AND d.donor_id IS NOT NULL
      AND d.deleted_at IS NULL
      GROUP BY d.donor_id, u.email, p.full_name_arabic, p.full_name_english
      ORDER BY total_donated DESC
      LIMIT ?
    `;
    
    return await this.executeQuery(sql, [campaignId, limit]);
  }

  // Get donation timeline
  async getDonationTimeline(campaignId, period = 'daily') {
    let dateFormat = '%Y-%m-%d';
    
    if (period === 'weekly') {
      dateFormat = '%Y-%u';
    } else if (period === 'monthly') {
      dateFormat = '%Y-%m';
    } else if (period === 'yearly') {
      dateFormat = '%Y';
    }
    
    const sql = `
      SELECT 
        DATE_FORMAT(created_at, ?) as period,
        COUNT(*) as donation_count,
        SUM(amount) as total_amount,
        AVG(amount) as average_amount
      FROM donations
      WHERE campaign_id = ?
      AND status = 'COMPLETED'
      AND deleted_at IS NULL
      GROUP BY DATE_FORMAT(created_at, ?)
      ORDER BY period
    `;
    
    return await this.executeQuery(sql, [dateFormat, campaignId, dateFormat]);
  }

  // Update campaign progress
  async updateCampaignProgress(campaignId) {
    const stats = await this.getCampaignStatistics(campaignId);
    
    await this.update(campaignId, {
      current_amount: stats.total_amount || 0
    });
    
    // Check if campaign target reached
    const campaign = await this.findById(campaignId);
    if (campaign.target_amount && campaign.current_amount >= campaign.target_amount) {
      await this.update(campaignId, {
        status: 'COMPLETED'
      });
    }
    
    return stats;
  }

  // Create campaign with validation
  async createWithValidation(data) {
    const errors = this.validate(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return await this.create(data);
  }

  // Update campaign with validation
  async updateWithValidation(id, data) {
    const errors = this.validate(data);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    return await this.update(id, data);
  }

  // Get featured campaigns
  async getFeaturedCampaigns(limit = 3) {
    const sql = `
      SELECT 
        dc.*,
        dc.name_arabic as category_name_arabic,
        (SELECT SUM(amount) FROM donations d WHERE d.campaign_id = dc.campaign_id AND d.status = 'COMPLETED') as total_raised,
        ROUND(
          (SELECT SUM(amount) FROM donations d WHERE d.campaign_id = dc.campaign_id AND d.status = 'COMPLETED') 
          / dc.target_amount * 100, 
          2
        ) as progress_percentage
      FROM donation_campaigns dc
      LEFT JOIN donation_categories dc ON dc.category_id = dc.category_id
      WHERE dc.is_featured = 1
      AND dc.status = 'ACTIVE'
      AND dc.end_date >= CURDATE()
      AND dc.deleted_at IS NULL
      ORDER BY dc.created_at DESC
      LIMIT ?
    `;
    
    return await this.executeQuery(sql, [limit]);
  }

  // Get campaigns by category
  async getCampaignsByCategory(categoryId, options = {}) {
    const { page = 1, limit = 10, status = 'ACTIVE' } = options;
    
    const sql = `
      SELECT 
        dc.*,
        (SELECT SUM(amount) FROM donations d WHERE d.campaign_id = dc.campaign_id AND d.status = 'COMPLETED') as total_raised,
        (SELECT COUNT(*) FROM donations d WHERE d.campaign_id = dc.campaign_id AND d.status = 'COMPLETED') as donation_count
      FROM donation_campaigns dc
      WHERE dc.category_id = ?
      AND dc.status = ?
      AND dc.deleted_at IS NULL
      ORDER BY dc.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    return await this.executeQuery(sql, [
      categoryId, 
      status, 
      limit, 
      (page - 1) * limit
    ]);
  }

  // Export campaign data
  async exportCampaignData(campaignId) {
    const campaign = await this.findById(campaignId);
    if (!campaign) {
      throw new Error('Campaign not found');
    }

    const [donations, topDonors, statistics] = await Promise.all([
      this.executeQuery('SELECT * FROM donations WHERE campaign_id = ? ORDER BY created_at DESC', [campaignId]),
      this.getTopDonors(campaignId, 20),
      this.getCampaignStatistics(campaignId)
    ]);

    return {
      campaign,
      statistics,
      top_donors: topDonors,
      donations_count: donations.length,
      donations
    };
  }
}

export default DonationCampaign;
