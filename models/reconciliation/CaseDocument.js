import BaseModel from '../BaseModel.js';

class CaseDocument extends BaseModel {
  constructor() {
    super('case_documents', 'document_id');
    this.jsonFields = ['metadata'];
  }

  // Document types for reconciliation cases
  static DOCUMENT_TYPES = {
    FILING_DOCUMENT: 'FILING_DOCUMENT',
    EVIDENCE: 'EVIDENCE',
    AGREEMENT: 'AGREEMENT',
    SETTLEMENT: 'SETTLEMENT',
    MEDIATION_REPORT: 'MEDIATION_REPORT',
    WITNESS_STATEMENT: 'WITNESS_STATEMENT',
    FINANCIAL_STATEMENT: 'FINANCIAL_STATEMENT',
    LEGAL_DOCUMENT: 'LEGAL_DOCUMENT',
    OTHER: 'OTHER'
  };

  // Validation rules
  validate(data, isUpdate = false) {
    const errors = [];

    if (!isUpdate) {
      if (!data.case_id) {
        errors.push('Case ID is required');
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

    if (data.document_type && !Object.values(CaseDocument.DOCUMENT_TYPES).includes(data.document_type)) {
      errors.push(`Invalid document type. Must be one of: ${Object.values(CaseDocument.DOCUMENT_TYPES).join(', ')}`);
    }

    return errors;
  }

  // Create document with validation
  async createDocument(data, userId) {
    const errors = this.validate(data, false);
    if (errors.length > 0) {
      throw new Error(`Validation failed: ${errors.join(', ')}`);
    }

    // Check if case exists
    const caseSql = `
      SELECT * FROM reconciliation_cases 
      WHERE case_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [caseRecord] = await this.executeQuery(caseSql, [data.case_id]);
    if (!caseRecord) {
      throw new Error('Case not found');
    }

    const documentData = {
      ...data,
      uploaded_by: userId,
      upload_date: this.formatDate(new Date()),
      metadata: data.metadata || {}
    };

    return await this.create(documentData);
  }

  // Get case documents
  async getCaseDocuments(caseId, documentType = null) {
    let sql = `
      SELECT 
        cd.*,
        u.email as uploaded_by_email,
        p.full_name_arabic as uploaded_by_name
      FROM ${this.tableName} cd
      LEFT JOIN users u ON cd.uploaded_by = u.user_id
      LEFT JOIN persons p ON u.person_id = p.person_id
      WHERE cd.case_id = ?
      AND cd.deleted_at IS NULL
    `;
    
    const params = [caseId];

    if (documentType) {
      sql += ' AND cd.document_type = ?';
      params.push(documentType);
    }

    sql += ' ORDER BY cd.upload_date DESC';

    return await this.executeQuery(sql, params);
  }

  // Get session documents
  async getSessionDocuments(sessionId) {
    const sql = `
      SELECT 
        cd.*,
        u.email as uploaded_by_email,
        p.full_name_arabic as uploaded_by_name
      FROM ${this.tableName} cd
      LEFT JOIN users u ON cd.uploaded_by = u.user_id
      LEFT JOIN persons p ON u.person_id = p.person_id
      WHERE cd.session_id = ?
      AND cd.deleted_at IS NULL
      ORDER BY cd.upload_date DESC
    `;
    
    return await this.executeQuery(sql, [sessionId]);
  }

  // Link document to session
  async linkToSession(documentId, sessionId) {
    const document = await this.findById(documentId);
    if (!document) {
      throw new Error('Document not found');
    }

    // Check if session exists
    const sessionSql = `
      SELECT * FROM case_sessions 
      WHERE session_id = ? 
      AND deleted_at IS NULL
    `;
    
    const [session] = await this.executeQuery(sessionSql, [sessionId]);
    if (!session) {
      throw new Error('Session not found');
    }

    // Check if session belongs to the same case
    if (session.case_id !== document.case_id) {
      throw new Error('Session does not belong to the same case');
    }

    return await this.update(documentId, {
      session_id: sessionId,
      updated_at: this.formatDate(new Date())
    });
  }
}

export default CaseDocument;
