const pool = require('../config/database');

// ============================================================================
// CREATE DOCUMENT REVIEW
// ============================================================================

const createDocumentReview = async (reviewData) => {
  const { searchResultId, userId, aiAssessment = 'pending' } = reviewData;

  const query = `
    INSERT INTO document_reviews (search_result_id, user_id, ai_assessment)
    VALUES ($1, $2, $3)
    ON CONFLICT (search_result_id, user_id) DO UPDATE 
    SET updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [searchResultId, userId, aiAssessment]);
    return result.rows[0];
  } catch (error) {
    console.error('Create review error:', error.message);
    return null;
  }
};

// ============================================================================
// GET REVIEW BY ID
// ============================================================================

const getReviewById = async (id) => {
  const query = `
    SELECT dr.*, sr.document_number, sr.document_type, sr.recording_date,
           sr.grantor, sr.grantee, sr.legal_description, sr.portal_url
    FROM document_reviews dr
    JOIN search_results sr ON dr.search_result_id = sr.id
    WHERE dr.id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// ============================================================================
// GET REVIEWS BY TASK
// ============================================================================

const getReviewsByTask = async (taskId) => {
  const query = `
    SELECT dr.*, sr.document_number, sr.document_type, sr.recording_date,
           sr.grantor, sr.grantee, sr.legal_description, sr.portal_url
    FROM document_reviews dr
    JOIN search_results sr ON dr.search_result_id = sr.id
    WHERE sr.search_task_id = $1
    ORDER BY dr.created_at DESC;
  `;
  const result = await pool.query(query, [taskId]);
  return result.rows;
};

// ============================================================================
// UPDATE AI ANALYSIS
// ============================================================================

const updateAIAnalysis = async (reviewId, analysisData) => {
  const { aiAssessment, aiConfidence, aiEvidence, aiRelevantPages, aiQuotes } = analysisData;

  const query = `
    UPDATE document_reviews
    SET ai_assessment = $1,
        ai_confidence = $2,
        ai_evidence = $3,
        ai_relevant_pages = $4,
        ai_quotes = $5,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING *;
  `;

  const result = await pool.query(query, [
    aiAssessment,
    aiConfidence,
    aiEvidence,
    aiRelevantPages,
    aiQuotes,
    reviewId,
  ]);
  return result.rows[0];
};

// ============================================================================
// UPDATE USER DECISION
// ============================================================================

const updateUserDecision = async (reviewId, decisionData) => {
  const { userDecision, userNotes, userConfirmed, markedForDownload } = decisionData;

  const query = `
    UPDATE document_reviews
    SET user_decision = $1,
        user_notes = $2,
        user_confirmed = $3,
        marked_for_download = $4,
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $5
    RETURNING *;
  `;

  const result = await pool.query(query, [
    userDecision,
    userNotes,
    userConfirmed,
    markedForDownload,
    reviewId,
  ]);
  return result.rows[0];
};

// ============================================================================
// MARK FOR DOWNLOAD
// ============================================================================

const markForDownload = async (reviewId, mark = true) => {
  const query = `
    UPDATE document_reviews
    SET marked_for_download = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const result = await pool.query(query, [mark, reviewId]);
  return result.rows[0];
};

// ============================================================================
// GET MARKED FOR DOWNLOAD
// ============================================================================

const getMarkedForDownload = async (taskId) => {
  const query = `
    SELECT dr.*, sr.document_number, sr.document_type, sr.recording_date,
           sr.grantor, sr.grantee, sr.portal_url
    FROM document_reviews dr
    JOIN search_results sr ON dr.search_result_id = sr.id
    WHERE sr.search_task_id = $1 AND dr.marked_for_download = true
    ORDER BY sr.recording_date DESC;
  `;
  const result = await pool.query(query, [taskId]);
  return result.rows;
};

// ============================================================================
// MARK AS DOWNLOADED
// ============================================================================

const markAsDownloaded = async (reviewId, filePath = null) => {
  const query = `
    UPDATE document_reviews
    SET downloaded_at = CURRENT_TIMESTAMP,
        file_path = COALESCE($1, file_path),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  const result = await pool.query(query, [filePath, reviewId]);
  return result.rows[0];
};

// ============================================================================
// GET DOWNLOADED BY TASK
// ============================================================================

const getDownloadedByTask = async (taskId) => {
  const query = `
    SELECT dr.*, sr.document_number, sr.document_type, sr.recording_date,
           sr.grantor, sr.grantee
    FROM document_reviews dr
    JOIN search_results sr ON dr.search_result_id = sr.id
    WHERE sr.search_task_id = $1 AND dr.downloaded_at IS NOT NULL
    ORDER BY dr.downloaded_at DESC;
  `;
  const result = await pool.query(query, [taskId]);
  return result.rows;
};

// ============================================================================
// GET STATS
// ============================================================================

const getReviewStats = async (taskId) => {
  const query = `
    SELECT 
      COUNT(*) as total,
      COUNT(*) FILTER (WHERE ai_assessment = 'meets_criteria') as meets_criteria,
      COUNT(*) FILTER (WHERE ai_assessment = 'probable_match') as probable_match,
      COUNT(*) FILTER (WHERE ai_assessment = 'exclude') as exclude,
      COUNT(*) FILTER (WHERE ai_assessment = 'pending') as pending,
      COUNT(*) FILTER (WHERE user_confirmed = true) as user_reviewed,
      COUNT(*) FILTER (WHERE marked_for_download = true) as marked_for_download,
      COUNT(*) FILTER (WHERE downloaded_at IS NOT NULL) as downloaded
    FROM document_reviews dr
    JOIN search_results sr ON dr.search_result_id = sr.id
    WHERE sr.search_task_id = $1;
  `;
  const result = await pool.query(query, [taskId]);
  return result.rows[0];
};

module.exports = {
  createDocumentReview,
  getReviewById,
  getReviewsByTask,
  updateAIAnalysis,
  updateUserDecision,
  markForDownload,
  getMarkedForDownload,
  markAsDownloaded,
  getDownloadedByTask,
  getReviewStats,
};
