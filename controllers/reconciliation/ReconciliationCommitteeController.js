import ReconciliationCommittee from '../../models/reconciliation/ReconciliationCommittee.js';

class ReconciliationCommitteeController {
  // Create committee
  async createCommittee(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const committeeModel = new ReconciliationCommittee();
      const committee = await committeeModel.createCommittee(data, userId);

      res.status(201).json({
        success: true,
        message: 'Committee created successfully',
        data: committee
      });
    } catch (error) {
      console.error('Create committee error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get committee details
  async getCommittee(req, res) {
    try {
      const { committeeId } = req.params;

      const committeeModel = new ReconciliationCommittee();
      const committee = await committeeModel.getCommitteeWithDetails(committeeId);

      res.json({
        success: true,
        data: committee
      });
    } catch (error) {
      console.error('Get committee error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update committee
  async updateCommittee(req, res) {
    try {
      const { committeeId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      const committeeModel = new ReconciliationCommittee();
      
      // Check if committee exists
      const committee = await committeeModel.findById(committeeId);
      if (!committee) {
        return res.status(404).json({
          success: false,
          message: 'Committee not found'
        });
      }

      // Validate update data
      const errors = committeeModel.validate(data, true);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: ${errors.join(', ')}`
        });
      }

      const updatedCommittee = await committeeModel.update(committeeId, {
        ...data,
        updated_at: committeeModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Committee updated successfully',
        data: updatedCommittee
      });
    } catch (error) {
      console.error('Update committee error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete committee
  async deleteCommittee(req, res) {
    try {
      const { committeeId } = req.params;

      const committeeModel = new ReconciliationCommittee();
      
      // Check if committee exists
      const committee = await committeeModel.findById(committeeId);
      if (!committee) {
        return res.status(404).json({
          success: false,
          message: 'Committee not found'
        });
      }

      // Soft delete
      await committeeModel.update(committeeId, {
        deleted_at: committeeModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Committee deleted successfully'
      });
    } catch (error) {
      console.error('Delete committee error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Search committees
  async searchCommittees(req, res) {
    try {
      const filters = req.query;
      const { page, limit, includeStats } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20,
        includeStats: includeStats === 'true'
      };

      const committeeModel = new ReconciliationCommittee();
      const result = await committeeModel.searchCommittees(filters, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Search committees error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Add committee member
  async addMember(req, res) {
    try {
      const { committeeId } = req.params;
      const memberData = req.body;

      const committeeModel = new ReconciliationCommittee();
      const committee = await committeeModel.addMember(committeeId, memberData);

      res.json({
        success: true,
        message: 'Member added successfully',
        data: committee
      });
    } catch (error) {
      console.error('Add member error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Remove committee member
  async removeMember(req, res) {
    try {
      const { committeeId, personId } = req.params;

      const committeeModel = new ReconciliationCommittee();
      const committee = await committeeModel.removeMember(committeeId, personId);

      res.json({
        success: true,
        message: 'Member removed successfully',
        data: committee
      });
    } catch (error) {
      console.error('Remove member error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update chairman
  async updateChairman(req, res) {
    try {
      const { committeeId } = req.params;
      const { chairman_id } = req.body;

      if (!chairman_id) {
        return res.status(400).json({
          success: false,
          message: 'Chairman ID is required'
        });
      }

      const committeeModel = new ReconciliationCommittee();
      const committee = await committeeModel.updateChairman(committeeId, chairman_id);

      res.json({
        success: true,
        message: 'Chairman updated successfully',
        data: committee
      });
    } catch (error) {
      console.error('Update chairman error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get committee statistics
  async getCommitteeStatistics(req, res) {
    try {
      const { committeeId } = req.params;

      const committeeModel = new ReconciliationCommittee();
      const statistics = await committeeModel.getCommitteeStatistics(committeeId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get committee statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Generate committee report
  async generateCommitteeReport(req, res) {
    try {
      const { committeeId } = req.params;
      const { start_date, end_date } = req.body;
      const userId = req.user.id;

      if (!start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const committeeModel = new ReconciliationCommittee();
      const report = await committeeModel.generateCommitteeReport(committeeId, start_date, end_date);

      res.json({
        success: true,
        message: 'Committee report generated successfully',
        data: report
      });
    } catch (error) {
      console.error('Generate committee report error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new ReconciliationCommitteeController();
