import ReconciliationCase from '../../models/reconciliation/ReconciliationCase.js';
import CaseSession from '../../models/reconciliation/CaseSession.js';

class ReconciliationCaseController {
  // Create case
  async createCase(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const caseModel = new ReconciliationCase();
      const caseRecord = await caseModel.createCase(data, userId);

      res.status(201).json({
        success: true,
        message: 'Case created successfully',
        data: caseRecord
      });
    } catch (error) {
      console.error('Create case error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get case details
  async getCase(req, res) {
    try {
      const { caseId } = req.params;

      const caseModel = new ReconciliationCase();
      const caseRecord = await caseModel.getCaseWithDetails(caseId);

      res.json({
        success: true,
        data: caseRecord
      });
    } catch (error) {
      console.error('Get case error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update case
  async updateCase(req, res) {
    try {
      const { caseId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      const caseModel = new ReconciliationCase();
      
      // Check if case exists
      const caseRecord = await caseModel.findById(caseId);
      if (!caseRecord) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      // Validate update data
      const errors = caseModel.validate(data, true);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: ${errors.join(', ')}`
        });
      }

      const updatedCase = await caseModel.update(caseId, {
        ...data,
        updated_at: caseModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Case updated successfully',
        data: updatedCase
      });
    } catch (error) {
      console.error('Update case error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete case
  async deleteCase(req, res) {
    try {
      const { caseId } = req.params;
      const userId = req.user.id;

      const caseModel = new ReconciliationCase();
      
      // Check if case exists
      const caseRecord = await caseModel.findById(caseId);
      if (!caseRecord) {
        return res.status(404).json({
          success: false,
          message: 'Case not found'
        });
      }

      // Soft delete
      await caseModel.update(caseId, {
        deleted_at: caseModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Case deleted successfully'
      });
    } catch (error) {
      console.error('Delete case error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Search cases
  async searchCases(req, res) {
    try {
      const filters = req.query;
      const { page, limit, includeDetails } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        includeDetails: includeDetails === 'true'
      };

      const caseModel = new ReconciliationCase();
      const result = await caseModel.searchCases(filters, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Search cases error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update case status
  async updateCaseStatus(req, res) {
    try {
      const { caseId } = req.params;
      const { status, notes } = req.body;
      const userId = req.user.id;

      if (!status) {
        return res.status(400).json({
          success: false,
          message: 'Status is required'
        });
      }

      const caseModel = new ReconciliationCase();
      const updatedCase = await caseModel.updateCaseStatus(caseId, status, notes, userId);

      res.json({
        success: true,
        message: 'Case status updated successfully',
        data: updatedCase
      });
    } catch (error) {
      console.error('Update case status error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Assign mediator
  async assignMediator(req, res) {
    try {
      const { caseId } = req.params;
      const { mediator_id } = req.body;
      const userId = req.user.id;

      if (!mediator_id) {
        return res.status(400).json({
          success: false,
          message: 'Mediator ID is required'
        });
      }

      const caseModel = new ReconciliationCase();
      const updatedCase = await caseModel.assignMediator(caseId, mediator_id, userId);

      res.json({
        success: true,
        message: 'Mediator assigned successfully',
        data: updatedCase
      });
    } catch (error) {
      console.error('Assign mediator error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Settle case
  async settleCase(req, res) {
    try {
      const { caseId } = req.params;
      const settlementData = req.body;
      const userId = req.user.id;

      const caseModel = new ReconciliationCase();
      const settledCase = await caseModel.settleCase(caseId, settlementData, userId);

      res.json({
        success: true,
        message: 'Case settled successfully',
        data: settledCase
      });
    } catch (error) {
      console.error('Settle case error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get case statistics
  async getCaseStatistics(req, res) {
    try {
      const filters = req.query;

      const caseModel = new ReconciliationCase();
      const statistics = await caseModel.getCaseStatistics(filters);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get case statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get cases requiring follow-up
  async getCasesRequiringFollowUp(req, res) {
    try {
      const caseModel = new ReconciliationCase();
      const cases = await caseModel.getCasesRequiringFollowUp();

      res.json({
        success: true,
        data: cases
      });
    } catch (error) {
      console.error('Get cases requiring follow-up error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get case timeline
  async getCaseTimeline(req, res) {
    try {
      const { caseId } = req.params;

      const caseModel = new ReconciliationCase();
      const timeline = await caseModel.getCaseTimeline(caseId);

      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      console.error('Get case timeline error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get mediator workload
  async getMediatorWorkload(req, res) {
    try {
      const { mediatorId } = req.params;

      const caseModel = new ReconciliationCase();
      const workload = await caseModel.getMediatorWorkload(mediatorId);

      res.json({
        success: true,
        data: workload
      });
    } catch (error) {
      console.error('Get mediator workload error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new ReconciliationCaseController();
