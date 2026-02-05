import BaseModel from '../../libs/BaseModel.js';

class FamilyTreeNode extends BaseModel {
  constructor() {
    super('family_tree_nodes', 'node_id');
    this.jsonFields = ['display_settings', 'metadata'];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.person_id) {
        errors.push('Person ID is required');
      }
      if (!data.family_tree_id) {
        errors.push('Family tree ID is required');
      }
    }

    // Position validation
    const validPositions = ['LEFT', 'RIGHT', 'CENTER'];
    if (data.node_position && !validPositions.includes(data.node_position)) {
      errors.push(`Invalid node position. Must be one of: ${validPositions.join(', ')}`);
    }

    // Level validation
    if (data.node_level !== undefined && data.node_level < 0) {
      errors.push('Node level cannot be negative');
    }

    if (data.generation !== undefined && data.generation < 0) {
      errors.push('Generation cannot be negative');
    }

    return errors;
  }

  // Create node with validation
  async createNode(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if person exists
    const personSql = `
      SELECT * FROM persons 
      WHERE id = ? 
      AND deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [data.person_id]);
    if (!person) {
      throw new Error('Person not found');
    }

    // Check if tree exists
    const treeSql = `
      SELECT * FROM family_trees 
      WHERE tree_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [tree] = await this.executeQuery(treeSql, [data.family_tree_id]);
    if (!tree) {
      throw new Error('Family tree not found');
    }

    // Check if node already exists for this person in this tree
    const existingSql = `
      SELECT * FROM ${this.tableName}
      WHERE person_id = ?
      AND family_tree_id = ?
      AND deleted_at IS NULL
    `;
    
    const existing = await this.executeQuery(existingSql, [data.person_id, data.family_tree_id]);
    if (existing.length > 0) {
      throw new Error('This person already exists in this family tree');
    }

    // Calculate generation if not provided
    if (data.parent_node_id && !data.generation) {
      const parentSql = `
        SELECT generation FROM ${this.tableName}
        WHERE node_id = ?
        AND deleted_at IS NULL
      `;
      
      const [parent] = await this.executeQuery(parentSql, [data.parent_node_id]);
      if (parent) {
        data.generation = parent.generation + 1;
      }
    }

    const nodeData = {
      ...data,
      created_by: userId,
      node_level: data.node_level || 0,
      generation: data.generation || 1,
      node_order: data.node_order || 0,
      node_position: data.node_position || 'CENTER',
      is_root: data.is_root || false,
      is_primary_line: data.is_primary_line !== undefined ? data.is_primary_line : true,
      display_settings: data.display_settings || {
        expanded: true,
        show_photo: true,
        show_details: true
      }
    };

    return await this.create(nodeData);
  }

  // Get node with full details
  async getNodeWithDetails(nodeId) {
    const node = await this.findById(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // Get person details
    const personSql = `
      SELECT 
        p.*,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age,
        u.email as user_email
      FROM persons p
      LEFT JOIN users u ON p.id = u.person_id
      WHERE p.id = ?
      AND p.deleted_at IS NULL
    `;
    
    const [person] = await this.executeQuery(personSql, [node.person_id]);

    // Get parent node details
    let parent = null;
    if (node.parent_node_id) {
      const parentSql = `
        SELECT 
          ftn.*,
          p.full_name_arabic,
          p.full_name_english
        FROM ${this.tableName} ftn
        INNER JOIN persons p ON ftn.person_id = p.id
        WHERE ftn.node_id = ?
        AND ftn.deleted_at IS NULL
      `;
      
      const [parentResult] = await this.executeQuery(parentSql, [node.parent_node_id]);
      parent = parentResult;
    }

    // Get spouse node details
    let spouse = null;
    if (node.spouse_node_id) {
      const spouseSql = `
        SELECT 
          ftn.*,
          p.full_name_arabic,
          p.full_name_english,
          p.gender
        FROM ${this.tableName} ftn
        INNER JOIN persons p ON ftn.person_id = p.id
        WHERE ftn.node_id = ?
        AND ftn.deleted_at IS NULL
      `;
      
      const [spouseResult] = await this.executeQuery(spouseSql, [node.spouse_node_id]);
      spouse = spouseResult;
    }

    // Get children nodes
    const childrenSql = `
      SELECT 
        ftn.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        p.birth_date,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM ${this.tableName} ftn
      INNER JOIN persons p ON ftn.person_id = p.id
      WHERE ftn.parent_node_id = ?
      AND ftn.deleted_at IS NULL
      AND p.deleted_at IS NULL
      ORDER BY ftn.node_order, p.birth_date
    `;
    
    const children = await this.executeQuery(childrenSql, [nodeId]);

    // Get siblings nodes
    let siblings = [];
    if (node.parent_node_id) {
      const siblingsSql = `
        SELECT 
          ftn.*,
          p.full_name_arabic,
          p.full_name_english,
          p.gender,
          p.birth_date
        FROM ${this.tableName} ftn
        INNER JOIN persons p ON ftn.person_id = p.id
        WHERE ftn.parent_node_id = ?
        AND ftn.node_id != ?
        AND ftn.deleted_at IS NULL
        AND p.deleted_at IS NULL
        ORDER BY ftn.node_order, p.birth_date
      `;
      
      siblings = await this.executeQuery(siblingsSql, [node.parent_node_id, nodeId]);
    }

    // Get tree details
    const treeSql = `
      SELECT * FROM family_trees
      WHERE tree_id = ?
      AND deleted_at IS NULL
    `;
    
    const [tree] = await this.executeQuery(treeSql, [node.family_tree_id]);

    return {
      ...node,
      person: person || null,
      parent: parent || null,
      spouse: spouse || null,
      children: children,
      siblings: siblings,
      tree: tree || null
    };
  }

  // Get tree nodes
  async getTreeNodes(treeId, options = {}) {
    const {
      generation = null,
      parentNodeId = null,
      includeDetails = false
    } = options;

    let sql = `
      SELECT 
        ftn.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        p.birth_date,
        p.death_date,
        p.is_alive,
        p.photo_path
      FROM ${this.tableName} ftn
      INNER JOIN persons p ON ftn.person_id = p.id
      WHERE ftn.family_tree_id = ?
      AND ftn.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;
    
    const params = [treeId];

    if (generation !== null) {
      sql += ' AND ftn.generation = ?';
      params.push(generation);
    }

    if (parentNodeId !== null) {
      sql += ' AND ftn.parent_node_id = ?';
      params.push(parentNodeId);
    }

    sql += ' ORDER BY ftn.generation, ftn.node_level, ftn.node_order';

    const nodes = await this.executeQuery(sql, params);
    
    if (includeDetails) {
      const detailedNodes = [];
      for (const node of nodes) {
        const detailedNode = await this.getNodeWithDetails(node.node_id);
        detailedNodes.push(detailedNode);
      }
      return detailedNodes;
    }

    return nodes.map(record => this.processResult(record));
  }

  // Add child to node
  async addChild(nodeId, childPersonId, userId) {
    const parentNode = await this.getNodeWithDetails(nodeId);
    if (!parentNode) {
      throw new Error('Parent node not found');
    }

    // Check if child already exists in tree
    const existingChildSql = `
      SELECT * FROM ${this.tableName}
      WHERE person_id = ?
      AND family_tree_id = ?
      AND deleted_at IS NULL
    `;
    
    const existingChild = await this.executeQuery(existingChildSql, [
      childPersonId,
      parentNode.family_tree_id
    ]);

    if (existingChild.length > 0) {
      throw new Error('This person already exists in the family tree');
    }

    // Create child node
    const childNodeData = {
      person_id: childPersonId,
      family_tree_id: parentNode.family_tree_id,
      parent_node_id: nodeId,
      generation: parentNode.generation + 1,
      node_level: parentNode.node_level + 1,
      node_order: await this.getNextChildOrder(nodeId)
    };

    const childNode = await this.createNode(childNodeData, userId);

    // Create parent-child relationship
    const FamilyRelationship = (await import('./FamilyRelationship.js')).default;
    const relationshipModel = new FamilyRelationship();
    
    await relationshipModel.createRelationship({
      person_id: childPersonId,
      related_person_id: parentNode.person_id,
      relationship_type: parentNode.person.gender === 'M' ? 'FATHER' : 'MOTHER',
      is_biological: true
    }, userId);

    return childNode;
  }

  // Get next child order for parent
  async getNextChildOrder(parentNodeId) {
    const sql = `
      SELECT MAX(node_order) as max_order 
      FROM ${this.tableName}
      WHERE parent_node_id = ?
      AND deleted_at IS NULL
    `;
    
    const [result] = await this.executeQuery(sql, [parentNodeId]);
    return (result?.max_order || 0) + 1;
  }

  // Add spouse to node
  async addSpouse(nodeId, spousePersonId, userId) {
    const node = await this.getNodeWithDetails(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    // Check if spouse already exists in tree
    const existingSpouseSql = `
      SELECT * FROM ${this.tableName}
      WHERE person_id = ?
      AND family_tree_id = ?
      AND deleted_at IS NULL
    `;
    
    const existingSpouse = await this.executeQuery(existingSpouseSql, [
      spousePersonId,
      node.family_tree_id
    ]);

    let spouseNode;
    if (existingSpouse.length > 0) {
      spouseNode = existingSpouse[0];
    } else {
      // Create spouse node
      const spouseNodeData = {
        person_id: spousePersonId,
        family_tree_id: node.family_tree_id,
        generation: node.generation,
        node_level: node.node_level,
        node_position: node.node_position === 'LEFT' ? 'RIGHT' : 'LEFT'
      };

      spouseNode = await this.createNode(spouseNodeData, userId);
    }

    // Link nodes as spouses
    await this.update(nodeId, { spouse_node_id: spouseNode.node_id });
    await this.update(spouseNode.node_id, { spouse_node_id: nodeId });

    // Create spouse relationship
    const FamilyRelationship = (await import('./FamilyRelationship.js')).default;
    const relationshipModel = new FamilyRelationship();
    
    await relationshipModel.createRelationship({
      person_id: node.person_id,
      related_person_id: spousePersonId,
      relationship_type: node.person.gender === 'M' ? 'WIFE' : 'HUSBAND',
      is_biological: true
    }, userId);

    return {
      node: await this.getNodeWithDetails(nodeId),
      spouse: await this.getNodeWithDetails(spouseNode.node_id)
    };
  }

  // Get ancestry path
  async getAncestryPath(nodeId, maxGenerations = 5) {
    const node = await this.getNodeWithDetails(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    const ancestry = [node];
    let currentParent = node.parent;

    for (let i = 0; i < maxGenerations && currentParent; i++) {
      const parentDetails = await this.getNodeWithDetails(currentParent.node_id);
      ancestry.push(parentDetails);
      currentParent = parentDetails.parent;
    }

    return ancestry;
  }

  // Get descendants
  async getDescendants(nodeId, maxGenerations = 3) {
    const node = await this.getNodeWithDetails(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    const descendants = [];
    
    // Recursive function to get descendants
    const getDescendantsRecursive = async (parentNode, currentDepth) => {
      if (currentDepth >= maxGenerations) return;
      
      const children = await this.getChildren(parentNode.node_id);
      
      for (const child of children) {
        const childDetails = await this.getNodeWithDetails(child.node_id);
        descendants.push({
          ...childDetails,
          depth: currentDepth + 1
        });
        
        // Recursively get grandchildren
        await getDescendantsRecursive(childDetails, currentDepth + 1);
      }
    };

    await getDescendantsRecursive(node, 0);
    return descendants;
  }

  // Get children
  async getChildren(nodeId) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE parent_node_id = ?
      AND deleted_at IS NULL
      ORDER BY node_order, created_at
    `;
    
    return await this.executeQuery(sql, [nodeId]);
  }

  // Update node position
  async updateNodePosition(nodeId, positionData) {
    const node = await this.findById(nodeId);
    if (!node) {
      throw new Error('Node not found');
    }

    const updateData = {};
    
    if (positionData.node_level !== undefined) {
      updateData.node_level = positionData.node_level;
    }
    
    if (positionData.node_order !== undefined) {
      updateData.node_order = positionData.node_order;
    }
    
    if (positionData.node_position) {
      updateData.node_position = positionData.node_position;
    }
    
    if (positionData.parent_node_id !== undefined) {
      updateData.parent_node_id = positionData.parent_node_id;
      
      // Update generation if parent changed
      if (positionData.parent_node_id) {
        const parentSql = `
          SELECT generation FROM ${this.tableName}
          WHERE node_id = ?
          AND deleted_at IS NULL
        `;
        
        const [parent] = await this.executeQuery(parentSql, [positionData.parent_node_id]);
        if (parent) {
          updateData.generation = parent.generation + 1;
        }
      }
    }

    if (Object.keys(updateData).length > 0) {
      return await this.update(nodeId, updateData);
    }

    return node;
  }

  // Search nodes in tree
  async searchNodesInTree(treeId, searchTerm, options = {}) {
    const { limit = 20, page = 1 } = options;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        ftn.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        p.birth_date,
        MATCH(p.full_name_arabic, p.full_name_english) AGAINST(? IN NATURAL LANGUAGE MODE) as relevance
      FROM ${this.tableName} ftn
      INNER JOIN persons p ON ftn.person_id = p.id
      WHERE ftn.family_tree_id = ?
      AND ftn.deleted_at IS NULL
      AND p.deleted_at IS NULL
      AND (p.full_name_arabic LIKE ? OR p.full_name_english LIKE ?)
      ORDER BY relevance DESC, ftn.generation, ftn.node_level
      LIMIT ? OFFSET ?
    `;
    
    const params = [
      searchTerm,
      treeId,
      `%${searchTerm}%`,
      `%${searchTerm}%`,
      limit,
      offset
    ];

    const results = await this.executeQuery(sql, params);
    return results.map(record => this.processResult(record));
  }
}

export default FamilyTreeNode;
