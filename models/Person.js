import BaseModel from './BaseModel.js';
import db from '../config/database.js';
import validator from 'validator';

class Person extends BaseModel {
  constructor() {
    super('persons', 'id');
    this.jsonFields = ['family_info', 'education_info', 'work_info', 'additional_info'];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.full_name_arabic && !data.full_name_english) {
        errors.push('Full name (Arabic or English) is required');
      }
    }

    // National ID validation
    if (data.national_id) {
      if (!/^\d{14}$/.test(data.national_id)) {
        errors.push('National ID must be 14 digits');
      }
      
      // Check uniqueness
      this.checkNationalIdUnique(data.national_id, data.id).then(isUnique => {
        if (!isUnique) errors.push('National ID already exists');
      });
    }

    // Email validation
    if (data.email && !validator.isEmail(data.email)) {
      errors.push('Invalid email format');
    }

    // Phone validation (Saudi format)
    if (data.phone_number && !/^(009665|9665|\+9665|05|5)([0-9]{8})$/.test(data.phone_number)) {
      errors.push('Invalid Saudi phone number format');
    }

    // Gender validation
    if (data.gender && !['M', 'F'].includes(data.gender)) {
      errors.push('Gender must be M or F');
    }

    // Birth date validation
    if (data.birth_date) {
      const birthDate = new Date(data.birth_date);
      if (birthDate > new Date()) {
        errors.push('Birth date cannot be in the future');
      }
    }

    // Death date validation
    if (data.death_date && data.birth_date) {
      const birthDate = new Date(data.birth_date);
      const deathDate = new Date(data.death_date);
      if (deathDate < birthDate) {
        errors.push('Death date cannot be before birth date');
      }
    }

    // Blood type validation
    if (data.blood_type && !/^(A|B|AB|O)[+-]$/.test(data.blood_type)) {
      errors.push('Invalid blood type format');
    }

    return errors;
  }

  // Check if national ID is unique
  async checkNationalIdUnique(nationalId, excludeId = null) {
    let sql = 'SELECT COUNT(*) as count FROM persons WHERE national_id = ?';
    const params = [nationalId];
    
    if (excludeId) {
      sql += ' AND id != ?';
      params.push(excludeId);
    }
    
    const result = await db.query(sql, params);
    return result[0]?.count === 0;
  }

  // Create person with validation
  async createPerson(data) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Process JSON fields
    const processedData = this.stringifyJSONFields(data, this.jsonFields);
    
    return await this.create(processedData);
  }

  // Update person with validation
  async updatePerson(id, data) {
    const errors = this.validate(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Process JSON fields
    const processedData = this.stringifyJSONFields(data, this.jsonFields);
    
    return await this.update(id, processedData);
  }

  // Get person by national ID
  async findByNationalId(nationalId) {
    const sql = 'SELECT * FROM persons WHERE national_id = ? AND deleted_at IS NULL';
    const results = await db.query(sql, [nationalId]);
    return results[0] || null;
  }

  // Get person by phone number
  async findByPhone(phoneNumber) {
    const sql = 'SELECT * FROM persons WHERE phone_number = ? AND deleted_at IS NULL';
    const results = await db.query(sql, [phoneNumber]);
    return results[0] || null;
  }

  // Get person by email
  async findByEmail(email) {
    const sql = 'SELECT * FROM persons WHERE email = ? AND deleted_at IS NULL';
    const results = await db.query(sql, [email]);
    return results[0] || null;
  }

  // Search persons by name
  async searchByName(name, options = {}) {
    const { page = 1, limit = 20, includeDeleted = false } = options;
    
    let sql = `
      SELECT * FROM persons 
      WHERE (full_name_arabic LIKE ? OR full_name_english LIKE ?)
    `;
    
    if (!includeDeleted) {
      sql += ' AND deleted_at IS NULL';
    }
    
    sql += ' LIMIT ? OFFSET ?';
    
    const offset = (page - 1) * limit;
    const results = await db.query(sql, [`%${name}%`, `%${name}%`, limit, offset]);
    
    // Parse JSON fields
    return results.map(record => this.parseJSONFields(record, this.jsonFields));
  }

  // Get family tree
  async getFamilyTree(personId, depth = 3) {
    const sql = `
      WITH RECURSIVE family_tree AS (
        SELECT 
          id, 
          full_name_arabic, 
          full_name_english, 
          gender, 
          birth_date,
          family_info,
          1 as level
        FROM persons 
        WHERE id = ? 
          AND deleted_at IS NULL
        
        UNION ALL
        
        SELECT 
          p.id, 
          p.full_name_arabic, 
          p.full_name_english, 
          p.gender, 
          p.birth_date,
          p.family_info,
          ft.level + 1
        FROM persons p
        INNER JOIN family_tree ft ON (
          JSON_EXTRACT(p.family_info, '$.father_id') = ft.id OR
          JSON_EXTRACT(p.family_info, '$.mother_id') = ft.id
        )
        WHERE p.deleted_at IS NULL 
          AND ft.level < ?
      )
      SELECT * FROM family_tree
      ORDER BY level, gender, birth_date
    `;
    
    const results = await db.query(sql, [personId, depth]);
    return results.map(record => this.parseJSONFields(record, this.jsonFields));
  }

  // Get statistics
  async getStatistics() {
    const sql = `
      SELECT 
        COUNT(*) as total_persons,
        SUM(CASE WHEN gender = 'M' THEN 1 ELSE 0 END) as males,
        SUM(CASE WHEN gender = 'F' THEN 1 ELSE 0 END) as females,
        SUM(CASE WHEN is_alive = 1 THEN 1 ELSE 0 END) as alive,
        SUM(CASE WHEN is_alive = 0 THEN 1 ELSE 0 END) as deceased,
        AVG(TIMESTAMPDIFF(YEAR, birth_date, NOW())) as avg_age,
        MIN(birth_date) as oldest_birth_date,
        MAX(birth_date) as youngest_birth_date
      FROM persons 
      WHERE deleted_at IS NULL
    `;
    
    const results = await db.query(sql);
    return results[0] || {};
  }

  // Get persons by age range
  async getByAgeRange(minAge = 0, maxAge = 100, options = {}) {
    const { page = 1, limit = 20 } = options;
    
    const sql = `
      SELECT 
        *,
        TIMESTAMPDIFF(YEAR, birth_date, NOW()) as age
      FROM persons 
      WHERE deleted_at IS NULL
        AND birth_date IS NOT NULL
        AND TIMESTAMPDIFF(YEAR, birth_date, NOW()) BETWEEN ? AND ?
      ORDER BY birth_date
      LIMIT ? OFFSET ?
    `;
    
    const offset = (page - 1) * limit;
    const results = await db.query(sql, [minAge, maxAge, limit, offset]);
    
    return results.map(record => this.parseJSONFields(record, this.jsonFields));
  }

  // Update family information
  async updateFamilyInfo(personId, familyData) {
    const person = await this.findById(personId);
    if (!person) {
      throw new Error('Person not found');
    }

    const currentInfo = person.family_info || {};
    const updatedInfo = { ...currentInfo, ...familyData };

    return await this.update(personId, { family_info: updatedInfo });
  }

  // Add child to person
  async addChild(personId, childId, relationship = 'child') {
    const person = await this.findById(personId);
    if (!person) {
      throw new Error('Parent person not found');
    }

    const child = await this.findById(childId);
    if (!child) {
      throw new Error('Child person not found');
    }

    // Update parent's family info
    const parentInfo = person.family_info || {};
    const children = parentInfo.children || [];
    
    if (!children.includes(childId)) {
      children.push(childId);
      await this.update(personId, {
        family_info: { ...parentInfo, children }
      });
    }

    // Update child's family info
    const childInfo = child.family_info || {};
    const parents = childInfo.parents || [];
    
    if (person.gender === 'M' && !parents.some(p => p.id === personId)) {
      parents.push({ id: personId, type: 'father' });
    } else if (person.gender === 'F' && !parents.some(p => p.id === personId)) {
      parents.push({ id: personId, type: 'mother' });
    }
    
    await this.update(childId, {
      family_info: { ...childInfo, parents }
    });

    return true;
  }
}

export default Person;



// // models/core/Person.js
// import BaseModel from './BaseModel.js';
// import { format, parseISO, isValid } from 'date-fns';

// class Person extends BaseModel {
//   constructor() {
//     super('persons', 'person_id');
//   }

//   // Validate person data
//   validate(data) {
//     const errors = [];

//     // Required fields
//     if (!data.full_name_arabic) {
//       errors.push('Arabic full name is required');
//     }

//     if (!data.gender) {
//       errors.push('Gender is required');
//     } else if (!['M', 'F'].includes(data.gender)) {
//       errors.push('Gender must be M or F');
//     }

//     // National ID validation (Saudi ID)
//     if (data.national_id) {
//       if (!/^\d{10}$/.test(data.national_id) && !/^\d{14}$/.test(data.national_id)) {
//         errors.push('National ID must be 10 or 14 digits');
//       }
//     }

//     // Email validation
//     // if (data.email) {
//     //   const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
//     //   if (!emailRegex.test(data.email)) {
//     //     errors.push('Invalid email format');
//     //   }
//     // }

//     // Phone validation (Saudi format)
//     if (data.phone_number) {
//       const phoneRegex = /^(009665|9665|\\+9665|05|5)([0-9]{8})$/;
//       if (!phoneRegex.test(data.phone_number)) {
//         errors.push('Invalid Saudi phone number format');
//       }
//     }

//     // Date validation
//     if (data.birth_date) {
//       const date = parseISO(data.birth_date);
//       if (!isValid(date)) {
//         errors.push('Invalid birth date');
//       } else if (date > new Date()) {
//         errors.push('Birth date cannot be in the future');
//       }
//     }

//     if (data.death_date && data.is_alive) {
//       errors.push('Cannot have death date for living person');
//     }

//     // Blood type validation
//     if (data.blood_type) {
//       const validBloodTypes = ['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'];
//       if (!validBloodTypes.includes(data.blood_type)) {
//         errors.push('Invalid blood type');
//       }
//     }

//     return errors;
//   }

//   // Calculate age
//   calculateAge(birthDate) {
//     if (!birthDate) return null;
    
//     const today = new Date();
//     const birth = parseISO(birthDate);
//     let age = today.getFullYear() - birth.getFullYear();
    
//     const monthDiff = today.getMonth() - birth.getMonth();
//     if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
//       age--;
//     }
    
//     return age;
//   }

//   // Find by national ID
//   async findByNationalId(nationalId) {
//     const sql = `
//       SELECT * FROM persons 
//       WHERE national_id = ? 
//       AND deleted_at IS NULL
//     `;
    
//     const results = await this.executeQuery(sql, [nationalId]);
//     return results.length > 0 ? results[0] : null;
//   }

//   // Find by name (search)
//   async searchByName(name, options = {}) {
//     const { page = 1, limit = 20 } = options;
    
//     const sql = `
//       SELECT * FROM persons 
//       WHERE (
//         full_name_arabic LIKE ? 
//         OR full_name_english LIKE ? 
//         OR nickname LIKE ?
//       )
//       AND deleted_at IS NULL
//       ORDER BY full_name_arabic
//       LIMIT ? OFFSET ?
//     `;
    
//     const params = [`%${name}%`, `%${name}%`, `%${name}%`, limit, (page - 1) * limit];
//     return await this.executeQuery(sql, params);
//   }

//   // Get family members
//   async getFamilyMembers(personId, relationshipType = null) {
//     let sql = `
//       SELECT 
//         p.*,
//         fr.relationship_type,
//         fr.is_biological,
//         fr.start_date,
//         fr.end_date
//       FROM persons p
//       INNER JOIN family_relationships fr ON p.person_id = fr.related_person_id
//       WHERE fr.person_id = ?
//       AND p.deleted_at IS NULL
//       AND fr.deleted_at IS NULL
//     `;
    
//     const params = [personId];
    
//     if (relationshipType) {
//       sql += ' AND fr.relationship_type = ?';
//       params.push(relationshipType);
//     }
    
//     return await this.executeQuery(sql, params);
//   }

//   // Get immediate family (parents, spouse, children)
//   async getImmediateFamily(personId) {
//     const [parents, spouse, children] = await Promise.all([
//       this.getFamilyMembers(personId, 'FATHER').concat(this.getFamilyMembers(personId, 'MOTHER')),
//       this.getFamilyMembers(personId, 'HUSBAND').concat(this.getFamilyMembers(personId, 'WIFE')),
//       this.getFamilyMembers(personId, 'SON').concat(this.getFamilyMembers(personId, 'DAUGHTER'))
//     ]);
    
//     return {
//       parents: parents.filter(p => p.is_current !== false),
//       spouse: spouse.filter(s => s.is_current !== false),
//       children: children.filter(c => c.is_current !== false)
//     };
//   }

//   // Get person statistics
//   async getStatistics(personId) {
//     const sql = `
//       SELECT 
//         COUNT(DISTINCT fr.relationship_id) as total_relationships,
//         COUNT(DISTINCT CASE WHEN fr.relationship_type IN ('FATHER', 'MOTHER') THEN fr.relationship_id END) as parent_count,
//         COUNT(DISTINCT CASE WHEN fr.relationship_type IN ('SON', 'DAUGHTER') THEN fr.relationship_id END) as children_count,
//         COUNT(DISTINCT CASE WHEN fr.relationship_type IN ('HUSBAND', 'WIFE') THEN fr.relationship_id END) as spouse_count,
//         COUNT(DISTINCT CASE WHEN fr.is_biological = 1 THEN fr.relationship_id END) as biological_relationships,
//         MIN(fr.start_date) as earliest_relationship,
//         MAX(fr.start_date) as latest_relationship
//       FROM persons p
//       LEFT JOIN family_relationships fr ON p.person_id = fr.person_id AND fr.deleted_at IS NULL
//       WHERE p.person_id = ?
//       AND p.deleted_at IS NULL
//     `;
    
//     const results = await this.executeQuery(sql, [personId]);
//     return results[0];
//   }

//   // Create person with validation
//   async createWithValidation(data) {
//     const errors = this.validate(data);
//     if (errors.length > 0) {
//       throw new Error(`Validation failed: ${errors.join(', ')}`);
//     }

//     // Check for duplicate national ID
//     if (data.national_id) {
//       const existing = await this.findByNationalId(data.national_id);
//       if (existing) {
//         throw new Error('Person with this national ID already exists');
//       }
//     }

//     return await this.create(data);
//   }

//   // Update person with validation
//   async updateWithValidation(id, data) {
//     const errors = this.validate(data);
//     if (errors.length > 0) {
//       throw new Error(`Validation failed: ${errors.join(', ')}`);
//     }

//     // Check for duplicate national ID (excluding current person)
//     if (data.national_id) {
//       const existing = await this.findByNationalId(data.national_id);
//       if (existing && existing.person_id !== id) {
//         throw new Error('Another person with this national ID already exists');
//       }
//     }

//     return await this.update(id, data);
//   }

//   // Get age group
//   getAgeGroup(age) {
//     if (age === null || age === undefined) return 'unknown';
    
//     if (age < 13) return 'child';
//     if (age < 20) return 'teen';
//     if (age < 30) return 'young_adult';
//     if (age < 40) return 'adult';
//     if (age < 60) return 'middle_age';
//     return 'senior';
//   }

//   // Export person data for reporting
//   async exportPersonData(personId, includeRelationships = true) {
//     const person = await this.findById(personId);
//     if (!person) {
//       throw new Error('Person not found');
//     }

//     const exportData = {
//       ...person,
//       age: this.calculateAge(person.birth_date),
//       age_group: this.getAgeGroup(this.calculateAge(person.birth_date))
//     };

//     if (includeRelationships) {
//       exportData.relationships = await this.getFamilyMembers(personId);
//     }

//     return exportData;
//   }

//   // Batch create persons
//   async batchCreate(personsData) {
//     const results = [];
//     const errors = [];

//     for (const personData of personsData) {
//       try {
//         const person = await this.createWithValidation(personData);
//         results.push(person);
//       } catch (error) {
//         errors.push({
//           data: personData,
//           error: error.message
//         });
//       }
//     }

//     return {
//       success: results,
//       failed: errors,
//       total: personsData.length,
//       successful: results.length,
//       failedCount: errors.length
//     };
//   }
// }

// export default Person;
