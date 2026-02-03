import db from "../database/database.js";
import { v4 as uuidv4 } from "uuid";
import { format } from "date-fns";

/**
 * Base model with common CRUD operations and utilities
 */
class BaseModel {
  constructor(tableName, primaryKey = "id") {
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    this.db = db;
    this.softDelete = true; // Enable soft delete by default
  }

  // Generate UUID
  generateId() {
    return uuidv4();
  }

  // Format date for MySQL
  formatDate(date) {
    return date ? format(date, "yyyy-MM-dd HH:mm:ss") : null;
  }

  // Parse JSON fields
  parseJSON(value) {
    if (!value) return null;
    if (typeof value === "string") {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    return value;
  }

  // Stringify JSON fields
  stringifyJSON(value) {
    if (!value) return null;
    if (typeof value === "object") {
      return JSON.stringify(value);
    }
    return value;
  }

  // Build WHERE clause
  buildWhereClause(filters, params = []) {
    let whereClause = "";
    const conditions = [];

    if (this.softDelete) {
      conditions.push(`${this.tableName}.deleted_at IS NULL`);
    }

    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;

      if (Array.isArray(value)) {
        conditions.push(`${key} IN (${value.map(() => "?").join(",")})`);
        params.push(...value);
      } else if (typeof value === "object" && value.operator) {
        switch (value.operator) {
          case "LIKE":
            conditions.push(`${key} LIKE ?`);
            params.push(`%${value.value}%`);
            break;
          case "BETWEEN":
            conditions.push(`${key} BETWEEN ? AND ?`);
            params.push(value.value[0], value.value[1]);
            break;
          case ">":
          case "<":
          case ">=":
          case "<=":
          case "!=":
            conditions.push(`${key} ${value.operator} ?`);
            params.push(value.value);
            break;
        }
      } else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(" AND ")}`;
    }

    return whereClause;
  }

  // Build ORDER BY clause
  buildOrderClause(sortBy = "created_at", sortOrder = "DESC") {
    return `ORDER BY ${sortBy} ${sortOrder}`;
  }

  // Build LIMIT/OFFSET clause
  buildPaginationClause(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  }

  // Execute query with error handling
  async executeQuery(sql, params = []) {
    try {
      const [results] = await this.db.query(sql, params);
      return results;
    } catch (error) {
      console.error(`Database error in ${this.tableName}:`, error.message);
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  // Find by primary key
  async findById(id, options = {}) {
    const { includeDeleted = false } = options;
    let sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;

    if (!includeDeleted && this.softDelete) {
      sql += " AND deleted_at IS NULL";
    }

    const results = await this.executeQuery(sql, [id]);
    return results.length > 0 ? results[0] : null;
  }

  // Find all with filtering and pagination
  async findAll(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sortBy = "created_at",
      sortOrder = "DESC",
      includeDeleted = false,
    } = options;

    const params = [];
    let whereClause = this.buildWhereClause(filters, params);

    if (!includeDeleted && this.softDelete) {
      if (whereClause) {
        whereClause = whereClause.replace(
          "WHERE",
          "WHERE deleted_at IS NULL AND",
        );
      } else {
        whereClause = "WHERE deleted_at IS NULL";
      }
    }

    const orderClause = this.buildOrderClause(sortBy, sortOrder);
    const paginationClause = this.buildPaginationClause(page, limit);

    // Get data
    const dataSql = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      ${orderClause}
      ${paginationClause}
    `;

    // Get total count
    const countSql = `
      SELECT COUNT(*) as total FROM ${this.tableName}
      ${whereClause}
    `;

    const [data, countResult] = await Promise.all([
      this.executeQuery(dataSql, params),
      this.executeQuery(countSql, params),
    ]);

    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);

    return {
      data,
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    };
  }

  // Create new record
  async create(data) {
    const id = data[this.primaryKey] || this.generateId();
    const now = new Date();

    const record = {
      [this.primaryKey]: id,
      ...data,
      created_at: this.formatDate(data.created_at || now),
      updated_at: this.formatDate(data.updated_at || now),
    };

    // Handle JSON fields
    Object.keys(record).forEach((key) => {
      if (typeof record[key] === "object" && record[key] !== null) {
        record[key] = this.stringifyJSON(record[key]);
      }
    });

    const columns = Object.keys(record).join(", ");
    const placeholders = Object.keys(record)
      .map(() => "?")
      .join(", ");
    const values = Object.values(record);

    const sql = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
    `;

    await this.executeQuery(sql, values);
    return this.findById(id);
  }

  // Update record
  async update(id, data) {
    const existing = await this.findById(id);
    if (!existing) {
      throw new Error(`${this.tableName} with ID ${id} not found`);
    }

    const now = new Date();
    const updateData = {
      ...data,
      updated_at: this.formatDate(now),
    };

    // Handle JSON fields
    Object.keys(updateData).forEach((key) => {
      if (typeof updateData[key] === "object" && updateData[key] !== null) {
        updateData[key] = this.stringifyJSON(updateData[key]);
      }
    });

    const setClause = Object.keys(updateData)
      .map((key) => `${key} = ?`)
      .join(", ");

    const values = [...Object.values(updateData), id];

    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${this.primaryKey} = ?
      ${this.softDelete ? "AND deleted_at IS NULL" : ""}
    `;

    await this.executeQuery(sql, values);
    return this.findById(id);
  }

  // Soft delete
  async softDeleteRecord(id) {
    if (!this.softDelete) {
      throw new Error("Soft delete not enabled for this model");
    }

    const sql = `
      UPDATE ${this.tableName}
      SET deleted_at = ?
      WHERE ${this.primaryKey} = ?
      AND deleted_at IS NULL
    `;

    await this.executeQuery(sql, [this.formatDate(new Date()), id]);
    return true;
  }

  // Hard delete
  async hardDelete(id) {
    const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    await this.executeQuery(sql, [id]);
    return true;
  }

  // Restore soft-deleted record
  async restore(id) {
    if (!this.softDelete) {
      throw new Error("Soft delete not enabled for this model");
    }

    const sql = `
      UPDATE ${this.tableName}
      SET deleted_at = NULL
      WHERE ${this.primaryKey} = ?
      AND deleted_at IS NOT NULL
    `;

    await this.executeQuery(sql, [id]);
    return this.findById(id, { includeDeleted: true });
  }

  // Count records
  async count(filters = {}) {
    const params = [];
    const whereClause = this.buildWhereClause(filters, params);

    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` ${whereClause}`;
    }
    if (!whereClause && this.softDelete) {
      sql += " WHERE deleted_at IS NULL";
    } else if (whereClause && this.softDelete) {
      sql = sql.replace("WHERE", "WHERE deleted_at IS NULL AND");
    }

    const results = await this.executeQuery(sql, params);
    return results[0]?.count || 0;
  }

  // Check if record exists
  async exists(filters) {
    const count = await this.count(filters);
    return count > 0;
  }
}

export default BaseModel;
