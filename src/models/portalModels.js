const pool = require('../config/database');

// ============================================================================
// PORTALS
// ============================================================================

const getPortalById = async (id) => {
  const query = 'SELECT * FROM portals WHERE id = $1;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const getPortalBySlug = async (slug) => {
  const query = 'SELECT * FROM portals WHERE slug = $1;';
  const result = await pool.query(query, [slug]);
  return result.rows[0];
};

const getAllPortals = async () => {
  const query = 'SELECT * FROM portals WHERE is_active = true ORDER BY name;';
  const result = await pool.query(query);
  return result.rows;
};

const getPortalsForCounty = async (countyId) => {
  const query = `
    SELECT p.* FROM portals p
    JOIN portal_county_coverage pcc ON p.id = pcc.portal_id
    WHERE pcc.county_id = $1 AND p.is_active = true
    ORDER BY p.name;
  `;
  const result = await pool.query(query, [countyId]);
  return result.rows;
};

// ============================================================================
// PORTAL CREDENTIALS
// ============================================================================

const createPortalCredential = async (
  userId,
  portalId,
  username,
  encryptedPassword,
  credentialLabel = null
) => {
  const query = `
    INSERT INTO portal_credentials (
      user_id, portal_id, username, encrypted_password, credential_label
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, user_id, portal_id, username, credential_label, created_at, is_active;
  `;
  
  const result = await pool.query(query, [
    userId,
    portalId,
    username,
    encryptedPassword,
    credentialLabel,
  ]);
  
  return result.rows[0];
};

const getPortalCredentialById = async (id) => {
  const query = `
    SELECT id, user_id, portal_id, username, credential_label, created_at, is_active
    FROM portal_credentials
    WHERE id = $1;
  `;
  
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const getPortalCredentialWithPassword = async (id) => {
  const query = `
    SELECT id, user_id, portal_id, username, encrypted_password, credential_label, created_at, is_active
    FROM portal_credentials
    WHERE id = $1;
  `;
  
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const getUserPortalCredentials = async (userId) => {
  const query = `
    SELECT 
      pc.id, pc.user_id, pc.portal_id, pc.username, pc.credential_label, pc.created_at, pc.is_active,
      p.name as portal_name, p.slug as portal_slug, p.auth_type
    FROM portal_credentials pc
    JOIN portals p ON pc.portal_id = p.id
    WHERE pc.user_id = $1 AND pc.is_active = true
    ORDER BY p.name;
  `;
  
  const result = await pool.query(query, [userId]);
  return result.rows;
};

const getUserPortalCredential = async (userId, portalId) => {
  const query = `
    SELECT 
      pc.id, pc.user_id, pc.portal_id, pc.username, pc.credential_label, pc.created_at, pc.is_active,
      p.name as portal_name, p.slug as portal_slug
    FROM portal_credentials pc
    JOIN portals p ON pc.portal_id = p.id
    WHERE pc.user_id = $1 AND pc.portal_id = $2 AND pc.is_active = true;
  `;
  
  const result = await pool.query(query, [userId, portalId]);
  return result.rows[0];
};

const updatePortalCredential = async (id, username, encryptedPassword) => {
  const query = `
    UPDATE portal_credentials
    SET username = $1, encrypted_password = $2, updated_at = CURRENT_TIMESTAMP
    WHERE id = $3
    RETURNING id, user_id, portal_id, username, credential_label, created_at, is_active;
  `;
  
  const result = await pool.query(query, [username, encryptedPassword, id]);
  return result.rows[0];
};

const deletePortalCredential = async (id) => {
  const query = `
    UPDATE portal_credentials
    SET is_active = false
    WHERE id = $1
    RETURNING id;
  `;
  
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const deletePortalCredentialPermanent = async (id) => {
  const query = 'DELETE FROM portal_credentials WHERE id = $1 RETURNING id;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

module.exports = {
  // Portals
  getPortalById,
  getPortalBySlug,
  getAllPortals,
  getPortalsForCounty,
  
  // Portal Credentials
  createPortalCredential,
  getPortalCredentialById,
  getPortalCredentialWithPassword,
  getUserPortalCredentials,
  getUserPortalCredential,
  updatePortalCredential,
  deletePortalCredential,
  deletePortalCredentialPermanent,
};
