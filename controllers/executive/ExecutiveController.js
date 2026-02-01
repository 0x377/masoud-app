import ExecutiveManagement from '../../models/executive/ExecutiveManagement.js';
import ExecutiveDocument from '../../models/executive/ExecutiveDocument.js';

class ExecutiveController {
  // Create executive
  async createExecutive(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const executiveModel = new ExecutiveManagement();
      const executive = await executiveModel.createExecutive(data, userId);

      res.status(201).json({
        success: true,
        message: 'Executive created successfully',
        data: executive
      });
    } catch (error) {
      console.error('Create executive error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get executive details
  async getExecutive(req, res) {
    try {
      const { executiveId } = req.params;

      const executiveModel = new ExecutiveManagement();
      const executive = await executiveModel.getExecutiveWithDetails(executiveId);

      res.json({
        success: true,
        data: executive
      });
    } catch (error) {
      console.error('Get executive error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  // Update executive
  async updateExecutive(req, res) {
    try {
      const { executiveId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      const executiveModel = new ExecutiveManagement();
      const executive = await executiveModel.updateExecutive(executiveId, data, userId);

      res.json({
        success: true,
        message: 'Executive updated successfully',
        data: executive
      });
    } catch (error) {
      console.error('Update executive error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Delete executive (soft delete)
  async deleteExecutive(req, res) {
    try {
      const { executiveId } = req.params;
      const userId = req.user.id;

      const executiveModel = new ExecutiveManagement();
      
      // Check if executive exists
      const executive = await executiveModel.findById(executiveId);
      if (!executive) {
        return res.status(404).json({
          success: false,
          message: 'Executive not found'
        });
      }

      // Soft delete
      await executiveModel.update(executiveId, {
        deleted_at: executiveModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Executive deleted successfully'
      });
    } catch (error) {
      console.error('Delete executive error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Search executives
  async searchExecutives(req, res) {
    try {
      const filters = req.query;
      const { page, limit, includeDetails } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        includeDetails: includeDetails === 'true'
      };

      const executiveModel = new ExecutiveManagement();
      const result = await executiveModel.searchExecutives(filters, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Search executives error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get executives by department
  async getExecutivesByDepartment(req, res) {
    try {
      const { department } = req.params;
      const { isCurrent, positionLevel, page, limit } = req.query;

      const options = {
        isCurrent: isCurrent !== 'false',
        positionLevel: positionLevel ? parseInt(positionLevel) : null,
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      };

      const executiveModel = new ExecutiveManagement();
      const result = await executiveModel.getExecutivesByDepartment(department, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get executives by department error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get organizational hierarchy
  async getOrganizationalHierarchy(req, res) {
    try {
      const { rootExecutiveId } = req.query;

      const executiveModel = new ExecutiveManagement();
      const hierarchy = await executiveModel.getOrganizationalHierarchy(rootExecutiveId);

      res.json({
        success: true,
        data: hierarchy
      });
    } catch (error) {
      console.error('Get organizational hierarchy error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get executives with expiring terms
  async getExecutivesWithExpiringTerms(req, res) {
    try {
      const { daysThreshold = 30 } = req.query;

      const executiveModel = new ExecutiveManagement();
      const executives = await executiveModel.getExecutivesWithExpiringTerms(parseInt(daysThreshold));

      res.json({
        success: true,
        data: executives
      });
    } catch (error) {
      console.error('Get executives with expiring terms error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get executive statistics
  async getExecutiveStatistics(req, res) {
    try {
      const executiveModel = new ExecutiveManagement();
      const statistics = await executiveModel.getExecutiveStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get executive statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Promote executive
  async promoteExecutive(req, res) {
    try {
      const { executiveId } = req.params;
      const { newPositionLevel, newPositionArabic, effectiveDate } = req.body;
      const userId = req.user.id;

      if (!newPositionLevel || !newPositionArabic || !effectiveDate) {
        return res.status(400).json({
          success: false,
          message: 'New position level, Arabic title, and effective date are required'
        });
      }

      const executiveModel = new ExecutiveManagement();
      const newPosition = await executiveModel.changeExecutivePosition(
        executiveId,
        newPositionLevel,
        newPositionArabic,
        effectiveDate,
        userId
      );

      res.json({
        success: true,
        message: 'Executive promoted successfully',
        data: newPosition
      });
    } catch (error) {
      console.error('Promote executive error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Transfer executive
  async transferExecutive(req, res) {
    try {
      const { executiveId } = req.params;
      const { newDepartment, effectiveDate } = req.body;
      const userId = req.user.id;

      if (!newDepartment || !effectiveDate) {
        return res.status(400).json({
          success: false,
          message: 'New department and effective date are required'
        });
      }

      const executiveModel = new ExecutiveManagement();
      const transferred = await executiveModel.transferExecutive(
        executiveId,
        newDepartment,
        effectiveDate,
        userId
      );

      res.json({
        success: true,
        message: 'Executive transferred successfully',
        data: transferred
      });
    } catch (error) {
      console.error('Transfer executive error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get executive timeline
  async getExecutiveTimeline(req, res) {
    try {
      const { personId } = req.params;

      const executiveModel = new ExecutiveManagement();
      const timeline = await executiveModel.getExecutiveTimeline(personId);

      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      console.error('Get executive timeline error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Upload executive document
  async uploadDocument(req, res) {
    try {
      const { executiveId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: 'Document file is required'
        });
      }

      // Add file path to data
      data.file_path = req.file.path;
      data.executive_id = executiveId;

      const documentModel = new ExecutiveDocument();
      const document = await documentModel.createDocument(data, userId);

      res.status(201).json({
        success: true,
        message: 'Document uploaded successfully',
        data: document
      });
    } catch (error) {
      console.error('Upload document error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get executive documents
  async getExecutiveDocuments(req, res) {
    try {
      const { executiveId } = req.params;
      const { documentType } = req.query;

      const documentModel = new ExecutiveDocument();
      const documents = await documentModel.getExecutiveDocuments(executiveId, documentType);

      res.json({
        success: true,
        data: documents
      });
    } catch (error) {
      console.error('Get executive documents error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  // Get active executives count
  async getActiveExecutivesCount(req, res) {
    try {
      const executiveModel = new ExecutiveManagement();
      const sql = `
        SELECT 
          COUNT(*) as total_active,
          COUNT(CASE WHEN gender = 'M' THEN 1 END) as male_active,
          COUNT(CASE WHEN gender = 'F' THEN 1 END) as female_active,
          COUNT(DISTINCT department) as active_departments
        FROM executive_management e
        INNER JOIN persons p ON e.person_id = p.person_id
        WHERE e.is_current = TRUE
        AND e.deleted_at IS NULL
      `;
      
      const [stats] = await this.executeQuery(sql);

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      console.error('Get active executives count error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new ExecutiveController();
