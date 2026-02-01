import FamilyTree from '../../models/index.js';
import FamilyTreeNode from '../../models/index.js';

class FamilyTreeController {
  /**
   * Create a new family tree
   */
  async createFamilyTree(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const familyTreeModel = new FamilyTree();
      const tree = await familyTreeModel.createFamilyTree(data, userId);

      res.status(201).json({
        success: true,
        message: 'Family tree created successfully',
        data: tree
      });
    } catch (error) {
      console.error('Create family tree error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get family tree details
   */
  async getFamilyTree(req, res) {
    try {
      const { treeId } = req.params;
      const userId = req.user?.id;

      const familyTreeModel = new FamilyTree();
      const tree = await familyTreeModel.getTreeWithDetails(treeId, userId);

      res.json({
        success: true,
        data: tree
      });
    } catch (error) {
      console.error('Get family tree error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update family tree
   */
  async updateFamilyTree(req, res) {
    try {
      const { treeId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      const familyTreeModel = new FamilyTree();
      
      // Check if user is creator
      const tree = await familyTreeModel.findById(treeId);
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }

      if (tree.created_by !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the tree creator can update this tree'
        });
      }

      // Validate update data
      const errors = familyTreeModel.validate(data, true);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: ${errors.join(', ')}`
        });
      }

      const updatedTree = await familyTreeModel.update(treeId, {
        ...data,
        updated_at: familyTreeModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Family tree updated successfully',
        data: updatedTree
      });
    } catch (error) {
      console.error('Update family tree error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete family tree (soft delete)
   */
  async deleteFamilyTree(req, res) {
    try {
      const { treeId } = req.params;
      const userId = req.user.id;

      const familyTreeModel = new FamilyTree();
      
      // Check if user is creator
      const tree = await familyTreeModel.findById(treeId);
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }

      if (tree.created_by !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the tree creator can delete this tree'
        });
      }

      // Soft delete
      await familyTreeModel.update(treeId, {
        deleted_at: familyTreeModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Family tree deleted successfully'
      });
    } catch (error) {
      console.error('Delete family tree error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Search family trees
   */
  async searchFamilyTrees(req, res) {
    try {
      const filters = req.query;
      const userId = req.user?.id;

      const options = {
        page: parseInt(req.query.page) || 1,
        limit: parseInt(req.query.limit) || 20,
        userId
      };

      const familyTreeModel = new FamilyTree();
      const result = await familyTreeModel.searchFamilyTrees(filters, options);

      res.json({
        success: true,
        ...result
      });
    } catch (error) {
      console.error('Search family trees error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get tree statistics
   */
  async getTreeStatistics(req, res) {
    try {
      const { treeId } = req.params;

      const familyTreeModel = new FamilyTree();
      const statistics = await familyTreeModel.calculateTreeStatistics(treeId);

      res.json({
        success: true,
        data: statistics
      });
    } catch (error) {
      console.error('Get tree statistics error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Export tree data
   */
  async exportTreeData(req, res) {
    try {
      const { treeId } = req.params;
      const { format = 'json' } = req.query;
      const userId = req.user?.id;

      const familyTreeModel = new FamilyTree();
      
      // Check access
      const hasAccess = await familyTreeModel.checkTreeAccess(treeId, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this family tree'
        });
      }

      const exportData = await familyTreeModel.exportTreeData(treeId, format);

      if (format === 'json') {
        res.json({
          success: true,
          ...exportData
        });
      } else {
        // For other formats (CSV, PDF, etc.), you would handle differently
        res.status(501).json({
          success: false,
          message: 'Export format not yet implemented'
        });
      }
    } catch (error) {
      console.error('Export tree data error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Share tree with user
   */
  async shareTree(req, res) {
    try {
      const { treeId } = req.params;
      const shareData = req.body;
      const userId = req.user.id;

      const familyTreeModel = new FamilyTree();
      const share = await familyTreeModel.shareTree(treeId, userId, shareData);

      res.json({
        success: true,
        message: 'Tree shared successfully',
        data: share
      });
    } catch (error) {
      console.error('Share tree error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get tree branches
   */
  async getTreeBranches(req, res) {
    try {
      const { treeId } = req.params;
      const userId = req.user?.id;

      const familyTreeModel = new FamilyTree();
      
      // Check access
      const hasAccess = await familyTreeModel.checkTreeAccess(treeId, userId);
      if (!hasAccess) {
        return res.status(403).json({
          success: false,
          message: 'Access denied to this family tree'
        });
      }

      const branches = await familyTreeModel.getTreeBranches(treeId);

      res.json({
        success: true,
        data: branches
      });
    } catch (error) {
      console.error('Get tree branches error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update tree settings
   */
  async updateTreeSettings(req, res) {
    try {
      const { treeId } = req.params;
      const { settings } = req.body;
      const userId = req.user.id;

      const familyTreeModel = new FamilyTree();
      
      // Check if user is creator
      const tree = await familyTreeModel.findById(treeId);
      if (!tree) {
        return res.status(404).json({
          success: false,
          message: 'Family tree not found'
        });
      }

      if (tree.created_by !== userId) {
        return res.status(403).json({
          success: false,
          message: 'Only the tree creator can update tree settings'
        });
      }

      const updatedTree = await familyTreeModel.updateTreeSettings(treeId, settings);

      res.json({
        success: true,
        message: 'Tree settings updated successfully',
        data: updatedTree
      });
    } catch (error) {
      console.error('Update tree settings error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get tree nodes
   */
  async getTreeNodes(req, res) {
    try {
      const { treeId } = req.params;
      const { generation, parentNodeId, includeDetails } = req.query;
      const userId = req.user?.id;

      const options = {};
      if (generation) options.generation = parseInt(generation);
      if (parentNodeId) options.parentNodeId = parentNodeId;
      if (includeDetails) options.includeDetails = includeDetails === 'true';

      const familyTreeNodeModel = new FamilyTreeNode();
      const nodes = await familyTreeNodeModel.getTreeNodes(treeId, options);

      res.json({
        success: true,
        data: nodes
      });
    } catch (error) {
      console.error('Get tree nodes error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new FamilyTreeController();
