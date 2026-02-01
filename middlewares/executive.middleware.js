import ExecutiveManagement from '../models/executive/ExecutiveManagement.js';

/**
 * Middleware to check if user has access to executive data
 */
export const checkExecutiveAccess = async (req, res, next) => {
  try {
    const { executiveId } = req.params;
    const userId = req.user?.id;
    const userRole = req.user?.user_type;

    if (!executiveId) {
      return res.status(400).json({
        success: false,
        message: 'Executive ID is required'
      });
    }

    const executiveModel = new ExecutiveManagement();
    const executive = await executiveModel.findById(executiveId);

    if (!executive) {
      return res.status(404).json({
        success: false,
        message: 'Executive not found'
      });
    }

    // Allow access for admins and HR
    if (userRole === 'admin' || userRole === 'hr') {
      req.executive = executive;
      return next();
    }

    // Allow access for the executive themselves
    if (userId && executive.person_id) {
      // Check if user is the executive
      const userSql = `
        SELECT person_id FROM users
        WHERE user_id = ?
        AND deleted_at IS NULL
      `;
      
      const [user] = await executiveModel.executeQuery(userSql, [userId]);
      
      if (user && user.person_id === executive.person_id) {
        req.executive = executive;
        return next();
      }
    }

    // For other users, check department access or reporting structure
    // (Implement based on your business logic)

    return res.status(403).json({
      success: false,
      message: 'Access denied to executive data'
    });
  } catch (error) {
    console.error('Executive access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking executive access'
    });
  }
};

/**
 * Middleware to validate executive data
 */
export const validateExecutiveData = async (req, res, next) => {
  try {
    const { position_arabic, start_date, person_id } = req.body;
    const errors = [];

    if (!position_arabic || position_arabic.trim() === '') {
      errors.push('Arabic position title is required');
    }

    if (!start_date) {
      errors.push('Start date is required');
    } else {
      const startDate = new Date(start_date);
      if (isNaN(startDate.getTime())) {
        errors.push('Invalid start date format');
      } else if (startDate > new Date()) {
        errors.push('Start date cannot be in the future');
      }
    }

    if (!person_id) {
      errors.push('Person ID is required');
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    next();
  } catch (error) {
    console.error('Executive data validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating executive data'
    });
  }
};
