import CaseSession from '../../models/reconciliation/CaseSession.js';

class CaseSessionController {
  // Create session
  async createSession(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const sessionModel = new CaseSession();
      const session = await sessionModel.createSession(data, userId);

      res.status(201).json({
        success: true,
        message: 'Session created successfully',
        data: session
      });
    } catch (error) {
      console.error('Create session error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get session details
  async getSession(req, res) {
    try {
      const { sessionId } = req.params;

      const sessionModel = new CaseSession();
      const session = await sessionModel.getSessionWithDetails(sessionId);

      res.json({
        success: true,
        data: session
      });
    } catch (error) {
      console.error('Get session error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get case sessions
  async getCaseSessions(req, res) {
    try {
      const { caseId } = req.params;
      const { session_type } = req.query;

      const sessionModel = new CaseSession();
      const sessions = await sessionModel.getCaseSessions(caseId, session_type);

      res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      console.error('Get case sessions error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update session
  async updateSession(req, res) {
    try {
      const { sessionId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      const sessionModel = new CaseSession();
      
      // Check if session exists
      const session = await sessionModel.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Validate update data
      const errors = sessionModel.validate(data, true);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: ${errors.join(', ')}`
        });
      }

      const updatedSession = await sessionModel.update(sessionId, {
        ...data,
        updated_at: sessionModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Session updated successfully',
        data: updatedSession
      });
    } catch (error) {
      console.error('Update session error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update session outcome
  async updateSessionOutcome(req, res) {
    try {
      const { sessionId } = req.params;
      const outcomeData = req.body;
      const userId = req.user.id;

      const sessionModel = new CaseSession();
      const updatedSession = await sessionModel.updateSessionOutcome(sessionId, outcomeData, userId);

      res.json({
        success: true,
        message: 'Session outcome updated successfully',
        data: updatedSession
      });
    } catch (error) {
      console.error('Update session outcome error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete session
  async deleteSession(req, res) {
    try {
      const { sessionId } = req.params;

      const sessionModel = new CaseSession();
      
      // Check if session exists
      const session = await sessionModel.findById(sessionId);
      if (!session) {
        return res.status(404).json({
          success: false,
          message: 'Session not found'
        });
      }

      // Soft delete
      await sessionModel.update(sessionId, {
        deleted_at: sessionModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Session deleted successfully'
      });
    } catch (error) {
      console.error('Delete session error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Search sessions
  async searchSessions(req, res) {
    try {
      const filters = req.query;
      const { page, limit, includeDetails } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        includeDetails: includeDetails === 'true'
      };

      const sessionModel = new CaseSession();
      const result = await sessionModel.searchSessions(filters, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Search sessions error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get upcoming sessions
  async getUpcomingSessions(req, res) {
    try {
      const { days_ahead = 7 } = req.query;

      const sessionModel = new CaseSession();
      const sessions = await sessionModel.getUpcomingSessions(parseInt(days_ahead));

      res.json({
        success: true,
        data: sessions
      });
    } catch (error) {
      console.error('Get upcoming sessions error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get session statistics
  async getSessionStatistics(req, res) {
    try {
      const { caseId, start_date, end_date } = req.query;

      const sessionModel = new CaseSession();
      const statistics = await sessionModel.getSessionStatistics(caseId, start_date, end_date);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get session statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new CaseSessionController();
