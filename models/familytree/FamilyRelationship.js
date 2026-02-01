import BaseModel from "./BaseModel.js";
import db from "../config/database.js";

class FamilyRelationship extends BaseModel {
  constructor() {
    super("family_relationships", "relationship_id");
    this.jsonFields = ["proof_documents", "metadata"];
  }

  // Relationship type mapping for reciprocals
  static reciprocalMap = {
    FATHER: "SON",
    MOTHER: "DAUGHTER",
    SON: "FATHER",
    DAUGHTER: "MOTHER",
    HUSBAND: "WIFE",
    WIFE: "HUSBAND",
    BROTHER: "BROTHER",
    SISTER: "SISTER",
    GRANDFATHER: "GRANDSON",
    GRANDMOTHER: "GRANDDAUGHTER",
    GRANDSON: "GRANDFATHER",
    GRANDDAUGHTER: "GRANDMOTHER",
    UNCLE: "NEPHEW",
    AUNT: "NIECE",
    NEPHEW: "UNCLE",
    NIECE: "AUNT",
    COUSIN: "COUSIN",
    FATHER_IN_LAW: "SON_IN_LAW",
    MOTHER_IN_LAW: "DAUGHTER_IN_LAW",
    SON_IN_LAW: "FATHER_IN_LAW",
    DAUGHTER_IN_LAW: "MOTHER_IN_LAW",
    BROTHER_IN_LAW: "BROTHER_IN_LAW",
    SISTER_IN_LAW: "SISTER_IN_LAW",
    STEP_FATHER: "STEP_SON",
    STEP_MOTHER: "STEP_DAUGHTER",
    STEP_SON: "STEP_FATHER",
    STEP_DAUGHTER: "STEP_MOTHER",
    ADOPTED_SON: "ADOPTIVE_FATHER",
    ADOPTED_DAUGHTER: "ADOPTIVE_MOTHER",
  };

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.person_id) {
        errors.push("Person ID is required");
      }
      if (!data.related_person_id) {
        errors.push("Related person ID is required");
      }
      if (!data.relationship_type) {
        errors.push("Relationship type is required");
      }
    }

    // Check if persons are different
    if (
      data.person_id &&
      data.related_person_id &&
      data.person_id === data.related_person_id
    ) {
      errors.push("A person cannot have a relationship with themselves");
    }

    // Relationship type validation
    const validTypes = [
      "FATHER",
      "MOTHER",
      "SON",
      "DAUGHTER",
      "BROTHER",
      "SISTER",
      "HUSBAND",
      "WIFE",
      "GRANDFATHER",
      "GRANDMOTHER",
      "GRANDSON",
      "GRANDDAUGHTER",
      "UNCLE",
      "AUNT",
      "NEPHEW",
      "NIECE",
      "COUSIN",
      "FATHER_IN_LAW",
      "MOTHER_IN_LAW",
      "SON_IN_LAW",
      "DAUGHTER_IN_LAW",
      "BROTHER_IN_LAW",
      "SISTER_IN_LAW",
      "STEP_FATHER",
      "STEP_MOTHER",
      "STEP_SON",
      "STEP_DAUGHTER",
      "ADOPTED_SON",
      "ADOPTED_DAUGHTER",
    ];

    if (
      data.relationship_type &&
      !validTypes.includes(data.relationship_type)
    ) {
      errors.push(
        `Invalid relationship type. Must be one of: ${validTypes.join(", ")}`,
      );
    }

    // Status validation
    const validStatuses = ["ACTIVE", "DISSOLVED", "DECEASED"];
    if (
      data.relationship_status &&
      !validStatuses.includes(data.relationship_status)
    ) {
      errors.push(
        `Invalid relationship status. Must be one of: ${validStatuses.join(", ")}`,
      );
    }

    // Certainty level validation
    const validCertaintyLevels = [
      "CONFIRMED",
      "LIKELY",
      "POSSIBLE",
      "UNCERTAIN",
    ];
    if (
      data.certainty_level &&
      !validCertaintyLevels.includes(data.certainty_level)
    ) {
      errors.push(
        `Invalid certainty level. Must be one of: ${validCertaintyLevels.join(", ")}`,
      );
    }

    // Date validation
    if (data.start_date && data.end_date) {
      const startDate = new Date(data.start_date);
      const endDate = new Date(data.end_date);
      if (startDate > endDate) {
        errors.push("Start date cannot be after end date");
      }
    }

    return errors;
  }

  // Create relationship with validation
  async createRelationship(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    // Check if persons exist
    const personSql = `
      SELECT * FROM persons 
      WHERE id = ? 
      AND deleted_at IS NULL
    `;

    const [person1] = await this.executeQuery(personSql, [data.person_id]);
    const [person2] = await this.executeQuery(personSql, [
      data.related_person_id,
    ]);

    if (!person1 || !person2) {
      throw new Error("One or both persons not found");
    }

    // Check for existing relationship
    const existingSql = `
      SELECT * FROM ${this.tableName}
      WHERE person_id = ?
      AND related_person_id = ?
      AND relationship_type = ?
      AND deleted_at IS NULL
    `;

    const existing = await this.executeQuery(existingSql, [
      data.person_id,
      data.related_person_id,
      data.relationship_type,
    ]);

    if (existing.length > 0) {
      throw new Error("This relationship already exists");
    }

    // Calculate reciprocal relationship type
    const reciprocalType =
      FamilyRelationship.reciprocalMap[data.relationship_type] || "OTHER";

    const relationshipData = {
      ...data,
      created_by: userId,
      reciprocal_relationship_type: reciprocalType,
      relationship_status: data.relationship_status || "ACTIVE",
      certainty_level: data.certainty_level || "CONFIRMED",
      is_biological:
        data.is_biological !== undefined ? data.is_biological : true,
    };

    return await this.create(relationshipData);
  }

  // Get relationship with details
  async getRelationshipWithDetails(relationshipId) {
    const relationship = await this.findById(relationshipId);
    if (!relationship) {
      throw new Error("Relationship not found");
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

    const [person] = await this.executeQuery(personSql, [
      relationship.person_id,
    ]);
    const [relatedPerson] = await this.executeQuery(personSql, [
      relationship.related_person_id,
    ]);

    // Get verifier details
    let verifier = null;
    if (relationship.verified_by) {
      const verifierSql = `
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

      const [verifierResult] = await this.executeQuery(verifierSql, [
        relationship.verified_by,
      ]);
      verifier = verifierResult;
    }

    // Get creator details
    let creator = null;
    if (relationship.created_by) {
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

      const [creatorResult] = await this.executeQuery(creatorSql, [
        relationship.created_by,
      ]);
      creator = creatorResult;
    }

    // Get reciprocal relationship
    const reciprocalSql = `
      SELECT * FROM ${this.tableName}
      WHERE person_id = ?
      AND related_person_id = ?
      AND deleted_at IS NULL
      LIMIT 1
    `;

    const [reciprocal] = await this.executeQuery(reciprocalSql, [
      relationship.related_person_id,
      relationship.person_id,
    ]);

    return {
      ...relationship,
      person: person || null,
      related_person: relatedPerson || null,
      verifier: verifier || null,
      creator: creator || null,
      reciprocal_relationship: reciprocal || null,
    };
  }

  // Get relationships for person
  async getPersonRelationships(personId, options = {}) {
    const {
      relationshipType = null,
      activeOnly = true,
      includeReciprocal = true,
      page = 1,
      limit = 50,
    } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        fr.*,
        p.full_name_arabic as related_person_name_arabic,
        p.full_name_english as related_person_name_english,
        p.gender as related_person_gender,
        p.birth_date as related_person_birth_date,
        p.photo_path as related_person_photo,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as related_person_age
      FROM ${this.tableName} fr
      INNER JOIN persons p ON fr.related_person_id = p.id
      WHERE fr.person_id = ?
      AND fr.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;

    const params = [personId];

    if (relationshipType) {
      sql += " AND fr.relationship_type = ?";
      params.push(relationshipType);
    }

    if (activeOnly) {
      sql += ' AND fr.relationship_status = "ACTIVE"';
    }

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data
    sql += " ORDER BY fr.relationship_type, fr.start_date DESC";
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const relationships = await this.executeQuery(sql, params);
    const processedRelationships = relationships.map((record) =>
      this.processResult(record),
    );

    // Include reciprocal relationships if requested
    let allRelationships = processedRelationships;

    if (includeReciprocal) {
      const reciprocalSql = `
        SELECT 
          fr.*,
          p.full_name_arabic as person_name_arabic,
          p.full_name_english as person_name_english,
          p.gender as person_gender,
          p.birth_date as person_birth_date,
          p.photo_path as person_photo,
          TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as person_age
        FROM ${this.tableName} fr
        INNER JOIN persons p ON fr.person_id = p.id
        WHERE fr.related_person_id = ?
        AND fr.deleted_at IS NULL
        AND p.deleted_at IS NULL
        ORDER BY fr.relationship_type, fr.start_date DESC
      `;

      const reciprocalRelationships = await this.executeQuery(reciprocalSql, [
        personId,
      ]);
      const processedReciprocal = reciprocalRelationships.map((record) =>
        this.processResult(record),
      );

      allRelationships = [...processedRelationships, ...processedReciprocal];
    }

    // Group relationships by type
    const groupedRelationships = {};
    allRelationships.forEach((rel) => {
      if (!groupedRelationships[rel.relationship_type]) {
        groupedRelationships[rel.relationship_type] = [];
      }
      groupedRelationships[rel.relationship_type].push(rel);
    });

    return {
      relationships: allRelationships,
      grouped_relationships: groupedRelationships,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    };
  }

  // Verify relationship
  async verifyRelationship(relationshipId, verifierId, notes = "") {
    const relationship = await this.findById(relationshipId);
    if (!relationship) {
      throw new Error("Relationship not found");
    }

    if (relationship.verified_by) {
      throw new Error("Relationship already verified");
    }

    return await this.update(relationshipId, {
      verified_by: verifierId,
      verified_at: this.formatDate(new Date()),
      certainty_level: "CONFIRMED",
    });
  }

  // Update relationship status
  async updateRelationshipStatus(relationshipId, status, reason = "") {
    const relationship = await this.findById(relationshipId);
    if (!relationship) {
      throw new Error("Relationship not found");
    }

    const updateData = {
      relationship_status: status,
      updated_at: this.formatDate(new Date()),
    };

    if (status === "DISSOLVED" || status === "DECEASED") {
      updateData.end_date = this.formatDate(new Date());
    }

    if (reason) {
      updateData.notes = relationship.notes
        ? `${relationship.notes}\n${new Date().toISOString()}: ${reason}`
        : `${new Date().toISOString()}: ${reason}`;
    }

    return await this.update(relationshipId, updateData);
  }

  // Search relationships
  async searchRelationships(filters = {}, options = {}) {
    const { page = 1, limit = 50, includePersons = true } = options;

    const offset = (page - 1) * limit;
    let sql = `
      SELECT 
        fr.*,
        p1.full_name_arabic as person_name_arabic,
        p1.full_name_english as person_name_english,
        p2.full_name_arabic as related_person_name_arabic,
        p2.full_name_english as related_person_name_english
      FROM ${this.tableName} fr
      INNER JOIN persons p1 ON fr.person_id = p1.id
      INNER JOIN persons p2 ON fr.related_person_id = p2.id
      WHERE fr.deleted_at IS NULL
      AND p1.deleted_at IS NULL
      AND p2.deleted_at IS NULL
    `;

    const params = [];

    // Apply filters
    if (filters.person_id) {
      sql += " AND (fr.person_id = ? OR fr.related_person_id = ?)";
      params.push(filters.person_id, filters.person_id);
    }

    if (filters.relationship_type) {
      sql += " AND fr.relationship_type = ?";
      params.push(filters.relationship_type);
    }

    if (filters.relationship_status) {
      sql += " AND fr.relationship_status = ?";
      params.push(filters.relationship_status);
    }

    if (filters.certainty_level) {
      sql += " AND fr.certainty_level = ?";
      params.push(filters.certainty_level);
    }

    if (filters.is_biological !== undefined) {
      sql += " AND fr.is_biological = ?";
      params.push(filters.is_biological);
    }

    if (filters.start_date_from) {
      sql += " AND fr.start_date >= ?";
      params.push(filters.start_date_from);
    }

    if (filters.start_date_to) {
      sql += " AND fr.start_date <= ?";
      params.push(filters.start_date_to);
    }

    if (filters.verified !== undefined) {
      if (filters.verified) {
        sql += " AND fr.verified_by IS NOT NULL";
      } else {
        sql += " AND fr.verified_by IS NULL";
      }
    }

    if (filters.search) {
      sql +=
        " AND (p1.full_name_arabic LIKE ? OR p1.full_name_english LIKE ? OR p2.full_name_arabic LIKE ? OR p2.full_name_english LIKE ?)";
      params.push(
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
        `%${filters.search}%`,
      );
    }

    // Sort
    sql += " ORDER BY fr.created_at DESC";

    // Count total
    const countSql = `SELECT COUNT(*) as total FROM (${sql}) as temp`;
    const [countResult] = await this.executeQuery(countSql, params);
    const total = countResult?.total || 0;

    // Get data with pagination
    sql += " LIMIT ? OFFSET ?";
    params.push(limit, offset);

    const data = await this.executeQuery(sql, params);
    const processedData = data.map((record) => this.processResult(record));

    return {
      data: processedData,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        hasNext: page < Math.ceil(total / limit),
        hasPrevious: page > 1,
      },
    };
  }

  // Find relationship between two persons
  async findRelationshipBetween(personId1, personId2) {
    const sql = `
      SELECT * FROM ${this.tableName}
      WHERE (
        (person_id = ? AND related_person_id = ?) OR
        (person_id = ? AND related_person_id = ?)
      )
      AND deleted_at IS NULL
      ORDER BY certainty_level DESC, created_at DESC
      LIMIT 1
    `;

    const results = await this.executeQuery(sql, [
      personId1,
      personId2,
      personId2,
      personId1,
    ]);
    return results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Get family members for a person
  async getFamilyMembers(personId, options = {}) {
    const {
      relationshipTypes = [
        "FATHER",
        "MOTHER",
        "SON",
        "DAUGHTER",
        "BROTHER",
        "SISTER",
        "HUSBAND",
        "WIFE",
      ],
      activeOnly = true,
      includeSpouses = true,
    } = options;

    let sql = `
      SELECT 
        fr.*,
        p.full_name_arabic,
        p.full_name_english,
        p.gender,
        p.birth_date,
        p.death_date,
        p.is_alive,
        p.photo_path,
        TIMESTAMPDIFF(YEAR, p.birth_date, CURDATE()) as age
      FROM ${this.tableName} fr
      INNER JOIN persons p ON fr.related_person_id = p.id
      WHERE fr.person_id = ?
      AND fr.deleted_at IS NULL
      AND p.deleted_at IS NULL
    `;

    const params = [personId];

    if (relationshipTypes.length > 0) {
      const placeholders = relationshipTypes.map(() => "?").join(",");
      sql += ` AND fr.relationship_type IN (${placeholders})`;
      params.push(...relationshipTypes);
    }

    if (activeOnly) {
      sql += ' AND fr.relationship_status = "ACTIVE"';
    }

    const familyMembers = await this.executeQuery(sql, params);
    const processedMembers = familyMembers.map((record) =>
      this.processResult(record),
    );

    // Optionally include spouses of parents
    if (includeSpouses) {
      // Get parents first
      const parents = processedMembers.filter(
        (member) =>
          member.relationship_type === "FATHER" ||
          member.relationship_type === "MOTHER",
      );

      // For each parent, get their spouse
      for (const parent of parents) {
        const spouseSql = `
          SELECT 
            fr.*,
            p.full_name_arabic,
            p.full_name_english,
            p.gender,
            p.birth_date,
            p.photo_path
          FROM ${this.tableName} fr
          INNER JOIN persons p ON fr.related_person_id = p.id
          WHERE fr.person_id = ?
          AND fr.relationship_type IN ('HUSBAND', 'WIFE')
          AND fr.relationship_status = 'ACTIVE'
          AND fr.deleted_at IS NULL
          AND p.deleted_at IS NULL
          LIMIT 1
        `;

        const [spouse] = await this.executeQuery(spouseSql, [
          parent.related_person_id,
        ]);

        if (
          spouse &&
          !processedMembers.some(
            (m) => m.relationship_id === spouse.relationship_id,
          )
        ) {
          processedMembers.push(this.processResult(spouse));
        }
      }
    }

    // Group by relationship type
    const grouped = {};
    processedMembers.forEach((member) => {
      if (!grouped[member.relationship_type]) {
        grouped[member.relationship_type] = [];
      }
      grouped[member.relationship_type].push(member);
    });

    return {
      family_members: processedMembers,
      grouped_members: grouped,
    };
  }

  // Get immediate family (parents, spouse, children)
  async getImmediateFamily(personId) {
    const result = await this.getFamilyMembers(personId, {
      relationshipTypes: [
        "FATHER",
        "MOTHER",
        "HUSBAND",
        "WIFE",
        "SON",
        "DAUGHTER",
      ],
      activeOnly: true,
      includeSpouses: true,
    });

    // Structure the response
    const immediateFamily = {
      parents: {
        father: result.grouped_members["FATHER"]?.[0] || null,
        mother: result.grouped_members["MOTHER"]?.[0] || null,
      },
      spouse:
        result.grouped_members["HUSBAND"]?.[0] ||
        result.grouped_members["WIFE"]?.[0] ||
        null,
      children: [
        ...(result.grouped_members["SON"] || []),
        ...(result.grouped_members["DAUGHTER"] || []),
      ].sort(
        (a, b) => new Date(a.birth_date || 0) - new Date(b.birth_date || 0),
      ),
      siblings: [],
    };

    // Get siblings through parents
    if (immediateFamily.parents.father || immediateFamily.parents.mother) {
      const parentIds = [
        immediateFamily.parents.father?.related_person_id,
        immediateFamily.parents.mother?.related_person_id,
      ].filter((id) => id);

      if (parentIds.length > 0) {
        const placeholders = parentIds.map(() => "?").join(",");
        const siblingSql = `
          SELECT 
            fr.*,
            p.full_name_arabic,
            p.full_name_english,
            p.gender,
            p.birth_date
          FROM ${this.tableName} fr
          INNER JOIN persons p ON fr.related_person_id = p.id
          WHERE fr.person_id IN (${placeholders})
          AND fr.relationship_type IN ('SON', 'DAUGHTER')
          AND fr.related_person_id != ?
          AND fr.relationship_status = 'ACTIVE'
          AND fr.deleted_at IS NULL
          AND p.deleted_at IS NULL
          ORDER BY p.birth_date
        `;

        const siblings = await this.executeQuery(siblingSql, [
          ...parentIds,
          personId,
        ]);
        immediateFamily.siblings = siblings.map((record) =>
          this.processResult(record),
        );
      }
    }

    return immediateFamily;
  }

  // Get ancestors (parents, grandparents, etc.)
  async getAncestors(personId, maxGenerations = 4) {
    const ancestors = [];

    // Recursive function to get ancestors
    const getAncestorsRecursive = async (
      currentPersonId,
      currentGeneration,
    ) => {
      if (currentGeneration >= maxGenerations) return;

      // Get parents
      const parentsSql = `
        SELECT 
          fr.*,
          p.full_name_arabic,
          p.full_name_english,
          p.gender,
          p.birth_date,
          p.death_date,
          p.is_alive
        FROM ${this.tableName} fr
        INNER JOIN persons p ON fr.related_person_id = p.id
        WHERE fr.person_id = ?
        AND fr.relationship_type IN ('FATHER', 'MOTHER')
        AND fr.relationship_status = 'ACTIVE'
        AND fr.deleted_at IS NULL
        AND p.deleted_at IS NULL
      `;

      const parents = await this.executeQuery(parentsSql, [currentPersonId]);

      for (const parent of parents) {
        const processedParent = this.processResult(parent);
        ancestors.push({
          ...processedParent,
          generation: currentGeneration + 1,
          relationship: processedParent.relationship_type.toLowerCase(),
        });

        // Recursively get grandparents
        await getAncestorsRecursive(
          processedParent.related_person_id,
          currentGeneration + 1,
        );
      }
    };

    await getAncestorsRecursive(personId, 0);

    // Group by generation
    const groupedByGeneration = {};
    ancestors.forEach((ancestor) => {
      if (!groupedByGeneration[ancestor.generation]) {
        groupedByGeneration[ancestor.generation] = [];
      }
      groupedByGeneration[ancestor.generation].push(ancestor);
    });

    return {
      ancestors,
      generations: groupedByGeneration,
      max_generation_reached: Math.max(
        ...ancestors.map((a) => a.generation),
        0,
      ),
    };
  }

  // Get descendants (children, grandchildren, etc.)
  async getDescendants(personId, maxGenerations = 3) {
    const descendants = [];

    // Recursive function to get descendants
    const getDescendantsRecursive = async (
      currentPersonId,
      currentGeneration,
    ) => {
      if (currentGeneration >= maxGenerations) return;

      // Get children
      const childrenSql = `
        SELECT 
          fr.*,
          p.full_name_arabic,
          p.full_name_english,
          p.gender,
          p.birth_date,
          p.is_alive
        FROM ${this.tableName} fr
        INNER JOIN persons p ON fr.related_person_id = p.id
        WHERE fr.person_id = ?
        AND fr.relationship_type IN ('SON', 'DAUGHTER')
        AND fr.relationship_status = 'ACTIVE'
        AND fr.deleted_at IS NULL
        AND p.deleted_at IS NULL
      `;

      const children = await this.executeQuery(childrenSql, [currentPersonId]);

      for (const child of children) {
        const processedChild = this.processResult(child);
        descendants.push({
          ...processedChild,
          generation: currentGeneration + 1,
          relationship: processedChild.relationship_type.toLowerCase(),
          parent_id: currentPersonId,
        });

        // Recursively get grandchildren
        await getDescendantsRecursive(
          processedChild.related_person_id,
          currentGeneration + 1,
        );
      }
    };

    await getDescendantsRecursive(personId, 0);

    // Build family tree structure
    const buildTree = (parentId = personId, generation = 0) => {
      const children = descendants
        .filter(
          (d) => d.parent_id === parentId && d.generation === generation + 1,
        )
        .map((child) => ({
          ...child,
          children: buildTree(child.related_person_id, generation + 1),
        }));

      return children;
    };

    const familyTree = buildTree();

    return {
      descendants,
      family_tree: familyTree,
      total_descendants: descendants.length,
      max_generation_reached: Math.max(
        ...descendants.map((d) => d.generation),
        0,
      ),
    };
  }

  // Calculate relationship degree (cousin level, removal, etc.)
  async calculateRelationshipDegree(personId1, personId2) {
    if (personId1 === personId2) {
      return { degree: "SELF", description: "Same person" };
    }

    // Get ancestors for both persons
    const ancestors1 = await this.getAncestors(personId1, 10);
    const ancestors2 = await this.getAncestors(personId2, 10);

    // Find common ancestors
    const commonAncestors = [];
    ancestors1.ancestors.forEach((a1) => {
      ancestors2.ancestors.forEach((a2) => {
        if (a1.related_person_id === a2.related_person_id) {
          commonAncestors.push({
            ancestor: a1,
            generation1: a1.generation,
            generation2: a2.generation,
          });
        }
      });
    });

    if (commonAncestors.length === 0) {
      return { degree: "UNRELATED", description: "No common ancestors found" };
    }

    // Find closest common ancestor
    const closestAncestor = commonAncestors.reduce((closest, current) => {
      const currentTotal = current.generation1 + current.generation2;
      const closestTotal = closest.generation1 + closest.generation2;
      return currentTotal < closestTotal ? current : closest;
    });

    const { generation1, generation2 } = closestAncestor;

    // Calculate cousin relationship
    if (generation1 === 1 && generation2 === 1) {
      return {
        degree: "SIBLING",
        description: "Brother/Sister",
        generation1,
        generation2,
      };
    }

    if (generation1 === 1 && generation2 === 2) {
      return {
        degree: "AVUNCULAR",
        description: generation1 < generation2 ? "Aunt/Uncle" : "Niece/Nephew",
        generation1,
        generation2,
      };
    }

    if (generation1 === 2 && generation2 === 1) {
      return {
        degree: "AVUNCULAR",
        description: generation1 < generation2 ? "Niece/Nephew" : "Aunt/Uncle",
        generation1,
        generation2,
      };
    }

    // Calculate cousin degree
    const minGeneration = Math.min(generation1, generation2);
    const removal = Math.abs(generation1 - generation2);

    let degree = "";
    if (minGeneration === 1) {
      degree = removal === 0 ? "SIBLING" : "AVUNCULAR";
    } else {
      const cousinNumber = minGeneration - 1;
      degree = `COUSIN_${cousinNumber}`;

      if (removal > 0) {
        degree += `_REMOVED_${removal}`;
      }
    }

    const descriptions = {
      COUSIN_0: "First Cousin",
      COUSIN_1: "Second Cousin",
      COUSIN_2: "Third Cousin",
      COUSIN_3: "Fourth Cousin",
      COUSIN_0_REMOVED_1: "First Cousin Once Removed",
      COUSIN_1_REMOVED_1: "Second Cousin Once Removed",
      AVUNCULAR: generation1 < generation2 ? "Aunt/Uncle" : "Niece/Nephew",
    };

    return {
      degree,
      description:
        descriptions[degree] || `${degree.replace("_", " ").toLowerCase()}`,
      generation1,
      generation2,
      removal,
      common_ancestor: closestAncestor.ancestor,
    };
  }

  // Bulk create relationships
  async bulkCreateRelationships(relationships, userId) {
    const results = [];
    const errors = [];

    for (const relationship of relationships) {
      try {
        const result = await this.createRelationship(relationship, userId);
        results.push(result);
      } catch (error) {
        errors.push({
          relationship,
          error: error.message,
        });
      }
    }

    return {
      success_count: results.length,
      error_count: errors.length,
      results,
      errors,
    };
  }

  // Import relationships from CSV/JSON
  async importRelationships(data, userId, options = {}) {
    const {
      updateExisting = false,
      skipDuplicates = true,
      verifyAll = false,
    } = options;

    const results = [];
    const errors = [];

    for (const item of data) {
      try {
        // Check if relationship already exists
        const existing = await this.findOne({
          person_id: item.person_id,
          related_person_id: item.related_person_id,
          relationship_type: item.relationship_type,
        });

        if (existing) {
          if (skipDuplicates) {
            results.push({
              status: "SKIPPED",
              message: "Relationship already exists",
              relationship: existing,
            });
            continue;
          }

          if (updateExisting) {
            const updated = await this.update(existing.relationship_id, {
              ...item,
              updated_at: this.formatDate(new Date()),
            });

            results.push({
              status: "UPDATED",
              message: "Relationship updated",
              relationship: updated,
            });
            continue;
          }
        }

        // Create new relationship
        const relationship = await this.createRelationship(item, userId);

        // Auto-verify if option is set
        if (verifyAll) {
          await this.verifyRelationship(
            relationship.relationship_id,
            userId,
            "Auto-verified during import",
          );
        }

        results.push({
          status: "CREATED",
          message: "Relationship created",
          relationship,
        });
      } catch (error) {
        errors.push({
          item,
          error: error.message,
        });
      }
    }

    return {
      total: data.length,
      created: results.filter((r) => r.status === "CREATED").length,
      updated: results.filter((r) => r.status === "UPDATED").length,
      skipped: results.filter((r) => r.status === "SKIPPED").length,
      failed: errors.length,
      results,
      errors,
    };
  }

  // Export relationships
  async exportRelationships(filters = {}, format = "json") {
    const { data } = await this.searchRelationships(filters, { limit: 10000 });

    const exportData = data.map((relationship) => ({
      person_id: relationship.person_id,
      related_person_id: relationship.related_person_id,
      relationship_type: relationship.relationship_type,
      start_date: relationship.start_date,
      end_date: relationship.end_date,
      is_biological: relationship.is_biological,
      relationship_status: relationship.relationship_status,
      certainty_level: relationship.certainty_level,
      notes: relationship.notes,
    }));

    return {
      data: exportData,
      metadata: {
        export_date: new Date().toISOString(),
        total_records: exportData.length,
        format,
      },
    };
  }

  // Statistics methods
  async getRelationshipStatistics() {
    const sql = `
      SELECT 
        COUNT(*) as total_relationships,
        COUNT(CASE WHEN relationship_status = 'ACTIVE' THEN 1 END) as active_relationships,
        COUNT(CASE WHEN relationship_status = 'DISSOLVED' THEN 1 END) as dissolved_relationships,
        COUNT(CASE WHEN relationship_status = 'DECEASED' THEN 1 END) as deceased_relationships,
        COUNT(CASE WHEN is_biological = TRUE THEN 1 END) as biological_relationships,
        COUNT(CASE WHEN is_biological = FALSE THEN 1 END) as non_biological_relationships,
        COUNT(CASE WHEN verified_by IS NOT NULL THEN 1 END) as verified_relationships,
        COUNT(CASE WHEN verified_by IS NULL THEN 1 END) as unverified_relationships,
        COUNT(DISTINCT person_id) as unique_persons_with_relationships,
        AVG(DATEDIFF(COALESCE(end_date, CURDATE()), start_date)) as avg_relationship_duration_days
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
    `;

    const results = await this.executeQuery(sql);
    return results[0] || {};
  }

  async getRelationshipTypeStatistics() {
    const sql = `
      SELECT 
        relationship_type,
        COUNT(*) as count,
        COUNT(CASE WHEN relationship_status = 'ACTIVE' THEN 1 END) as active_count,
        COUNT(CASE WHEN is_biological = TRUE THEN 1 END) as biological_count,
        COUNT(CASE WHEN verified_by IS NOT NULL THEN 1 END) as verified_count
      FROM ${this.tableName}
      WHERE deleted_at IS NULL
      GROUP BY relationship_type
      ORDER BY count DESC
    `;

    return await this.executeQuery(sql);
  }

  // Helper method for findOne (to match BaseModel interface)
  async findOne(where = {}, options = {}) {
    const { includeDeleted = false, includePersons = false } = options;

    let sql = `
      SELECT fr.*
      FROM ${this.tableName} fr
      WHERE 1=1
    `;

    const params = [];

    // Add WHERE conditions
    Object.entries(where).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        sql += ` AND fr.${key} = ?`;
        params.push(value);
      }
    });

    if (!includeDeleted) {
      sql += " AND fr.deleted_at IS NULL";
    }

    sql += " LIMIT 1";

    // Add person details if requested
    if (includePersons) {
      sql = `
        SELECT 
          fr.*,
          p1.full_name_arabic as person_name_arabic,
          p1.full_name_english as person_name_english,
          p2.full_name_arabic as related_person_name_arabic,
          p2.full_name_english as related_person_name_english
        FROM ${this.tableName} fr
        INNER JOIN persons p1 ON fr.person_id = p1.id
        INNER JOIN persons p2 ON fr.related_person_id = p2.id
        WHERE 1=1
      `;

      // Re-add WHERE conditions
      Object.entries(where).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          sql += ` AND fr.${key} = ?`;
          params.push(value);
        }
      });

      if (!includeDeleted) {
        sql +=
          " AND fr.deleted_at IS NULL AND p1.deleted_at IS NULL AND p2.deleted_at IS NULL";
      }

      sql += " LIMIT 1";
    }

    const results = await this.executeQuery(sql, params);
    return results.length > 0 ? this.processResult(results[0]) : null;
  }

  // Find by person and relationship type
  async findByPersonAndType(personId, relationshipType, options = {}) {
    return await this.findOne(
      {
        person_id: personId,
        relationship_type: relationshipType,
      },
      options,
    );
  }
}

export default FamilyRelationship;
