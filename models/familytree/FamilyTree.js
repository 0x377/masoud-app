import BaseModel from '../BaseModel.js';

class FamilyTree extends BaseModel {
  constructor() {
    super('family_trees', 'tree_id');
    this.jsonFields = ['tree_settings', 'statistics', 'metadata'];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate && !data.tree_name_arabic) {
      errors.push('Arabic tree name is required');
    }

    // Tree type validation
    const validTreeTypes = ['PATERNAL', 'MATERNAL', 'COMBINED', 'BRANCH'];
    if (data.tree_type && !validTreeTypes.includes(data.tree_type)) {
      errors.push(`Invalid tree type. Must be one of: ${validTreeTypes.join(', ')}`);
    }

    // Access level validation
    const validAccessLevels = ['PUBLIC', 'FAMILY_ONLY', 'PRIVATE'];
    if (data.access_level && !validAccessLevels.includes(data.access_level)) {
      errors.push(`Invalid access level. Must be one of: ${validAccessLevels.join(', ')}`);
    }

    // Generation depth validation
    if (data.generation_depth !== undefined) {
      if (data.generation_depth < 1 || data.generation_depth > 20) {
        errors.push('Generation depth must be between 1 and 20');
      }
    }

    return errors;
  }

  // Create family tree with validation
  async createFamilyTree(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    const treeData = {
      ...data,
      created_by: userId,
      tree_type: data.tree_type || 'PATERNAL',
      access_level: data.access_level || 'FAMILY_ONLY',
      generation_depth: data.generation_depth || 5,
      is_public: data.is_public || false,
      tree_settings: data.tree_settings || {
        layout: 'horizontal',
        node_width: 200,
        node_height: 100,
        spacing: 50,
        colors: {
          male: '#3498db',
          female: '#e74c3c',
          deceased: '#95a5a6'
        }
      }
    };

    const tree = await this.create(treeData);
    
    // Auto-create root node if root_person_id is provided
    if (tree.root_person_id) {
      const FamilyTreeNode = (await import('./FamilyTreeNode.js')).default;
      const treeNodeModel = new FamilyTreeNode();
      
      await treeNodeModel.createNode({
        person_id: tree.root_person_id,
        family_tree_id: tree.tree_id,
        is_root: true,
        generation: 1,
        node_level: 0,
        display_settings: {
          expanded: true,
          highlighted: true
        }
      }, userId);
    }

    return tree;
  }

  // Get tree with full details
  async getTreeWithDetails(treeId, userId = null) {
    const tree = await this.findById(treeId);
    if (!tree) {
      throw new Error('Family tree not found');
    }

    // Check access permissions
    if (!await this.checkTreeAccess(treeId, userId)) {
      throw new Error('Access denied to this family tree');
    }

    // Get root person details
    let rootPerson = null;
    if (tree.root_person_id) {
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
      
      const [personResult] = await this.executeQuery(personSql, [tree.root_person_id]);
      rootPerson = personResult;
    }

    // Get creator details
    let creator = null;
    if (tree.created_by) {
      const creatorSql = `
        SELECT 
          u.id,
          u.email,
          u.user_type,
          p.full_name_arabic,
          p.full_name_english
        FROM users u
        LEFT JOIN persons p ON u.person_id = p.id
        WHERE u.id = ?
        AND u.deleted_at IS NULL
      `;
      
      const [creatorResult] = await this.executeQuery(creatorSql, [tree.created_by]);
      creator = creatorResult;
    }

    // Get tree statistics
    const statistics = await this.calculateTreeStatistics(treeId);

    // Get branches count
    const branchesSql = `
      SELECT COUNT(*) as count FROM family_branches
      WHERE family_tree_id = ?
      AND is_active = TRUE
      AND deleted_at IS NULL
    `;
    
    const [branchesCount] = await this.executeQuery(branchesSql, [treeId]);

    // Get nodes count
    const nodesSql = `
      SELECT COUNT(*) as count FROM family_tree_nodes
      WHERE family_tree_id = ?
      AND deleted_at IS NULL
    `;
    
    const [nodesCount] = await this.executeQuery(nodesSql, [treeId]);

    // Get recent updates
    const recentUpdatesSql = `
      SELECT 
        'NODE' as type,
        ftn.updated_at,
        p.full_name_arabic,
        p.full_name_english
      FROM family_tree_nodes ftn
      INNER JOIN persons p ON ftn.person_id = p.id
      WHERE ftn.family_tree_id = ?
      AND ftn.deleted_at IS NULL
      UNION ALL
      SELECT 
        'EVENT' as type,
        fe.updated_at,
        p.full_name_arabic,
        p.full_name_english
      FROM family_events fe
      INNER JOIN persons p ON fe.primary_person_id = p.id
      WHERE fe.family_tree_id = ?
      AND fe.deleted_at IS NULL
      ORDER BY updated_at DESC
      LIMIT 10
    `;
    
    const recentUpdates = await this.executeQuery(recentUpdatesSql, [treeId, treeId]);

    return {
      ...tree,
      root_person: rootPerson,
      creator: creator,
      statistics: {
        ...statistics,
        branches_count: branchesCount?.count || 0,
        nodes_count: nodesCount?.count || 0
      },
      recent_updates: recentUpdates
    };
  }

  // Check tree access permissions
  async checkTreeAccess(treeId, userId = null) {
    const tree = await this.findById(treeId);
    if (!tree) {
      return false;
    }

    // Public trees are accessible to everyone
    if (tree.is_public || tree.access_level === 'PUBLIC') {
      return true;
    }

    // Private trees need authentication
    if (!userId) {
      return false;
    }

    // Family-only trees - check if user is family member
    if (tree.access_level === 'FAMILY_ONLY') {
      // TODO: Implement family membership check
      // For now, allow access to authenticated users
      return true;
    }

    // Private trees - check explicit shares
    if (tree.access_level === 'PRIVATE') {
      const shareSql = `
        SELECT * FROM family_tree_shares
        WHERE family_tree_id = ?
        AND (shared_with_user_id = ? OR shared_with_email = (SELECT email FROM users WHERE id = ?))
        AND is_active = TRUE
        AND (expires_at IS NULL OR expires_at > NOW())
        LIMIT 1
      `;
      
      const [share] = await this.executeQuery(shareSql, [treeId, userId, userId]);
      if (share) {
        return true;
      }
      
      // Check if user is the creator
      return tree.created_by === userId;
    }

    return false;
  }

  // Calculate tree statistics
  async calculateTreeStatistics(treeId) {
    // Get person statistics from tree nodes
    const statsSql = `
      SELECT 
        COUNT(DISTINCT ftn.person_id) as total_persons,
        COUNT(DISTINCT CASE WHEN p.gender = 'M' THEN p.id END) as males,
        COUNT(DISTINCT CASE WHEN p.gender = 'F' THEN p.id END) as females,
        COUNT(DISTINCT CASE WHEN p.is_alive = FALSE THEN p.id END) as deceased,
        COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) < 18 THEN p.id END) as children,
        COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) BETWEEN 18 AND 60 THEN p.id END) as adults,
        COUNT(DISTINCT CASE WHEN TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) > 60 THEN p.id END) as seniors,
        AVG(TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE())) as avg_age,
        MIN(p.birth_date) as oldest_birth,
        MAX(p.birth_date) as youngest_birth,
        MAX(ftn.generation) as max_generation,
        MIN(ftn.generation) as min_generation
      FROM family_tree_nodes ftn
      INNER JOIN persons p ON ftn.person_id = p.id
      WHERE ftn.family_tree_id = ?
      AND ftn.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;
    
    const [stats] = await this.executeQuery(statsSql, [treeId]);

    // Get marriage statistics
    const marriageSql = `
      SELECT 
        COUNT(DISTINCT fe.event_id) as total_marriages,
        COUNT(DISTINCT CASE WHEN YEAR(fe.event_date) = YEAR(CURDATE()) THEN fe.event_id END) as marriages_this_year,
        AVG(TIMESTAMPDIFF(YEAR, p.birth_date, fe.event_date)) as avg_marriage_age
      FROM family_events fe
      INNER JOIN persons p ON fe.primary_person_id = p.id
      WHERE fe.family_tree_id = ?
      AND fe.event_type = 'MARRIAGE'
      AND fe.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;
    
    const [marriageStats] = await this.executeQuery(marriageSql, [treeId]);

    // Get geographical distribution
    const geoStats = {}; // Would need person addresses data

    return {
      ...stats,
      marriage_stats: marriageStats,
      geographical_stats: geoStats
    };
  }

  // Search family trees
  async searchFamilyTrees(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      userId = null
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        ft.*,
        u.email as creator_email,
        p.full_name_arabic as root_person_name
      FROM ${this.tableName} ft
      LEFT JOIN users u ON ft.created_by = u.id
      LEFT JOIN persons p ON ft.root_person_id = p.id
      WHERE ft.deleted_at IS NULL
    `;
    
    const params = [];

    // Apply filters
    if (filters.tree_type) {
      sql += ' AND ft.tree_type = ?';
      params.push(filters.tree_type);
    }

    if (filters.access_level) {
      sql += ' AND ft.access_level = ?';
      params.push(filters.access_level);
    }

    if (filters.is_public !== undefined) {
      sql += ' AND ft.is_public = ?';
      params.push(filters.is_public);
    }

    if (filters.search) {
      sql += ' AND (ft.tree_name_arabic LIKE ? OR ft.tree_name_english LIKE ? OR ft.description LIKE ?)';
      params.push(`%${filters.search}%`, `%${filters.search}%`, `%${filters.search}%`);
    }

    if (filters.created_by) {
      sql += ' AND ft.created_by = ?';
      params.push(filters.created_by);
    }

    // Apply access control
    if (userId) {
      sql += ' AND (ft.is_public = TRUE OR ft.access_level = "PUBLIC" OR ft.created_by = ?';
      params.push(userId);
      
      // Check shares
      sql += ' OR EXISTS (SELECT 1 FROM family_tree_shares fts WHERE fts.family_tree_id = ft.tree_id AND fts.shared_with_user_id = ? AND fts.is_active = TRUE AND (fts.expires_at IS NULL OR fts.expires_at > NOW()))';
      params.push(userId);
      
      sql += ')';
    } else {
      // For non-authenticated users, only show public trees
      sql += ' AND (ft.is_public = TRUE OR ft.access_level = "PUBLIC")';
    }

    // Sort
    sql += ' ORDER BY ft.created_at DESC';

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += ' LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const data = await this.executeQuery(sql, params);
    const processedData = data.map(record => this.processResult(record));

    // Get statistics for each tree
    for (const tree of processedData) {
      tree.statistics = await this.calculateTreeStatistics(tree.tree_id);
    }

    return {
      data: processedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1
      }
    };
  }

  // Update tree settings
  async updateTreeSettings(treeId, settings) {
    const tree = await this.findById(treeId);
    if (!tree) {
      throw new Error('Family tree not found');
    }

    const currentSettings = tree.tree_settings || {};
    const updatedSettings = { ...currentSettings, ...settings };

    return await this.update(treeId, {
      tree_settings: updatedSettings,
      updated_at: this.formatDate(new Date())
    });
  }

  // Export tree data
  async exportTreeData(treeId, format = 'json') {
    const tree = await this.getTreeWithDetails(treeId);
    
    // Get all nodes with person details
    const nodesSql = `
      SELECT 
        ftn.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        p.birth_date,
        p.death_date,
        p.is_alive,
        p.photo_path
      FROM family_tree_nodes ftn
      INNER JOIN persons p ON ftn.person_id = p.id
      WHERE ftn.family_tree_id = ?
      AND ftn.deleted_at IS NULL
      AND p.deleted_at IS NULL
      ORDER BY ftn.generation, ftn.node_level, ftn.node_order
    `;
    
    const nodes = await this.executeQuery(nodesSql, [treeId]);

    // Get all relationships
    const relationshipsSql = `
      SELECT 
        fr.*,
        p1.full_name_arabic as person_name,
        p2.full_name_arabic as related_person_name
      FROM family_relationships fr
      INNER JOIN persons p1 ON fr.person_id = p1.id
      INNER JOIN persons p2 ON fr.related_person_id = p2.id
      WHERE EXISTS (
        SELECT 1 FROM family_tree_nodes ftn 
        WHERE ftn.person_id IN (fr.person_id, fr.related_person_id)
        AND ftn.family_tree_id = ?
      )
      AND fr.deleted_at IS NULL
    `;
    
    const relationships = await this.executeQuery(relationshipsSql, [treeId]);

    // Get all events
    const eventsSql = `
      SELECT * FROM family_events
      WHERE family_tree_id = ?
      AND deleted_at IS NULL
      ORDER BY event_date DESC
    `;
    
    const events = await this.executeQuery(eventsSql, [treeId]);

    return {
      tree,
      nodes,
      relationships,
      events,
      export_date: new Date().toISOString(),
      format
    };
  }

  // Share tree with user
  async shareTree(treeId, sharedByUserId, shareData) {
    const tree = await this.findById(treeId);
    if (!tree) {
      throw new Error('Family tree not found');
    }

    // Check if user has permission to share
    if (tree.created_by !== sharedByUserId) {
      // TODO: Check if user has admin permissions
      throw new Error('You do not have permission to share this tree');
    }

    const { shared_with_email, shared_with_user_id, access_level, expires_at, permissions } = shareData;
    
    if (!shared_with_email && !shared_with_user_id) {
      throw new Error('Either email or user ID is required');
    }

    // Generate share token
    const shareToken = require('crypto').randomBytes(32).toString('hex');

    const shareDataToInsert = {
      family_tree_id: treeId,
      shared_by: sharedByUserId,
      shared_with_email,
      shared_with_user_id,
      access_level: access_level || 'VIEW_ONLY',
      share_token: shareToken,
      expires_at: expires_at ? this.formatDate(expires_at) : null,
      permissions: permissions || {},
      is_active: true
    };

    // Check for existing share
    const existingSql = `
      SELECT * FROM family_tree_shares
      WHERE family_tree_id = ?
      AND (
        (shared_with_email = ? AND shared_with_email IS NOT NULL) OR
        (shared_with_user_id = ? AND shared_with_user_id IS NOT NULL)
      )
      AND is_active = TRUE
    `;
    
    const existing = await this.executeQuery(existingSql, [treeId, shared_with_email, shared_with_user_id]);
    
    if (existing.length > 0) {
      // Update existing share
      const updateSql = `
        UPDATE family_tree_shares
        SET access_level = ?,
            expires_at = ?,
            permissions = ?,
            updated_at = NOW()
        WHERE share_id = ?
      `;
      
      await this.executeQuery(updateSql, [
        access_level || 'VIEW_ONLY',
        expires_at ? this.formatDate(expires_at) : null,
        JSON.stringify(permissions || {}),
        existing[0].share_id
      ]);
      
      return { ...existing[0], share_token: existing[0].share_token };
    } else {
      // Create new share
      const FamilyTreeShare = (await import('./FamilyTreeShare.js')).default;
      const shareModel = new FamilyTreeShare();
      
      return await shareModel.create(shareDataToInsert);
    }
  }

  // Get tree branches
  async getTreeBranches(treeId) {
    const FamilyBranch = (await import('./FamilyBranch.js')).default;
    const branchModel = new FamilyBranch();
    
    return await branchModel.getBranchesByTree(treeId);
  }
}

export default FamilyTree;
