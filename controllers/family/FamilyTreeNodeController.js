import FamilyTreeNode from '../../models/index.js';

class FamilyTreeNodeController {
  /**
   * Create a new node
   */
  async createNode(req, res) {
    try {
      const data = req.body;
      const userId = req.user.id;

      const familyTreeNodeModel = new FamilyTreeNode();
      const node = await familyTreeNodeModel.createNode(data, userId);

      res.status(201).json({
        success: true,
        message: 'Node created successfully',
        data: node
      });
    } catch (error) {
      console.error('Create node error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get node details
   */
  async getNode(req, res) {
    try {
      const { nodeId } = req.params;

      const familyTreeNodeModel = new FamilyTreeNode();
      const node = await familyTreeNodeModel.getNodeWithDetails(nodeId);

      res.json({
        success: true,
        data: node
      });
    } catch (error) {
      console.error('Get node error:', error);
      res.status(404).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update node
   */
  async updateNode(req, res) {
    try {
      const { nodeId } = req.params;
      const data = req.body;
      const userId = req.user.id;

      const familyTreeNodeModel = new FamilyTreeNode();
      
      // Check if node exists and user has access
      const node = await familyTreeNodeModel.findById(nodeId);
      if (!node) {
        return res.status(404).json({
          success: false,
          message: 'Node not found'
        });
      }

      // Validate update data
      const errors = familyTreeNodeModel.validate(data, true);
      if (errors.length > 0) {
        return res.status(400).json({
          success: false,
          message: `Validation failed: ${errors.join(', ')}`
        });
      }

      const updatedNode = await familyTreeNodeModel.update(nodeId, {
        ...data,
        updated_at: familyTreeNodeModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Node updated successfully',
        data: updatedNode
      });
    } catch (error) {
      console.error('Update node error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Delete node (soft delete)
   */
  async deleteNode(req, res) {
    try {
      const { nodeId } = req.params;
      const userId = req.user.id;

      const familyTreeNodeModel = new FamilyTreeNode();
      
      // Check if node exists
      const node = await familyTreeNodeModel.findById(nodeId);
      if (!node) {
        return res.status(404).json({
          success: false,
          message: 'Node not found'
        });
      }

      // Check if user can delete (creator or tree creator)
      // TODO: Implement proper permission check

      // Soft delete
      await familyTreeNodeModel.update(nodeId, {
        deleted_at: familyTreeNodeModel.formatDate(new Date())
      });

      res.json({
        success: true,
        message: 'Node deleted successfully'
      });
    } catch (error) {
      console.error('Delete node error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Add child to node
   */
  async addChild(req, res) {
    try {
      const { nodeId } = req.params;
      const { childPersonId } = req.body;
      const userId = req.user.id;

      if (!childPersonId) {
        return res.status(400).json({
          success: false,
          message: 'Child person ID is required'
        });
      }

      const familyTreeNodeModel = new FamilyTreeNode();
      const childNode = await familyTreeNodeModel.addChild(nodeId, childPersonId, userId);

      res.status(201).json({
        success: true,
        message: 'Child added successfully',
        data: childNode
      });
    } catch (error) {
      console.error('Add child error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Add spouse to node
   */
  async addSpouse(req, res) {
    try {
      const { nodeId } = req.params;
      const { spousePersonId } = req.body;
      const userId = req.user.id;

      if (!spousePersonId) {
        return res.status(400).json({
          success: false,
          message: 'Spouse person ID is required'
        });
      }

      const familyTreeNodeModel = new FamilyTreeNode();
      const result = await familyTreeNodeModel.addSpouse(nodeId, spousePersonId, userId);

      res.status(201).json({
        success: true,
        message: 'Spouse added successfully',
        data: result
      });
    } catch (error) {
      console.error('Add spouse error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Get ancestry path
   */
  async getAncestryPath(req, res) {
    try {
      const { nodeId } = req.params;
      const { maxGenerations = 5 } = req.query;

      const familyTreeNodeModel = new FamilyTreeNode();
      const ancestry = await familyTreeNodeModel.getAncestryPath(
        nodeId, 
        parseInt(maxGenerations)
      );

      res.json({
        success: true,
        data: ancestry
      });
    } catch (error) {
      console.error('Get ancestry path error:', error);
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
      const { nodeId } = req.params;
      const { maxGenerations = 3 } = req.query;

      const familyTreeNodeModel = new FamilyTreeNode();
      const descendants = await familyTreeNodeModel.getDescendants(
        nodeId, 
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
   * Get children
   */
  async getChildren(req, res) {
    try {
      const { nodeId } = req.params;

      const familyTreeNodeModel = new FamilyTreeNode();
      const children = await familyTreeNodeModel.getChildren(nodeId);

      res.json({
        success: true,
        data: children
      });
    } catch (error) {
      console.error('Get children error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Update node position
   */
  async updateNodePosition(req, res) {
    try {
      const { nodeId } = req.params;
      const positionData = req.body;

      const familyTreeNodeModel = new FamilyTreeNode();
      const updatedNode = await familyTreeNodeModel.updateNodePosition(nodeId, positionData);

      res.json({
        success: true,
        message: 'Node position updated successfully',
        data: updatedNode
      });
    } catch (error) {
      console.error('Update node position error:', error);
      res.status(400).json({
        success: false,
        message: error.message
      });
    }
  }

  /**
   * Search nodes in tree
   */
  async searchNodesInTree(req, res) {
    try {
      const { treeId } = req.params;
      const { searchTerm, page, limit } = req.query;

      if (!searchTerm || searchTerm.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Search term is required'
        });
      }

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 20
      };

      const familyTreeNodeModel = new FamilyTreeNode();
      const results = await familyTreeNodeModel.searchNodesInTree(
        treeId, 
        searchTerm, 
        options
      );

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      console.error('Search nodes error:', error);
      res.status(500).json({
        success: false,
        message: error.message
      });
    }
  }
}

export default new FamilyTreeNodeController();
