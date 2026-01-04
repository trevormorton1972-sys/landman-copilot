const pool = require('../config/database');

// ============================================================================
// DOCUMENT ANALYSIS RECORDS
// ============================================================================

const createDocumentAnalysis = async (analysisData) => {
  const {
    documentId,
    documentNumber,
    documentType,
    recordingDate,
    grantor,
    grantee,
    legalDescription,
    considerationAmount,
    pageCount,
    extractedText,
    confidenceScore,
  } = analysisData;

  const query = `
    INSERT INTO document_analysis (
      document_id, document_number, document_type, recording_date,
      grantor, grantee, legal_description, consideration_amount,
      page_count, extracted_text, confidence_score
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [
      documentId,
      documentNumber,
      documentType,
      recordingDate,
      grantor,
      grantee,
      legalDescription,
      considerationAmount,
      pageCount,
      extractedText,
      confidenceScore,
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Create document analysis error:', error.message);
    return null;
  }
};

// ============================================================================
// GET DOCUMENT ANALYSIS
// ============================================================================

const getDocumentAnalysis = async (documentId) => {
  const query = `
    SELECT * FROM document_analysis
    WHERE document_id = $1;
  `;

  const result = await pool.query(query, [documentId]);
  return result.rows[0];
};

const getDocumentAnalysisById = async (id) => {
  const query = 'SELECT * FROM document_analysis WHERE id = $1;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// ============================================================================
// EXTRACTED ENTITIES
// ============================================================================

const createExtractedEntity = async (analysisId, entityType, entityValue, confidence, context) => {
  const query = `
    INSERT INTO extracted_entities (
      analysis_id, entity_type, entity_value, confidence, context
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING *;
  `;

  const result = await pool.query(query, [analysisId, entityType, entityValue, confidence, context]);
  return result.rows[0];
};

const getExtractedEntities = async (analysisId) => {
  const query = `
    SELECT * FROM extracted_entities
    WHERE analysis_id = $1
    ORDER BY entity_type, confidence DESC;
  `;

  const result = await pool.query(query, [analysisId]);
  return result.rows;
};

const getEntitiesByType = async (analysisId, entityType) => {
  const query = `
    SELECT * FROM extracted_entities
    WHERE analysis_id = $1 AND entity_type = $2
    ORDER BY confidence DESC;
  `;

  const result = await pool.query(query, [analysisId, entityType]);
  return result.rows;
};

// ============================================================================
// ANALYSIS STATUS
// ============================================================================

const updateAnalysisStatus = async (id, status, notes = '') => {
  const query = `
    UPDATE document_analysis
    SET status = $1, analysis_notes = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *;
  `;

  const result = await pool.query(query, [status, notes, id]);
  return result.rows[0];
};

// ============================================================================
// BATCH ANALYSIS
// ============================================================================

const getUnanalyzedDocuments = async (organizationId, limit = 10) => {
  const query = `
    SELECT d.* FROM documents d
    LEFT JOIN document_analysis da ON d.id = da.document_id
    WHERE d.organization_id = $1 AND da.id IS NULL
    LIMIT $2;
  `;

  const result = await pool.query(query, [organizationId, limit]);
  return result.rows;
};

const getAnalysisStats = async (organizationId) => {
  const query = `
    SELECT
      COUNT(DISTINCT d.id) as total_documents,
      COUNT(DISTINCT da.id) as analyzed_documents,
      COUNT(DISTINCT ee.id) as total_entities,
      AVG(da.confidence_score) as avg_confidence
    FROM documents d
    LEFT JOIN document_analysis da ON d.id = da.document_id
    LEFT JOIN extracted_entities ee ON da.id = ee.analysis_id
    WHERE d.organization_id = $1;
  `;

  const result = await pool.query(query, [organizationId]);
  return result.rows[0];
};

module.exports = {
  createDocumentAnalysis,
  getDocumentAnalysis,
  getDocumentAnalysisById,
  createExtractedEntity,
  getExtractedEntities,
  getEntitiesByType,
  updateAnalysisStatus,
  getUnanalyzedDocuments,
  getAnalysisStats,
};
