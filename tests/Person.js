import BaseModel from "../libs/BaseModel.js";
import db from "../database/database.js";
import validator from "validator";

class Person extends BaseModel {
  constructor() {
    super("persons", "id");
    this.jsonFields = [
      "family_info",
      "education_info",
      "work_info",
      "additional_info",
    ];
  }

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    // Required fields
    if (!isUpdate) {
      if (!data.full_name_arabic && !data.full_name_english) {
        errors.push("Full name (Arabic or English) is required");
      }
    }

    // National ID validation
    if (data.national_id) {
      if (!/^\d{14}$/.test(data.national_id)) {
        errors.push("National ID must be 14 digits");
      }

      // Check uniqueness
      this.checkNationalIdUnique(data.national_id, data.id).then((isUnique) => {
        if (!isUnique) errors.push("National ID already exists");
      });
    }

    // Email validation
    if (data.email && !validator.isEmail(data.email)) {
      errors.push("Invalid email format");
    }

    // Phone validation (Saudi format)
    if (
      data.phone_number &&
      !/^(009665|9665|\+9665|05|5)([0-9]{8})$/.test(data.phone_number)
    ) {
      errors.push("Invalid Saudi phone number format");
    }

    // Gender validation
    if (data.gender && !["M", "F"].includes(data.gender)) {
      errors.push("Gender must be M or F");
    }

    // Birth date validation
    if (data.birth_date) {
      const birthDate = new Date(data.birth_date);
      if (birthDate > new Date()) {
        errors.push("Birth date cannot be in the future");
      }
    }

    // Death date validation
    if (data.death_date && data.birth_date) {
      const birthDate = new Date(data.birth_date);
      const deathDate = new Date(data.death_date);
      if (deathDate < birthDate) {
        errors.push("Death date cannot be before birth date");
      }
    }

    // Blood type validation
    if (data.blood_type && !/^(A|B|AB|O)[+-]$/.test(data.blood_type)) {
      errors.push("Invalid blood type format");
    }

    return errors;
  }

  // Check if national ID is unique
  async checkNationalIdUnique(nationalId, excludeId = null) {
    let sql = "SELECT COUNT(*) as count FROM persons WHERE national_id = ?";
    const params = [nationalId];

    if (excludeId) {
      sql += " AND id != ?";
      params.push(excludeId);
    }

    const result = await db.query(sql, params);
    return result[0]?.count === 0;
  }

  /**
   * Stringify JSON fields before saving to database
   * @param {Object} data - The data object
   * @param {Array} jsonFields - Array of field names that should be JSON stringified
   * @returns {Object} - Data with JSON fields stringified
   */
  stringifyJSONFields(data, jsonFields) {
    const processedData = { ...data };

    jsonFields.forEach((field) => {
      if (processedData[field] !== undefined && processedData[field] !== null) {
        if (typeof processedData[field] === "object") {
          // Stringify objects
          processedData[field] = JSON.stringify(processedData[field]);
        } else if (typeof processedData[field] === "string") {
          // If it's already a string, try to parse it first to ensure it's valid JSON
          try {
            JSON.parse(processedData[field]);
            // If parsing succeeds, it's already valid JSON string, keep as is
          } catch (error) {
            // If parsing fails, it's not valid JSON, wrap it in a JSON object
            processedData[field] = JSON.stringify({
              value: processedData[field],
            });
          }
        } else if (
          typeof processedData[field] === "boolean" ||
          typeof processedData[field] === "number"
        ) {
          // Wrap primitives in JSON objects
          processedData[field] = JSON.stringify({
            value: processedData[field],
          });
        }
      } else if (processedData[field] === null) {
        // Keep null as null
        processedData[field] = null;
      } else {
        // If undefined, set to empty object JSON
        processedData[field] = JSON.stringify({});
      }
    });

    return processedData;
  }

  /**
   * Parse JSON fields after retrieving from database
   * @param {Object} record - The database record
   * @param {Array} jsonFields - Array of field names that should be parsed from JSON
   * @returns {Object} - Record with JSON fields parsed
   */
  parseJSONFields(record, jsonFields) {
    if (!record) return record;

    const parsedRecord = { ...record };

    jsonFields.forEach((field) => {
      if (parsedRecord[field] && typeof parsedRecord[field] === "string") {
        try {
          parsedRecord[field] = JSON.parse(parsedRecord[field]);
        } catch (error) {
          // If parsing fails, keep as string
          console.warn(
            `Failed to parse JSON field "${field}":`,
            parsedRecord[field],
          );
        }
      } else if (parsedRecord[field] === null) {
        parsedRecord[field] = null;
      } else if (parsedRecord[field] === undefined) {
        parsedRecord[field] = {};
      }
    });

    return parsedRecord;
  }

  // In Person.js, update the createPerson method:
  async createPerson(data) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    // Remove the stringifyJSONFields call since BaseModel already handles it
    // Just pass the data directly to create
    return await this.create(data);
  }

  // Create person with validation
  // async createPerson(data) {
  //   const errors = this.validate(data, false);
  //   if (errors.length > 0) {
  //     throw new Error(`Validation failed: ${errors.join(", ")}`);
  //   }

  //   // Process JSON fields
  //   const processedData = this.stringifyJSONFields(data, this.jsonFields);

  //   return await this.create(processedData);
  // }

  // Update person with validation
  async updatePerson(id, data) {
    const errors = this.validate(data, true);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(", ")}`);
    }

    // Process JSON fields
    const processedData = this.stringifyJSONFields(data, this.jsonFields);

    return await this.update(id, processedData);
  }

  // Get person by national ID
  async findByNationalId(nationalId) {
    const sql =
      "SELECT * FROM persons WHERE national_id = ? AND deleted_at IS NULL";
    const results = await db.query(sql, [nationalId]);
    return results[0] || null;
  }

  // Get person by phone number
  async findByPhone(phoneNumber) {
    const sql =
      "SELECT * FROM persons WHERE phone_number = ? AND deleted_at IS NULL";
    const results = await db.query(sql, [phoneNumber]);
    return results[0] || null;
  }

  // Get person by email
  async findByEmail(email) {
    const sql = "SELECT * FROM persons WHERE email = ? AND deleted_at IS NULL";
    const results = await db.query(sql, [email]);
    return (resuoken = generateToken(user.id, "refresh"));
    lts[0] || null;
  }

  // Search persons by name
  async searchByName(name, options = {}) {
    const { page = 1, limit = 20, includeDeleted = false } = options;

    let sql = `
      SELECT * FROM persons 
      WHERE (full_name_arabic LIKE ? OR full_name_english LIKE ?)
    `;

    if (!includeDeleted) {
      sql += " AND deleted_at IS NULL";
    }

    sql += " LIMIT ? OFFSET ?";

    const offset = (page - 1) * limit;
    const results = await db.query(sql, [
      `%${name}%`,
      `%${name}%`,
      limit,
      offset,
    ]);

    // Parse JSON fields
    return results.map((record) =>
      this.parseJSONFields(record, this.jsonFields),
    );
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
    return results.map((record) =>
      this.parseJSONFields(record, this.jsonFields),
    );
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

    return results.map((record) =>
      this.parseJSONFields(record, this.jsonFields),
    );
  }

  // Update family information
  async updateFamilyInfo(personId, familyData) {
    const person = await this.findById(personId);
    if (!person) {
      throw new Error("Person not found");
    }

    const currentInfo = person.family_info || {};
    const updatedInfo = { ...currentInfo, ...familyData };

    return await this.update(personId, { family_info: updatedInfo });
  }

  // Add child to person
  async addChild(personId, childId, relationship = "child") {
    const person = await this.findById(personId);
    if (!person) {
      throw new Error("Parent person not found");
    }

    const child = await this.findById(childId);
    if (!child) {
      throw new Error("Child person not found");
    }

    // Update parent's family info
    const parentInfo = person.family_info || {};
    const children = parentInfo.children || [];

    if (!children.includes(childId)) {
      children.push(childId);
      await this.update(personId, {
        family_info: { ...parentInfo, children },
      });
    }

    // Update child's family info
    const childInfo = child.family_info || {};
    const parents = childInfo.parents || [];

    if (person.gender === "M" && !parents.some((p) => p.id === personId)) {
      parents.push({ id: personId, type: "father" });
    } else if (
      person.gender === "F" &&
      !parents.some((p) => p.id === personId)
    ) {
      parents.push({ id: personId, type: "mother" });
    }

    await this.update(childId, {
      family_info: { ...childInfo, parents },
    });

    return true;
  }
}

const personModel = new Person();

export { Person }
export default personModel;
