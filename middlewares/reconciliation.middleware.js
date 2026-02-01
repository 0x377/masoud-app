import ReconciliationCase from '../models/reconciliation/ReconciliationCase.js';

/**
 * Middleware to check case confidentiality
 */
export const checkCaseConfidentiality = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userRole = req.user?.user_type;

    if (!caseId) {
      return next();
    }

    const caseModel = new ReconciliationCase();
    const caseRecord = await caseModel.findById(caseId);

    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Allow full access for admins and committee admins
    if (userRole === 'admin' || userRole === 'committee_admin') {
      req.caseRecord = caseRecord;
      return next();
    }

    // Check confidentiality level
    const confidentialLevel = caseRecord.confidential_level;
    
    if (confidentialLevel === 'TOP_SECRET' && userRole !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied: Top secret case'
      });
    }

    if (confidentialLevel === 'HIGH' && !['admin', 'committee_admin', 'mediator'].includes(userRole)) {
      return res.status(403).json({
        success: false,
        message: 'Access denied: High confidentiality case'
      });
    }

    req.caseRecord = caseRecord;
    next();
  } catch (error) {
    console.error('Case confidentiality check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking case confidentiality'
    });
  }
};

/**
 * Middleware to check if user is assigned mediator
 */
export const checkMediatorAssignment = async (req, res, next) => {
  try {
    const { caseId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    // Get user's person ID
    const userSql = `
      SELECT person_id FROM users
      WHERE user_id = ?
      AND deleted_at IS NULL
    `;
    
    const caseModel = new ReconciliationCase();
    const [user] = await caseModel.executeQuery(userSql, [userId]);

    if (!user || !user.person_id) {
      return res.status(403).json({
        success: false,
        message: 'User profile not found'
      });
    }

    // Get case details
    const caseRecord = await caseModel.findById(caseId);
    if (!caseRecord) {
      return res.status(404).json({
        success: false,
        message: 'Case not found'
      });
    }

    // Check if user is the assigned mediator
    if (caseRecord.mediator_id !== user.person_id && req.user.user_type !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'You are not the assigned mediator for this case'
      });
    }

    req.caseRecord = caseRecord;
    next();
  } catch (error) {
    console.error('Mediator assignment check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking mediator assignment'
    });
  }
};

/**
 * Middleware to validate session data
 */
export const validateSessionData = async (req, res, next) => {
  try {
    const { case_id, session_date, attendees } = req.body;
    const errors = [];

    if (!case_id) {
      errors.push('Case ID is required');
    }

    if (!session_date) {
      errors.push('Session date is required');
    } else {
      const sessionDate = new Date(session_date);
      if (isNaN(sessionDate.getTime())) {
        errors.push('Invalid session date format');
      } else if (sessionDate > new Date()) {
        errors.push('Session date cannot be in the future');
      }
    }

    if (attendees && !Array.isArray(attendees)) {
      errors.push('Attendees must be an array');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    next();
  } catch (error) {
    console.error('Session data validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating session data'
    });
  }
};
