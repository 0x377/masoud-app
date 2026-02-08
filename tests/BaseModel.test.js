import Database from "./database.test.js";
import { v4 as uuidv4 } from "uuid";
import { format, parseISO, isDate } from "date-fns";

/**
 * Advanced BaseModel with enhanced CRUD operations, caching, validation, and advanced querying
 */
class BaseModel extends Database {
  constructor(tableName, primaryKey = "id", options = {}) {
    // Call parent constructor
    super();
    
    this.tableName = tableName;
    this.primaryKey = primaryKey;
    
    // Configuration options
    this.config = {
      softDelete: options.softDelete ?? true,
      timestamps: options.timestamps ?? true,
      cacheEnabled: options.cacheEnabled ?? false,
      cacheTTL: options.cacheTTL ?? 300000, // 5 minutes in milliseconds
      validation: options.validation ?? true,
      maxBulkInsert: options.maxBulkInsert ?? 1000,
      ...options
    };
    
    // Cache storage
    this.cache = new Map();
    this.cacheTimestamps = new Map();
    
    // Connection pool reference
    this.connectionPool = null;
    
    // Schema cache for metadata
    this.schema = null;
    
    // Initialize
    this.initialize();
  }

  async initialize() {
    try {
      // Ensure database connection
      if (!this.pool) {
        await this.connect();
      }
      
      // Cache table schema
      await this.cacheTableSchema();
      
      // Set up cache cleanup interval
      if (this.config.cacheEnabled) {
        this.startCacheCleanup();
      }
      
      console.log(`✅ BaseModel initialized for table: ${this.tableName}`);
    } catch (error) {
      console.error(`❌ Failed to initialize BaseModel for ${this.tableName}:`, error);
      throw error;
    }
  }

  // === CACHE MANAGEMENT ===
  startCacheCleanup() {
    setInterval(() => {
      this.cleanupCache();
    }, 60000); // Clean up every minute
  }

  cleanupCache() {
    const now = Date.now();
    for (const [key, timestamp] of this.cacheTimestamps.entries()) {
      if (now - timestamp > this.config.cacheTTL) {
        this.cache.delete(key);
        this.cacheTimestamps.delete(key);
      }
    }
  }

  setCache(key, value) {
    if (!this.config.cacheEnabled) return;
    
    this.cache.set(key, value);
    this.cacheTimestamps.set(key, Date.now());
  }

  getCache(key) {
    if (!this.config.cacheEnabled) return null;
    
    const timestamp = this.cacheTimestamps.get(key);
    if (timestamp && Date.now() - timestamp < this.config.cacheTTL) {
      return this.cache.get(key);
    }
    
    // Remove expired cache
    this.cache.delete(key);
    this.cacheTimestamps.delete(key);
    return null;
  }

  clearCache(pattern = null) {
    if (pattern) {
      // Clear cache entries matching pattern
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
          this.cacheTimestamps.delete(key);
        }
      }
    } else {
      // Clear all cache
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }

  // === SCHEMA MANAGEMENT ===
  async cacheTableSchema() {
    try {
      const sql = `
        SELECT 
          COLUMN_NAME,
          DATA_TYPE,
          COLUMN_TYPE,
          IS_NULLABLE,
          COLUMN_DEFAULT,
          COLUMN_KEY,
          EXTRA,
          CHARACTER_MAXIMUM_LENGTH,
          NUMERIC_PRECISION,
          NUMERIC_SCALE
        FROM INFORMATION_SCHEMA.COLUMNS 
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = ?
        ORDER BY ORDINAL_POSITION
      `;
      
      const columns = await this.query(sql, [this.tableName]);
      
      this.schema = columns.reduce((acc, column) => {
        acc[column.COLUMN_NAME] = {
          type: column.DATA_TYPE,
          columnType: column.COLUMN_TYPE,
          nullable: column.IS_NULLABLE === 'YES',
          defaultValue: column.COLUMN_DEFAULT,
          isPrimary: column.COLUMN_KEY === 'PRI',
          isUnique: column.COLUMN_KEY === 'UNI',
          maxLength: column.CHARACTER_MAXIMUM_LENGTH,
          precision: column.NUMERIC_PRECISION,
          scale: column.NUMERIC_SCALE,
          extra: column.EXTRA
        };
        return acc;
      }, {});
      
      console.log(`📋 Schema cached for table: ${this.tableName}`);
      return this.schema;
    } catch (error) {
      console.warn(`⚠️ Could not cache schema for ${this.tableName}:`, error.message);
      return null;
    }
  }

  getSchema() {
    return this.schema;
  }

  // === VALIDATION ===
  validateData(data, operation = 'create') {
    if (!this.config.validation || !this.schema) {
      return { isValid: true, errors: [] };
    }
    
    const errors = [];
    const schema = this.schema;
    
    for (const [field, value] of Object.entries(data)) {
      if (!schema[field]) {
        // Skip validation for fields not in schema
        continue;
      }
      
      const fieldSchema = schema[field];
      
      // Check nullability
      if (value === null || value === undefined) {
        if (!fieldSchema.nullable && operation === 'create') {
          errors.push(`${field} is required`);
        }
        continue;
      }
      
      // Type validation
      const typeError = this.validateType(field, value, fieldSchema);
      if (typeError) {
        errors.push(typeError);
      }
      
      // Length validation for strings
      if (fieldSchema.maxLength && typeof value === 'string' && value.length > fieldSchema.maxLength) {
        errors.push(`${field} exceeds maximum length of ${fieldSchema.maxLength}`);
      }
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  validateType(field, value, schema) {
    const type = schema.type.toLowerCase();
    
    switch (type) {
      case 'int':
      case 'bigint':
      case 'tinyint':
      case 'smallint':
      case 'mediumint':
        if (!Number.isInteger(Number(value))) {
          return `${field} must be an integer`;
        }
        break;
        
      case 'decimal':
      case 'float':
      case 'double':
        if (isNaN(Number(value))) {
          return `${field} must be a number`;
        }
        break;
        
      case 'varchar':
      case 'char':
      case 'text':
      case 'longtext':
      case 'mediumtext':
        if (typeof value !== 'string') {
          return `${field} must be a string`;
        }
        break;
        
      case 'datetime':
      case 'timestamp':
      case 'date':
        if (!(value instanceof Date) && !this.isValidDateString(value)) {
          return `${field} must be a valid date`;
        }
        break;
        
      case 'json':
        try {
          JSON.stringify(value);
        } catch {
          return `${field} must be valid JSON`;
        }
        break;
        
      case 'boolean':
      case 'bool':
        if (typeof value !== 'boolean' && !(value === 0 || value === 1)) {
          return `${field} must be a boolean`;
        }
        break;
    }
    
    return null;
  }

  isValidDateString(dateStr) {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    return date instanceof Date && !isNaN(date);
  }

  // === UTILITIES ===
  generateId() {
    return uuidv4();
  }

  formatDate(date) {
    if (!date) return null;
    
    if (typeof date === 'string') {
      date = parseISO(date);
    }
    
    if (!isDate(date)) {
      date = new Date(date);
    }
    
    return format(date, "yyyy-MM-dd HH:mm:ss");
  }

  parseJSON(value) {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'string') {
      try {
        return JSON.parse(value);
      } catch {
        return value;
      }
    }
    
    return value;
  }

  stringifyJSON(value) {
    if (value === null || value === undefined) return null;
    
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return value;
      }
    }
    
    return value;
  }

  // === ADVANCED QUERY BUILDING ===
  buildWhereClause(filters, params = [], options = {}) {
    let whereClause = "";
    const conditions = [];
    
    // Soft delete condition
    if (this.config.softDelete && !options.includeDeleted) {
      conditions.push(`${this.tableName}.deleted_at IS NULL`);
    }
    
    // Custom where conditions
    if (options.customWhere) {
      conditions.push(options.customWhere);
    }
    
    // Process filters
    for (const [key, value] of Object.entries(filters)) {
      if (value === null || value === undefined) continue;
      
      // Handle array values (IN clause)
      if (Array.isArray(value)) {
        if (value.length === 0) {
          conditions.push('1 = 0'); // Always false for empty arrays
        } else {
          conditions.push(`${key} IN (${value.map(() => '?').join(',')})`);
          params.push(...value);
        }
      }
      // Handle object with operator
      else if (typeof value === 'object' && value.operator) {
        const condition = this.buildOperatorCondition(key, value, params);
        if (condition) {
          conditions.push(condition);
        }
      }
      // Handle raw SQL
      else if (typeof value === 'object' && value.raw) {
        conditions.push(`(${key} ${value.raw})`);
        if (value.params) {
          params.push(...value.params);
        }
      }
      // Handle simple equality
      else {
        conditions.push(`${key} = ?`);
        params.push(value);
      }
    }
    
    if (conditions.length > 0) {
      whereClause = `WHERE ${conditions.join(' AND ')}`;
    }
    
    return whereClause;
  }

  buildOperatorCondition(key, value, params) {
    const operator = value.operator.toUpperCase();
    const val = value.value;
    
    switch (operator) {
      case 'LIKE':
        params.push(`%${val}%`);
        return `${key} LIKE ?`;
        
      case 'NOT LIKE':
        params.push(`%${val}%`);
        return `${key} NOT LIKE ?`;
        
      case 'BETWEEN':
        if (Array.isArray(val) && val.length === 2) {
          params.push(val[0], val[1]);
          return `${key} BETWEEN ? AND ?`;
        }
        break;
        
      case 'IN':
        if (Array.isArray(val) && val.length > 0) {
          params.push(...val);
          return `${key} IN (${val.map(() => '?').join(',')})`;
        }
        break;
        
      case 'NOT IN':
        if (Array.isArray(val) && val.length > 0) {
          params.push(...val);
          return `${key} NOT IN (${val.map(() => '?').join(',')})`;
        }
        break;
        
      case 'IS NULL':
        return `${key} IS NULL`;
        
      case 'IS NOT NULL':
        return `${key} IS NOT NULL`;
        
      case '>':
      case '<':
      case '>=':
      case '<=':
      case '!=':
      case '<>':
        params.push(val);
        return `${key} ${operator} ?`;
        
      case 'RAW':
        return `${key} ${val}`;
    }
    
    return null;
  }

  buildOrderClause(sort = {}) {
    if (!sort || Object.keys(sort).length === 0) {
      return 'ORDER BY created_at DESC';
    }
    
    const orders = [];
    for (const [field, direction] of Object.entries(sort)) {
      const dir = direction.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
      orders.push(`${field} ${dir}`);
    }
    
    return `ORDER BY ${orders.join(', ')}`;
  }

  buildPaginationClause(page = 1, limit = 20) {
    const offset = (page - 1) * limit;
    return `LIMIT ${limit} OFFSET ${offset}`;
  }

  // === EXECUTE QUERY WITH ENHANCED FEATURES ===
  async executeQuery(sql, params = [], options = {}) {
    const queryId = this.generateQueryId(sql, params);
    const cacheKey = `query:${queryId}`;
    
    // Check cache
    if (options.useCache && this.config.cacheEnabled) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        console.log(`🔄 Cache hit for query: ${queryId}`);
        return cached;
      }
    }
    
    try {
      const startTime = Date.now();
      const results = await super.query(sql, params);
      const endTime = Date.now();
      
      // Log performance
      if (options.logPerformance) {
        console.log(`⚡ Query executed in ${endTime - startTime}ms:`, {
          sql: sql.length > 100 ? sql.substring(0, 100) + '...' : sql,
          params,
          duration: endTime - startTime
        });
      }
      
      // Store in cache
      if (options.useCache && this.config.cacheEnabled) {
        this.setCache(cacheKey, results);
      }
      
      return results;
    } catch (error) {
      console.error(`❌ Database error in ${this.tableName}:`, error.message);
      console.error('SQL:', sql);
      console.error('Params:', params);
      
      // Retry logic
      if (options.retry && options.retry > 0) {
        console.log(`🔄 Retrying query (${options.retry} attempts left)...`);
        await this.delay(1000); // Wait 1 second before retry
        return this.executeQuery(sql, params, {
          ...options,
          retry: options.retry - 1
        });
      }
      
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  generateQueryId(sql, params) {
    const str = sql + JSON.stringify(params);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16);
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // === ADVANCED CRUD OPERATIONS ===
  async findById(id, options = {}) {
    const cacheKey = `findById:${this.tableName}:${id}`;
    
    // Check cache
    if (options.useCache !== false && this.config.cacheEnabled) {
      const cached = this.getCache(cacheKey);
      if (cached) {
        return cached;
      }
    }
    
    const includeDeleted = options.includeDeleted || false;
    let sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
    
    if (!includeDeleted && this.config.softDelete) {
      sql += ' AND deleted_at IS NULL';
    }
    
    const results = await this.executeQuery(sql, [id], {
      useCache: options.useCache
    });
    
    const record = results.length > 0 ? results[0] : null;
    
    // Parse JSON fields
    if (record && this.schema) {
      Object.keys(record).forEach(key => {
        if (this.schema[key] && this.schema[key].type === 'json') {
          record[key] = this.parseJSON(record[key]);
        }
      });
    }
    
    // Cache the result
    if (record && options.useCache !== false && this.config.cacheEnabled) {
      this.setCache(cacheKey, record);
    }
    
    return record;
  }

  async findOne(filters = {}, options = {}) {
    const params = [];
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted: options.includeDeleted
    });
    
    const sql = `
      SELECT * FROM ${this.tableName}
      ${whereClause}
      LIMIT 1
    `;
    
    const results = await this.executeQuery(sql, params, {
      useCache: options.useCache
    });
    
    const record = results.length > 0 ? results[0] : null;
    
    // Parse JSON fields
    if (record && this.schema) {
      Object.keys(record).forEach(key => {
        if (this.schema[key] && this.schema[key].type === 'json') {
          record[key] = this.parseJSON(record[key]);
        }
      });
    }
    
    return record;
  }

  async findAll(filters = {}, options = {}) {
    const {
      page = 1,
      limit = 20,
      sort = { created_at: 'DESC' },
      includeDeleted = false,
      fields = ['*'],
      joins = [],
      groupBy = null,
      having = null,
      useCache = false
    } = options;
    
    const params = [];
    
    // Build SELECT clause
    const selectClause = Array.isArray(fields) ? fields.join(', ') : fields;
    
    // Build FROM clause with joins
    let fromClause = this.tableName;
    if (joins && joins.length > 0) {
      joins.forEach(join => {
        fromClause += ` ${join.type || 'INNER'} JOIN ${join.table} ON ${join.on}`;
      });
    }
    
    // Build WHERE clause
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted
    });
    
    // Build GROUP BY clause
    let groupByClause = '';
    if (groupBy) {
      groupByClause = `GROUP BY ${Array.isArray(groupBy) ? groupBy.join(', ') : groupBy}`;
    }
    
    // Build HAVING clause
    let havingClause = '';
    if (having) {
      havingClause = `HAVING ${having}`;
    }
    
    // Build ORDER BY clause
    const orderClause = this.buildOrderClause(sort);
    
    // Build pagination
    const paginationClause = this.buildPaginationClause(page, limit);
    
    // Build main query
    const dataSql = `
      SELECT ${selectClause}
      FROM ${fromClause}
      ${whereClause}
      ${groupByClause}
      ${havingClause}
      ${orderClause}
      ${paginationClause}
    `;
    
    // Build count query
    const countSql = `
      SELECT COUNT(*) as total
      FROM ${fromClause}
      ${whereClause}
      ${groupByClause}
      ${havingClause}
    `;
    
    const [data, countResult] = await Promise.all([
      this.executeQuery(dataSql, params, { useCache }),
      this.executeQuery(countSql, params, { useCache })
    ]);
    
    // Parse JSON fields in data
    if (data && this.schema) {
      data.forEach(record => {
        Object.keys(record).forEach(key => {
          if (this.schema[key] && this.schema[key].type === 'json') {
            record[key] = this.parseJSON(record[key]);
          }
        });
      });
    }
    
    const total = countResult[0]?.total || 0;
    const totalPages = Math.ceil(total / limit);
    
    return {
      data,
      pagination: {
        total: parseInt(total),
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
        hasMore: data.length === limit && page < totalPages
      }
    };
  }

  async create(data, options = {}) {
    // Validate data
    if (this.config.validation) {
      const validation = this.validateData(data, 'create');
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    const now = new Date();
    const id = data[this.primaryKey] || this.generateId();
    
    // Prepare record with defaults
    const record = {
      [this.primaryKey]: id,
      ...data
    };
    
    // Add timestamps
    if (this.config.timestamps) {
      if (!record.created_at) {
        record.created_at = this.formatDate(now);
      }
      if (!record.updated_at) {
        record.updated_at = this.formatDate(now);
      }
    }
    
    // Process JSON fields
    Object.keys(record).forEach(key => {
      if (this.schema && this.schema[key] && this.schema[key].type === 'json') {
        record[key] = this.stringifyJSON(record[key]);
      }
    });
    
    // Build INSERT query
    const columns = Object.keys(record).join(', ');
    const placeholders = Object.keys(record).map(() => '?').join(', ');
    const values = Object.values(record);
    
    const sql = `
      INSERT INTO ${this.tableName} (${columns})
      VALUES (${placeholders})
    `;
    
    await this.executeQuery(sql, values);
    
    // Invalidate cache
    this.clearCache(`findById:${this.tableName}:`);
    
    // Return created record
    const createdRecord = await this.findById(id, { includeDeleted: true });
    
    // Emit event if available
    if (options.onCreated && typeof options.onCreated === 'function') {
      options.onCreated(createdRecord);
    }
    
    return createdRecord;
  }

  async createMany(records, options = {}) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Records must be a non-empty array');
    }
    
    // Validate all records
    if (this.config.validation) {
      for (const record of records) {
        const validation = this.validateData(record, 'create');
        if (!validation.isValid) {
          throw new Error(`Validation failed for record: ${validation.errors.join(', ')}`);
        }
      }
    }
    
    const now = new Date();
    const batchSize = options.batchSize || this.config.maxBulkInsert;
    const results = [];
    
    // Process in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      const batchRecords = [];
      const batchValues = [];
      
      // Prepare batch records
      batch.forEach(record => {
        const id = record[this.primaryKey] || this.generateId();
        const preparedRecord = {
          [this.primaryKey]: id,
          ...record
        };
        
        // Add timestamps
        if (this.config.timestamps) {
          if (!preparedRecord.created_at) {
            preparedRecord.created_at = this.formatDate(now);
          }
          if (!preparedRecord.updated_at) {
            preparedRecord.updated_at = this.formatDate(now);
          }
        }
        
        // Process JSON fields
        Object.keys(preparedRecord).forEach(key => {
          if (this.schema && this.schema[key] && this.schema[key].type === 'json') {
            preparedRecord[key] = this.stringifyJSON(preparedRecord[key]);
          }
        });
        
        batchRecords.push(preparedRecord);
        batchValues.push(...Object.values(preparedRecord));
      });
      
      // Build bulk INSERT query
      const columns = Object.keys(batchRecords[0]).join(', ');
      const placeholders = batchRecords.map(() => 
        `(${Object.keys(batchRecords[0]).map(() => '?').join(', ')})`
      ).join(', ');
      
      const sql = `
        INSERT INTO ${this.tableName} (${columns})
        VALUES ${placeholders}
      `;
      
      await this.executeQuery(sql, batchValues);
      
      // Get IDs of inserted records
      const insertedIds = batchRecords.map(r => r[this.primaryKey]);
      results.push(...insertedIds);
      
      // Progress callback
      if (options.onProgress && typeof options.onProgress === 'function') {
        options.onProgress({
          processed: i + batch.length,
          total: records.length,
          percentage: Math.round(((i + batch.length) / records.length) * 100)
        });
      }
    }
    
    // Invalidate cache
    this.clearCache(`findById:${this.tableName}:`);
    
    return {
      success: true,
      insertedCount: results.length,
      insertedIds: results
    };
  }

  async update(id, data, options = {}) {
    // Check if record exists
    const existing = await this.findById(id, { 
      includeDeleted: options.includeDeleted 
    });
    
    if (!existing) {
      throw new Error(`${this.tableName} with ID ${id} not found`);
    }
    
    // Validate data
    if (this.config.validation) {
      const validation = this.validateData(data, 'update');
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    const now = new Date();
    const updateData = { ...data };
    
    // Update timestamp
    if (this.config.timestamps && !updateData.updated_at) {
      updateData.updated_at = this.formatDate(now);
    }
    
    // Process JSON fields
    Object.keys(updateData).forEach(key => {
      if (this.schema && this.schema[key] && this.schema[key].type === 'json') {
        updateData[key] = this.stringifyJSON(updateData[key]);
      }
    });
    
    // Build UPDATE query
    const setClause = Object.keys(updateData)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(updateData), id];
    
    let sql = `
      UPDATE ${this.tableName}
      SET ${setClause}
      WHERE ${this.primaryKey} = ?
    `;
    
    // Add soft delete condition if applicable
    if (this.config.softDelete && !options.includeDeleted) {
      sql += ' AND deleted_at IS NULL';
    }
    
    await this.executeQuery(sql, values);
    
    // Invalidate cache
    this.clearCache(`findById:${this.tableName}:${id}`);
    
    // Return updated record
    const updatedRecord = await this.findById(id, { 
      includeDeleted: options.includeDeleted 
    });
    
    // Emit event if available
    if (options.onUpdated && typeof options.onUpdated === 'function') {
      options.onUpdated(updatedRecord, existing);
    }
    
    return updatedRecord;
  }

  async updateMany(filters, data, options = {}) {
    // Validate data
    if (this.config.validation) {
      const validation = this.validateData(data, 'update');
      if (!validation.isValid) {
        throw new Error(`Validation failed: ${validation.errors.join(', ')}`);
      }
    }
    
    const now = new Date();
    const updateData = { ...data };
    
    // Update timestamp
    if (this.config.timestamps && !updateData.updated_at) {
      updateData.updated_at = this.formatDate(now);
    }
    
    // Process JSON fields
    Object.keys(updateData).forEach(key => {
      if (this.schema && this.schema[key] && this.schema[key].type === 'json') {
        updateData[key] = this.stringifyJSON(updateData[key]);
      }
    });
    
    // Build WHERE clause
    const params = [];
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted: options.includeDeleted
    });
    
    // Build SET clause
    const setClause = Object.keys(updateData)
      .map(key => `${key} = ?`)
      .join(', ');
    
    const values = [...Object.values(updateData), ...params];
    
    const sql = `
      UPDATE ${this.tableName}
      SET ${setClause}
      ${whereClause}
    `;
    
    const result = await this.executeQuery(sql, values);
    
    // Invalidate cache
    this.clearCache(`findById:${this.tableName}:`);
    
    return {
      success: true,
      affectedRows: result.affectedRows || 0
    };
  }

  async upsert(data, conflictKey = null) {
    const key = conflictKey || this.primaryKey;
    const existing = data[key] ? await this.findById(data[key], { includeDeleted: true }) : null;
    
    if (existing) {
      return this.update(data[key], data);
    } else {
      return this.create(data);
    }
  }

  async delete(id, options = {}) {
    if (this.config.softDelete && !options.hardDelete) {
      return this.softDeleteRecord(id, options);
    } else {
      return this.hardDelete(id, options);
    }
  }

  async softDeleteRecord(id, options = {}) {
    if (!this.config.softDelete) {
      throw new Error('Soft delete not enabled for this model');
    }
    
    const sql = `
      UPDATE ${this.tableName}
      SET deleted_at = ?
      WHERE ${this.primaryKey} = ?
      AND deleted_at IS NULL
    `;
    
    await this.executeQuery(sql, [this.formatDate(new Date()), id]);
    
    // Invalidate cache
    this.clearCache(`findById:${this.tableName}:${id}`);
    
    // Emit event if available
    if (options.onDeleted && typeof options.onDeleted === 'function') {
      const deletedRecord = await this.findById(id, { includeDeleted: true });
      options.onDeleted(deletedRecord, 'soft');
    }
    
    return true;
  }

  async hardDelete(id, options = {}) {
    const sql = `
      DELETE FROM ${this.tableName}
      WHERE ${this.primaryKey} = ?
    `;
    
    // Get record before deletion for event
    let deletedRecord = null;
    if (options.onDeleted) {
      deletedRecord = await this.findById(id, { includeDeleted: true });
    }
    
    await this.executeQuery(sql, [id]);
    
    // Invalidate cache
    this.clearCache(`findById:${this.tableName}:${id}`);
    
    // Emit event if available
    if (options.onDeleted && typeof options.onDeleted === 'function') {
      options.onDeleted(deletedRecord, 'hard');
    }
    
    return true;
  }

  async restore(id) {
    if (!this.config.softDelete) {
      throw new Error('Soft delete not enabled for this model');
    }
    
    const sql = `
      UPDATE ${this.tableName}
      SET deleted_at = NULL
      WHERE ${this.primaryKey} = ?
      AND deleted_at IS NOT NULL
    `;
    
    await this.executeQuery(sql, [id]);
    
    // Invalidate cache
    this.clearCache(`findById:${this.tableName}:${id}`);
    
    return this.findById(id, { includeDeleted: true });
  }

  async count(filters = {}, options = {}) {
    const params = [];
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted: options.includeDeleted
    });
    
    let sql = `SELECT COUNT(*) as count FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` ${whereClause}`;
    }
    
    const results = await this.executeQuery(sql, params, {
      useCache: options.useCache
    });
    
    return parseInt(results[0]?.count) || 0;
  }

  async exists(filters, options = {}) {
    const count = await this.count(filters, options);
    return count > 0;
  }

  async sum(field, filters = {}, options = {}) {
    const params = [];
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted: options.includeDeleted
    });
    
    let sql = `SELECT COALESCE(SUM(${field}), 0) as total FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` ${whereClause}`;
    }
    
    const results = await this.executeQuery(sql, params);
    return parseFloat(results[0]?.total) || 0;
  }

  async average(field, filters = {}, options = {}) {
    const params = [];
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted: options.includeDeleted
    });
    
    let sql = `SELECT COALESCE(AVG(${field}), 0) as average FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` ${whereClause}`;
    }
    
    const results = await this.executeQuery(sql, params);
    return parseFloat(results[0]?.average) || 0;
  }

  async max(field, filters = {}, options = {}) {
    const params = [];
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted: options.includeDeleted
    });
    
    let sql = `SELECT MAX(${field}) as max FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` ${whereClause}`;
    }
    
    const results = await this.executeQuery(sql, params);
    return results[0]?.max || null;
  }

  async min(field, filters = {}, options = {}) {
    const params = [];
    const whereClause = this.buildWhereClause(filters, params, {
      includeDeleted: options.includeDeleted
    });
    
    let sql = `SELECT MIN(${field}) as min FROM ${this.tableName}`;
    if (whereClause) {
      sql += ` ${whereClause}`;
    }
    
    const results = await this.executeQuery(sql, params);
    return results[0]?.min || null;
  }

  // === TRANSACTION SUPPORT ===
  async transaction(callback) {
    return super.transaction(async (connection) => {
      // Create a wrapped connection that uses BaseModel methods
      const wrappedConnection = {
        query: async (sql, params) => {
          const [results] = await connection.execute(sql, params);
          return results;
        },
        
        // BaseModel methods within transaction
        findById: async (id, options = {}) => {
          const includeDeleted = options.includeDeleted || false;
          let sql = `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
          
          if (!includeDeleted && this.config.softDelete) {
            sql += ' AND deleted_at IS NULL';
          }
          
          const results = await connection.query(sql, [id]);
          return results.length > 0 ? results[0] : null;
        },
        
        create: async (data) => {
          const now = new Date();
          const id = data[this.primaryKey] || this.generateId();
          
          const record = {
            [this.primaryKey]: id,
            ...data,
            created_at: this.formatDate(data.created_at || now),
            updated_at: this.formatDate(data.updated_at || now)
          };
          
          // Process JSON fields
          Object.keys(record).forEach(key => {
            if (typeof record[key] === 'object' && record[key] !== null) {
              record[key] = this.stringifyJSON(record[key]);
            }
          });
          
          const columns = Object.keys(record).join(', ');
          const placeholders = Object.keys(record).map(() => '?').join(', ');
          const values = Object.values(record);
          
          const sql = `
            INSERT INTO ${this.tableName} (${columns})
            VALUES (${placeholders})
          `;
          
          await connection.query(sql, values);
          return record;
        },
        
        update: async (id, data) => {
          const now = new Date();
          const updateData = {
            ...data,
            updated_at: this.formatDate(now)
          };
          
          // Process JSON fields
          Object.keys(updateData).forEach(key => {
            if (typeof updateData[key] === 'object' && updateData[key] !== null) {
              updateData[key] = this.stringifyJSON(updateData[key]);
            }
          });
          
          const setClause = Object.keys(updateData)
            .map(key => `${key} = ?`)
            .join(', ');
          
          const values = [...Object.values(updateData), id];
          
          const sql = `
            UPDATE ${this.tableName}
            SET ${setClause}
            WHERE ${this.primaryKey} = ?
            ${this.config.softDelete ? 'AND deleted_at IS NULL' : ''}
          `;
          
          await connection.query(sql, values);
          
          // Return updated record
          const result = await connection.query(
            `SELECT * FROM ${this.tableName} WHERE ${this.primaryKey} = ?`,
            [id]
          );
          
          return result.length > 0 ? result[0] : null;
        },
        
        delete: async (id) => {
          if (this.config.softDelete) {
            const sql = `
              UPDATE ${this.tableName}
              SET deleted_at = ?
              WHERE ${this.primaryKey} = ?
              AND deleted_at IS NULL
            `;
            await connection.query(sql, [this.formatDate(new Date()), id]);
          } else {
            const sql = `DELETE FROM ${this.tableName} WHERE ${this.primaryKey} = ?`;
            await connection.query(sql, [id]);
          }
          return true;
        }
      };
      
      return await callback(wrappedConnection);
    });
  }

  // === MIGRATION AND MAINTENANCE ===
  async getTableInfo() {
    const sql = `
      SELECT 
        TABLE_NAME,
        TABLE_ROWS,
        AVG_ROW_LENGTH,
        DATA_LENGTH,
        INDEX_LENGTH,
        DATA_FREE,
        AUTO_INCREMENT,
        CREATE_TIME,
        UPDATE_TIME,
        TABLE_COLLATION
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `;
    
    const results = await this.query(sql, [this.tableName]);
    return results[0] || null;
  }

  async getIndexes() {
    const sql = `
      SELECT 
        INDEX_NAME,
        COLUMN_NAME,
        SEQ_IN_INDEX,
        INDEX_TYPE,
        NON_UNIQUE,
        INDEX_COMMENT
      FROM INFORMATION_SCHEMA.STATISTICS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `;
    
    return await this.query(sql, [this.tableName]);
  }

  async optimizeTable() {
    const sql = `OPTIMIZE TABLE ${this.tableName}`;
    return await this.query(sql);
  }

  async analyzeTable() {
    const sql = `ANALYZE TABLE ${this.tableName}`;
    return await this.query(sql);
  }

  async checkTable() {
    const sql = `CHECK TABLE ${this.tableName}`;
    return await this.query(sql);
  }

  async repairTable() {
    const sql = `REPAIR TABLE ${this.tableName}`;
    return await this.query(sql);
  }

  // === BATCH PROCESSING ===
  async batchProcess(options = {}) {
    const {
      batchSize = 1000,
      processCallback,
      where = '',
      orderBy = 'id',
      onProgress,
      onComplete
    } = options;
    
    if (typeof processCallback !== 'function') {
      throw new Error('processCallback must be a function');
    }
    
    let processed = 0;
    let page = 1;
    let hasMore = true;
    
    while (hasMore) {
      const filters = {};
      const whereClause = where ? `WHERE ${where}` : '';
      
      const sql = `
        SELECT * FROM ${this.tableName}
        ${whereClause}
        ORDER BY ${orderBy}
        LIMIT ${batchSize} OFFSET ${(page - 1) * batchSize}
      `;
      
      const batch = await this.query(sql);
      
      if (batch.length === 0) {
        hasMore = false;
        break;
      }
      
      // Process batch
      for (const record of batch) {
        await processCallback(record, processed);
        processed++;
      }
      
      // Progress callback
      if (onProgress && typeof onProgress === 'function') {
        await onProgress({
          processed,
          batch: page,
          hasMore: batch.length === batchSize
        });
      }
      
      page++;
      
      // Check if we should continue
      if (batch.length < batchSize) {
        hasMore = false;
      }
    }
    
    // Complete callback
    if (onComplete && typeof onComplete === 'function') {
      await onComplete({ totalProcessed: processed });
    }
    
    return { totalProcessed: processed };
  }

  // === DEBUGGING AND MONITORING ===
  async explainQuery(sql, params = []) {
    const explainSql = `EXPLAIN ${sql}`;
    return await this.query(explainSql, params);
  }

  async getQueryStats() {
    const sql = `
      SELECT 
        DIGEST_TEXT as query,
        COUNT_STAR as executions,
        SUM_TIMER_WAIT as total_time,
        AVG_TIMER_WAIT as avg_time,
        MIN_TIMER_WAIT as min_time,
        MAX_TIMER_WAIT as max_time
      FROM performance_schema.events_statements_summary_by_digest
      WHERE DIGEST_TEXT LIKE '%${this.tableName}%'
      ORDER BY SUM_TIMER_WAIT DESC
      LIMIT 10
    `;
    
    try {
      return await this.query(sql);
    } catch (error) {
      console.warn('Could not fetch query stats:', error.message);
      return [];
    }
  }

  // === UTILITY METHODS ===
  async truncate() {
    const sql = `TRUNCATE TABLE ${this.tableName}`;
    return await this.query(sql);
  }

  async getLastInsertId() {
    const result = await this.query('SELECT LAST_INSERT_ID() as id');
    return result[0]?.id || null;
  }

  async getNextAutoIncrement() {
    const sql = `
      SELECT AUTO_INCREMENT
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
    `;
    
    const result = await this.query(sql, [this.tableName]);
    return result[0]?.AUTO_INCREMENT || null;
  }

  // === RELATIONSHIP SUPPORT (Basic) ===
  async with(relation, options = {}) {
    // This is a basic implementation
    // For complex relationships, consider using an ORM
    console.warn('with() method is basic - consider extending for complex relationships');
    
    const relationMap = {
      belongsTo: this._belongsTo,
      hasMany: this._hasMany,
      hasOne: this._hasOne
    };
    
    const handler = relationMap[relation.type];
    if (handler) {
      return handler.call(this, relation, options);
    }
    
    throw new Error(`Unsupported relation type: ${relation.type}`);
  }

  async _belongsTo(relation, options) {
    const { foreignKey, localKey = this.primaryKey } = relation;
    const { id } = options;
    
    if (!id) {
      throw new Error('id is required for belongsTo relationship');
    }
    
    // Get current record
    const record = await this.findById(id, options);
    if (!record) return null;
    
    // Get related record
    const relatedModel = new BaseModel(relation.relatedTable);
    const relatedRecord = await relatedModel.findById(record[foreignKey]);
    
    return {
      ...record,
      [relation.name]: relatedRecord
    };
  }

  async _hasMany(relation, options) {
    const { foreignKey, localKey = this.primaryKey } = relation;
    const { id } = options;
    
    if (!id) {
      throw new Error('id is required for hasMany relationship');
    }
    
    // Get current record
    const record = await this.findById(id, options);
    if (!record) return null;
    
    // Get related records
    const relatedModel = new BaseModel(relation.relatedTable);
    const relatedRecords = await relatedModel.findAll({
      [foreignKey]: record[localKey]
    }, options);
    
    return {
      ...record,
      [relation.name]: relatedRecords.data
    };
  }

  // === EVENT EMITTER PATTERN ===
  on(event, listener) {
    if (!this._events) this._events = {};
    if (!this._events[event]) this._events[event] = [];
    this._events[event].push(listener);
  }

  off(event, listener) {
    if (!this._events || !this._events[event]) return;
    
    const index = this._events[event].indexOf(listener);
    if (index > -1) {
      this._events[event].splice(index, 1);
    }
  }

  emit(event, ...args) {
    if (!this._events || !this._events[event]) return;
    
    this._events[event].forEach(listener => {
      try {
        listener(...args);
      } catch (error) {
        console.error(`Error in event listener for ${event}:`, error);
      }
    });
  }
}

export default BaseModel;

/*
 * Key Enhancements in the Advanced BaseModel:
    Caching System: Built-in caching with TTL and automatic cleanup
    Schema Awareness: Automatic schema caching and validation
    Advanced Query Building: Support for complex operators and joins
    Bulk Operations: Efficient batch processing for large datasets
    Transaction Support: Full transaction support with model methods
    Performance Monitoring: Query explanation and statistics
    Validation Framework: Type and constraint validation
    Event System: Event emitter pattern for lifecycle events
    Relationship Support: Basic relationship handling
    Migration Tools: Table optimization and maintenance
    Error Handling: Retry logic and better error reporting
    Type Conversion: Automatic JSON parsing/stringifying
    Pagination: Comprehensive pagination with metadata
    Aggregation Functions: SUM, AVG, MIN, MAX, COUNT
    Debugging Tools: Query explanation and performance logging
 */
