const pool = require('../config/database');

// ============================================================================
// CREATE SEARCH RESULT
// ============================================================================

const createSearchResult = async (resultData) => {
  const {
    searchTaskId,
    documentNumber,
    recordingDate,
    grantor,
    grantee,
    documentType,
    pageCount,
    portalUrl,
  } = resultData;

  const query = `
    INSERT INTO search_results (
      search_task_id, document_number, recording_date, grantor, grantee,
      document_type, page_count, portal_url, status
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new')
    ON CONFLICT (search_task_id, document_number) 
    DO UPDATE SET updated_at = CURRENT_TIMESTAMP
    RETURNING *;
  `;

  try {
    const result = await pool.query(query, [
      searchTaskId,
      documentNumber,
      recordingDate,
      grantor,
      grantee,
      documentType,
      pageCount,
      portalUrl,
    ]);

    return result.rows[0];
  } catch (error) {
    console.error('Create search result error:', error.message);
    return null;
  }
};

// ============================================================================
// GET SEARCH RESULTS
// ============================================================================

const getSearchResults = async (searchTaskId) => {
  const query = `
    SELECT * FROM search_results
    WHERE search_task_id = $1
    ORDER BY recording_date DESC;
  `;

  const result = await pool.query(query, [searchTaskId]);
  return result.rows;
};

const getSearchResultById = async (id) => {
  const query = 'SELECT * FROM search_results WHERE id = $1;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// ============================================================================
// UPDATE SEARCH RESULT STATUS
// ============================================================================

const updateSearchResultStatus = async (id, status, notes = '') => {
  const query = `
    UPDATE search_results
    SET status = $1, review_notes = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING *;
  `;

  const result = await pool.query(query, [status, notes, id]);
  return result.rows[0];
};

// ============================================================================
// MARK FOR DOWNLOAD
// ============================================================================

const markForDownload = async (resultId) => {
  const query = `
    UPDATE search_results
    SET status = 'marked_for_review', updated_at = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING *;
  `;

  const result = await pool.query(query, [resultId]);
  return result.rows[0];
};

// ============================================================================
// EXCLUDE RESULT
// ============================================================================

const excludeResult = async (id, reason = '') => {
  const query = `
    UPDATE search_results
    SET status = 'excluded', review_notes = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;

  const result = await pool.query(query, [reason, id]);
  return result.rows[0];
};

// ============================================================================
// GET RESULTS FOR REVIEW
// ============================================================================

const getResultsForReview = async (searchTaskId) => {
  const query = `
    SELECT * FROM search_results
    WHERE search_task_id = $1 AND status IN ('new', 'marked_for_review')
    ORDER BY recording_date DESC;
  `;

  const result = await pool.query(query, [searchTaskId]);
  return result.rows;
};

module.exports = {
  createSearchResult,
  getSearchResults,
  getSearchResultById,
  updateSearchResultStatus,
  markForDownload,
  excludeResult,
  getResultsForReview,
};
