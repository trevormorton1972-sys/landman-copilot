const pool = require('../config/database');

// ============================================================================
// CREATE SEARCH TASK
// ============================================================================

const createSearchTask = async (
  organizationId,
  userId,
  portalId,
  countyId,
  partyName,
  partyRole,
  dateFrom,
  dateTo,
  legalDescription,
  documentReference,
  priority = 5,
  notes = ''
) => {
  const query = `
    INSERT INTO search_tasks (
      organization_id, user_id, portal_id, county_id,
      party_name, party_role, date_from, date_to,
      legal_description, document_reference, priority, notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *;
  `;
  
  const result = await pool.query(query, [
    organizationId, userId, portalId, countyId,
    partyName, partyRole, dateFrom, dateTo,
    legalDescription, documentReference, priority, notes
  ]);
  
  return result.rows[0];
};

// ============================================================================
// GET SEARCH TASKS
// ============================================================================

const getSearchTaskById = async (id) => {
  const query = `
    SELECT st.*, 
           p.name as portal_name, p.slug as portal_slug,
           c.name as county_name, c.state as county_state,
           u.email as user_email, u.first_name, u.last_name
    FROM search_tasks st
    JOIN portals p ON st.portal_id = p.id
    JOIN counties c ON st.county_id = c.id
    JOIN users u ON st.user_id = u.id
    WHERE st.id = $1;
  `;
  
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const getSearchTasksByUser = async (userId, limit = 50, offset = 0) => {
  const query = `
    SELECT st.*, 
           p.name as portal_name, p.slug as portal_slug,
           c.name as county_name, c.state as county_state
    FROM search_tasks st
    JOIN portals p ON st.portal_id = p.id
    JOIN counties c ON st.county_id = c.id
    WHERE st.user_id = $1
    ORDER BY st.priority DESC, st.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  
  const result = await pool.query(query, [userId, limit, offset]);
  return result.rows;
};

const getSearchTasksByOrganization = async (organizationId, limit = 100, offset = 0) => {
  const query = `
    SELECT st.*, 
           p.name as portal_name, p.slug as portal_slug,
           c.name as county_name, c.state as county_state,
           u.email as user_email, u.first_name, u.last_name
    FROM search_tasks st
    JOIN portals p ON st.portal_id = p.id
    JOIN counties c ON st.county_id = c.id
    JOIN users u ON st.user_id = u.id
    WHERE st.organization_id = $1
    ORDER BY st.priority DESC, st.created_at DESC
    LIMIT $2 OFFSET $3;
  `;
  
  const result = await pool.query(query, [organizationId, limit, offset]);
  return result.rows;
};

const getSearchTasksByStatus = async (userId, status, limit = 50) => {
  const query = `
    SELECT st.*, 
           p.name as portal_name, p.slug as portal_slug,
           c.name as county_name, c.state as county_state
    FROM search_tasks st
    JOIN portals p ON st.portal_id = p.id
    JOIN counties c ON st.county_id = c.id
    WHERE st.user_id = $1 AND st.status = $2
    ORDER BY st.priority DESC, st.created_at DESC
    LIMIT $3;
  `;
  
  const result = await pool.query(query, [userId, status, limit]);
  return result.rows;
};

// ============================================================================
// UPDATE SEARCH TASK
// ============================================================================

const updateSearchTask = async (id, updates) => {
  const allowedFields = [
    'status', 'priority', 'party_name', 'party_role', 
    'date_from', 'date_to', 'legal_description', 'document_reference', 'notes'
  ];
  
  const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
  if (fields.length === 0) {
    return null;
  }
  
  const setClause = fields.map((field, i) => `${field} = $${i + 1}`).join(', ');
  const values = fields.map(field => updates[field]);
  values.push(id);
  
  const query = `
    UPDATE search_tasks
    SET ${setClause}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${fields.length + 1}
    RETURNING *;
  `;
  
  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateSearchTaskStatus = async (id, status) => {
  let query;
  let values;
  
  if (status === 'running') {
    query = `
      UPDATE search_tasks
      SET status = $1, started_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    values = [status, id];
  } else if (status === 'completed') {
    query = `
      UPDATE search_tasks
      SET status = $1, completed_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    values = [status, id];
  } else {
    query = `
      UPDATE search_tasks
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING *;
    `;
    values = [status, id];
  }
  
  const result = await pool.query(query, values);
  return result.rows[0];
};

const updateSearchTaskPriority = async (id, priority) => {
  const query = `
    UPDATE search_tasks
    SET priority = $1, updated_at = CURRENT_TIMESTAMP
    WHERE id = $2
    RETURNING *;
  `;
  
  const result = await pool.query(query, [priority, id]);
  return result.rows[0];
};

// ============================================================================
// DELETE SEARCH TASK
// ============================================================================

const deleteSearchTask = async (id) => {
  const query = 'DELETE FROM search_tasks WHERE id = $1 RETURNING id;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

// ============================================================================
// GET QUEUE STATUS
// ============================================================================

const getQueueStatus = async (userId) => {
  const query = `
    SELECT 
      COUNT(*) FILTER (WHERE status = 'queued') as queued_count,
      COUNT(*) FILTER (WHERE status = 'running') as running_count,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_count,
      COUNT(*) FILTER (WHERE status = 'failed') as failed_count,
      COUNT(*) as total_count
    FROM search_tasks
    WHERE user_id = $1;
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows[0];
};

module.exports = {
  createSearchTask,
  getSearchTaskById,
  getSearchTasksByUser,
  getSearchTasksByOrganization,
  getSearchTasksByStatus,
  updateSearchTask,
  updateSearchTaskStatus,
  updateSearchTaskPriority,
  deleteSearchTask,
  getQueueStatus,
};
