import FamilyTree from '../models/index.js';
import FamilyRelationship from '../models/index.js';
import FamilyTreeNode from '../models/index.js';

/**
 * Middleware to check if user has access to a family tree
 */
export const checkTreeAccess = async (req, res, next) => {
  try {
    const { treeId } = req.params;
    const userId = req.user?.id;

    if (!treeId) {
      return res.status(400).json({
        success: false,
        message: 'Tree ID is required'
      });
    }

    const familyTreeModel = new FamilyTree();
    const hasAccess = await familyTreeModel.checkTreeAccess(treeId, userId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this family tree'
      });
    }

    req.treeId = treeId;
    next();
  } catch (error) {
    console.error('Tree access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking tree access'
    });
  }
};

/**
 * Middleware to check if user is the creator of a family tree
 */
export const checkTreeCreator = async (req, res, next) => {
  try {
    const { treeId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const familyTreeModel = new FamilyTree();
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
        message: 'Only the tree creator can perform this action'
      });
    }

    req.tree = tree;
    next();
  } catch (error) {
    console.error('Tree creator check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking tree creator'
    });
  }
};

/**
 * Middleware to check if user can modify a relationship
 */
export const checkRelationshipAccess = async (req, res, next) => {
  try {
    const { relationshipId } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required'
      });
    }

    const familyRelationshipModel = new FamilyRelationship();
    const relationship = await familyRelationshipModel.findById(relationshipId);

    if (!relationship) {
      return res.status(404).json({
        success: false,
        message: 'Relationship not found'
      });
    }

    // Check if user created this relationship or has admin access
    if (relationship.created_by !== userId) {
      // TODO: Check admin role
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to modify this relationship'
      });
    }

    req.relationship = relationship;
    next();
  } catch (error) {
    console.error('Relationship access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking relationship access'
    });
  }
};

/**
 * Middleware to check node access
 */
export const checkNodeAccess = async (req, res, next) => {
  try {
    const { nodeId } = req.params;
    const userId = req.user?.id;

    const familyTreeNodeModel = new FamilyTreeNode();
    const node = await familyTreeNodeModel.getNodeWithDetails(nodeId);

    if (!node) {
      return res.status(404).json({
        success: false,
        message: 'Node not found'
      });
    }

    // Check tree access
    const familyTreeModel = new FamilyTree();
    const hasTreeAccess = await familyTreeModel.checkTreeAccess(node.family_tree_id, userId);

    if (!hasTreeAccess) {
      return res.status(403).json({
        success: false,
        message: 'Access denied to this family tree'
      });
    }

    req.node = node;
    next();
  } catch (error) {
    console.error('Node access check error:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking node access'
    });
  }
};

/**
 * Middleware to validate family tree input
 */
export const validateTreeInput = async (req, res, next) => {
  try {
    const { tree_name_arabic, tree_type, access_level } = req.body;

    const errors = [];

    if (!tree_name_arabic || tree_name_arabic.trim() === '') {
      errors.push('Arabic tree name is required');
    }

    if (tree_type) {
      const validTreeTypes = ['PATERNAL', 'MATERNAL', 'COMBINED', 'BRANCH'];
      if (!validTreeTypes.includes(tree_type)) {
        errors.push(`Invalid tree type. Must be one of: ${validTreeTypes.join(', ')}`);
      }
    }

    if (access_level) {
      const validAccessLevels = ['PUBLIC', 'FAMILY_ONLY', 'PRIVATE'];
      if (!validAccessLevels.includes(access_level)) {
        errors.push(`Invalid access level. Must be one of: ${validAccessLevels.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors
      });
    }

    next();
  } catch (error) {
    console.error('Tree input validation error:', error);
    res.status(500).json({
      success: false,
      message: 'Error validating tree input'
    });
  }
};
