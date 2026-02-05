import BaseModel from '../../libs/BaseModel.js';

class ExecutiveDocument extends BaseModel {
  constructor() {
    super('executive_documents', 'document_id');
    this.jsonFields = ['metadata'];
  }

  // Document types
  static DOCUMENT_TYPES = [
    'APPOINTMENT_LETTER',
    'CONTRACT',
    'PERFORMANCE_REVIEW',
    'PROMOTION_LETTER',
    'TRANSFER_ORDER',
    'RESIGNATION_LETTER',
    'TERMINATION_LETTER',
    'AWARD_CERTIFICATE',
    'TRAINING_CERTIFICATE',
    'OTHER'
  ];

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate) {
      if (!data.executive_id) {
        errors.push('Executive ID is required');
      }
      if (!data.document_type) {
        errors.push('Document type is required');
      }
      if (!data.document_title) {
        errors.push('Document title is required');
      }
      if (!data.file_path) {
        errors.push('File path is required');
      }
    }

    if (data.document_type && !ExecutiveDocument.DOCUMENT_TYPES.includes(data.document_type)) {
      errors.push(`Invalid document type. Must be one of: ${ExecutiveDocument.DOCUMENT_TYPES.join(', ')}`);
    }

    return errors;
  }

  // Create document with validation
  async createDocument(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if executive exists
    const executiveSql = `
      SELECT * FROM executive_management
      WHERE executive_id = ?
      AND deleted_at IS NULL
    `;
    
    const [executive] = await this.executeQuery(executiveSql, [data.executive_id]);
    if (!executive) {
      throw new Error('Executive not found');
    }

    const documentData = {
      ...data,
      uploaded_by: userId,
      upload_date: this.formatDate(new Date()),
      metadata: data.metadata || {}
    };

    return await this.create(documentData);
  }

  // Get executive documents
  async getExecutiveDocuments(executiveId, documentType = null) {
    let sql = `
      SELECT 
        d.*,
        u.email as uploaded_by_email,
        p.full_name_arabic as uploaded_by_name
      FROM ${this.tableName} d
      LEFT JOIN users u ON d.uploaded_by = u.user_id
      LEFT JOIN persons p ON u.person_id = p.person_id
      WHERE d.executive_id = ?
      AND d.deleted_at IS NULL
    `;
    
    const params = [executiveId];

    if (documentType) {
      sql += ' AND d.document_type = ?';
      params.push(documentType);
    }

    sql += ' ORDER BY d.upload_date DESC';

    return await this.executeQuery(sql, params);
  }

  // Get documents by type
  async getDocumentsByType(documentType, options = {}) {
    const { page = 1, limit = 50 } = options;
    const offset = (page - 1) * limit;

    const sql = `
      SELECT 
        d.*,
        e.position_arabic,
        p.full_name_arabic,
        p.full_name_english
      FROM ${this.tableName} d
      INNER JOIN executive_management e ON d.executive_id = e.executive_id
      INNER JOIN persons p ON e.person_id = p.person_id
      WHERE d.document_type = ?
      AND d.deleted_at IS NULL
      AND e.deleted_at IS NULL
      ORDER BY d.upload_date DESC
      LIMIT ? OFFSET ?
    `;
    
    return await this.executeQuery(sql, [documentType, limit, offset]);
  }
}

export default ExecutiveDocument;
