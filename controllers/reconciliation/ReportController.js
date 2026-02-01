import ReconciliationReport from '../../models/reconciliation/ReconciliationReport.js';

class ReportController {
  // Generate monthly report
  async generateMonthlyReport(req, res) {
    try {
      const { year, month } = req.body;
      const userId = req.user.id;

      if (!year || !month) {
        return res.status(400).json({
          success: false,
          message: 'Year and month are required'
        });
      }

      const reportModel = new ReconciliationReport();
      const report = await reportModel.generateMonthlyReport(parseInt(year), parseInt(month), userId);

      res.json({
        success: true,
        message: 'Monthly report generated successfully',
        data: report
      });
    } catch (error) {
      console.error('Generate monthly report error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Generate committee performance report
  async generateCommitteePerformanceReport(req, res) {
    try {
      const { committeeId, start_date, end_date } = req.body;
      const userId = req.user.id;

      if (!committeeId || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Committee ID, start date, and end date are required'
        });
      }

      const reportModel = new ReconciliationReport();
      const report = await reportModel.generateCommitteePerformanceReport(
        committeeId, 
        start_date, 
        end_date, 
        userId
      );

      res.json({
        success: true,
        message: 'Committee performance report generated successfully',
        data: report
      });
    } catch (error) {
      console.error('Generate committee performance report error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Generate mediator performance report
  async generateMediatorPerformanceReport(req, res) {
    try {
      const { mediatorId, start_date, end_date } = req.body;
      const userId = req.user.id;

      if (!mediatorId || !start_date || !end_date) {
        return res.status(400).json({
          success: false,
          message: 'Mediator ID, start date, and end date are required'
        });
      }

      const reportModel = new ReconciliationReport();
      const report = await reportModel.generateMediatorPerformanceReport(
        mediatorId, 
        start_date, 
        end_date, 
        userId
      );

      res.json({
        success: true,
        message: 'Mediator performance report generated successfully',
        data: report
      });
    } catch (error) {
      console.error('Generate mediator performance report error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Search reports
  async searchReports(req, res) {
    try {
      const filters = req.query;
      const { page, limit } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      };

      const reportModel = new ReconciliationReport();
      const result = await reportModel.searchReports(filters, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Search reports error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get report details
  async getReport(req, res) {
    try {
      const { reportId } = req.params;

      const reportModel = new ReconciliationReport();
      const report = await reportModel.getReportWithData(reportId);

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      console.error('Get report error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete report
  async deleteReport(req, res) {
    try {
      const { reportId } = req.params;

      const reportModel = new ReconciliationReport();
      
      // Check if report exists
      const report = await reportModel.findById(reportId);
      if (!report) {
        return res.status(404).json({
          success: false,
          message: 'Report not found'
        });
      }

      // Soft delete
      await reportModel.update(reportId, {
        deleted_at: reportModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Report deleted successfully'
      });
    } catch (error) {
      console.error('Delete report error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Export report
  async exportReport(req, res) {
    try {
      const { reportId } = req.params;
      const { format = 'json' } = req.query;

      const reportModel = new ReconciliationReport();
      const report = await reportModel.getReportWithData(reportId);

      if (format === 'json') {
        res.json({
          success: true,
          data: report
        });
      } else if (format === 'pdf') {
        // PDF generation logic would go here
        res.status(501).json({
          success: false,
          message: 'PDF export not yet implemented'
        });
      } else {
        res.status(400).json({
          success: false,
          message: 'Unsupported export format'
        });
      }
    } catch (error) {
      console.error('Export report error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new ReportController();
