import FamilyRelationship from '../../models/index.js';

class FamilyRelationshipController {
  /**
   * Create a new relationship
   */
  async createRelationship(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const familyRelationshipModel = new FamilyRelationship();
      const relationship = await familyRelationshipModel.createRelationship(data, userId);

      res.status(201).json({
        success: true,
        message: 'Relationship created successfully',
        data: relationship
      });
    } catch (error) {
      console.error('Create relationship error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get relationship details
   */
  async getRelationship(req, res) {
    try {
      const { relationshipId } = req.params;

      const familyRelationshipModel = new FamilyRelationship();
      const relationship = await familyRelationshipModel.getRelationshipWithDetails(relationshipId);

      res.json({
        success: true,
        data: relationship
      });
    } catch (error) {
      console.error('Get relationship error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update relationship
   */
  async updateRelationship(req, res) {
    try {
      const { relationshipId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      const familyRelationshipModel = new FamilyRelationship();
      
      // Check if relationship exists and user has access
      const relationship = await familyRelationshipModel.findById(relationshipId);
      if (!relationship) {
        return res.status(404).json({
          success: false,
          message: 'Relationship not found'
        });
      }

      if (relationship.created_by !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this relationship'
        });
      }

      // Validate update data
      const errors = familyRelationshipModel.validate(data, true);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: ${errors.join(', ')}`
        });
      }

      const updatedRelationship = await familyRelationshipModel.update(relationshipId, {
        ...data,
        updated_at: familyRelationshipModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Relationship updated successfully',
        data: updatedRelationship
      });
    } catch (error) {
      console.error('Update relationship error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete relationship (soft delete)
   */
  async deleteRelationship(req, res) {
    try {
      const { relationshipId } = req.params;
      const userId = req.user.id;

      const familyRelationshipModel = new FamilyRelationship();
      
      // Check if relationship exists and user has access
      const relationship = await familyRelationshipModel.findById(relationshipId);
      if (!relationship) {
        return res.status(404).json({
          success: false,
          message: 'Relationship not found'
        });
      }

      if (relationship.created_by !== userId) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to delete this relationship'
        });
      }

      // Soft delete
      await familyRelationshipModel.update(relationshipId, {
        deleted_at: familyRelationshipModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Relationship deleted successfully'
      });
    } catch (error) {
      console.error('Delete relationship error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get person relationships
   */
  async getPersonRelationships(req, res) {
    try {
      const { personId } = req.params;
      const { 
        relationshipType, 
        activeOnly, 
        includeReciprocal, 
        page, 
        limit 
      } = req.query;

      const options = {
        relationshipType: relationshipType || null,
        activeOnly: activeOnly !== 'false',
        includeReciprocal: includeReciprocal !== 'false',
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50
      };

      const familyRelationshipModel = new FamilyRelationship();
      const result = await familyRelationshipModel.getPersonRelationships(personId, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Get person relationships error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Verify relationship
   */
  async verifyRelationship(req, res) {
    try {
      const { relationshipId } = req.params;
      const { notes } = req.body;
      const userId = req.user.id;

      const familyRelationshipModel = new FamilyRelationship();
      const verifiedRelationship = await familyRelationshipModel.verifyRelationship(
        relationshipId, 
        userId, 
        notes || ''
      );

      res.json({
        success: true,
        message: 'Relationship verified successfully',
        data: verifiedRelationship
      });
    } catch (error) {
      console.error('Verify relationship error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update relationship status
   */
  async updateRelationshipStatus(req, res) {
    try {
      const { relationshipId } = req.params;
      const { status, reason } = req.body;
      const userId = req.user.id;

      const familyRelationshipModel = new FamilyRelationship();
      
      // Check if user has access
      const relationship = await familyRelationshipModel.findById(relationshipId);
      if (!relationship) {
        return res.status(404).json({
          success: false,
          message: 'Relationship not found'
        });
      }

      // Check if user can update status (creator or admin)
      if (relationship.created_by !== userId) {
        // TODO: Check admin role
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to update this relationship status'
        });
      }

      const updatedRelationship = await familyRelationshipModel.updateRelationshipStatus(
        relationshipId, 
        status, 
        reason || ''
      );

      res.json({
        success: true,
        message: 'Relationship status updated successfully',
        data: updatedRelationship
      });
    } catch (error) {
      console.error('Update relationship status error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Search relationships
   */
  async searchRelationships(req, res) {
    try {
      const filters = req.query;
      const { page, limit, includePersons } = req.query;

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 50,
        includePersons: includePersons === 'true'
      };

      const familyRelationshipModel = new FamilyRelationship();
      const result = await familyRelationshipModel.searchRelationships(filters, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Search relationships error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get immediate family
   */
  async getImmediateFamily(req, res) {
    try {
      const { personId } = req.params;

      const familyRelationshipModel = new FamilyRelationship();
      const immediateFamily = await familyRelationshipModel.getImmediateFamily(personId);

      res.json({
        success: true,
        data: immediateFamily
      });
    } catch (error) {
      console.error('Get immediate family error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get ancestors
   */
  async getAncestors(req, res) {
    try {
      const { personId } = req.params;
      const { maxGenerations = 4 } = req.query;

      const familyRelationshipModel = new FamilyRelationship();
      const ancestors = await familyRelationshipModel.getAncestors(
        personId, 
        parseInt(maxGenerations)
      );

      res.json({
        success: true,
        data: ancestors
      });
    } catch (error) {
      console.error('Get ancestors error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get descendants
   */
  async getDescendants(req, res) {
    try {
      const { personId } = req.params;
      const { maxGenerations = 3 } = req.query;

      const familyRelationshipModel = new FamilyRelationship();
      const descendants = await familyRelationshipModel.getDescendants(
        personId, 
        parseInt(maxGenerations)
      );

      res.json({
        success: true,
        data: descendants
      });
    } catch (error) {
      console.error('Get descendants error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Calculate relationship degree
   */
  async calculateRelationshipDegree(req, res) {
    try {
      const { personId1, personId2 } = req.params;

      const familyRelationshipModel = new FamilyRelationship();
      const degree = await familyRelationshipModel.calculateRelationshipDegree(personId1, personId2);

      res.json({
        success: true,
        data: degree
      });
    } catch (error) {
      console.error('Calculate relationship degree error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Bulk create relationships
   */
  async bulkCreateRelationships(req, res) {
    try {
      const { relationships } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(relationships) || relationships.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Relationships array is required'
        });
      }

      const familyRelationshipModel = new FamilyRelationship();
      const result = await familyRelationshipModel.bulkCreateRelationships(relationships, userId);

      res.status(201).json({
        success: true,
        message: 'Bulk relationships creation completed',
        data: result
      });
    } catch (error) {
      console.error('Bulk create relationships error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Import relationships
   */
  async importRelationships(req, res) {
    try {
      const { data, options } = req.body;
      const userId = req.user.id;

      if (!Array.isArray(data) || data.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Data array is required'
        });
      }

      const familyRelationshipModel = new FamilyRelationship();
      const result = await familyRelationshipModel.importRelationships(
        data, 
        userId, 
        options || {}
      );

      res.status(201).json({
        success: true,
        message: 'Relationships import completed',
        data: result
      });
    } catch (error) {
      console.error('Import relationships error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Export relationships
   */
  async exportRelationships(req, res) {
    try {
      const filters = req.query;
      const { format = 'json' } = req.query;

      const familyRelationshipModel = new FamilyRelationship();
      const exportData = await familyRelationshipModel.exportRelationships(filters, format);

      if (format === 'json') {
        res.json({
          success: true,
          ...exportData
        });
      } else {
        // Handle other formats
        res.status(501).json({
          success: false,
          message: 'Export format not yet implemented'
        });
      }
    } catch (error) {
      console.error('Export relationships error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get relationship statistics
   */
  async getRelationshipStatistics(req, res) {
    try {
      const familyRelationshipModel = new FamilyRelationship();
      const statistics = await familyRelationshipModel.getRelationshipStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get relationship statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get relationship type statistics
   */
  async getRelationshipTypeStatistics(req, res) {
    try {
      const familyRelationshipModel = new FamilyRelationship();
      const statistics = await familyRelationshipModel.getRelationshipTypeStatistics();

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get relationship type statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new FamilyRelationshipController();
