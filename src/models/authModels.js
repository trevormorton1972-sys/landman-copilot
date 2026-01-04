const pool = require('../config/database');

// ============================================================================
// ORGANIZATIONS
// ============================================================================

const createOrganization = async (name, slug, isIndividual = false) => {
  const query = `
    INSERT INTO organizations (name, slug, is_individual)
    VALUES ($1, $2, $3)
    RETURNING *;
  `;
  const result = await pool.query(query, [name, slug, isIndividual]);
  return result.rows[0];
};

const getOrganizationById = async (id) => {
  const query = 'SELECT * FROM organizations WHERE id = $1;';
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const getOrganizationBySlug = async (slug) => {
  const query = 'SELECT * FROM organizations WHERE slug = $1;';
  const result = await pool.query(query, [slug]);
  return result.rows[0];
};

// ============================================================================
// USERS
// ============================================================================

const createUser = async (organizationId, email, passwordHash, firstName, lastName) => {
  const query = `
    INSERT INTO users (organization_id, email, password_hash, first_name, last_name)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, organization_id, email, first_name, last_name, created_at, is_active;
  `;
  const result = await pool.query(query, [organizationId, email, passwordHash, firstName, lastName]);
  return result.rows[0];
};

const getUserById = async (id) => {
  const query = `
    SELECT id, organization_id, email, first_name, last_name, created_at, is_active, last_login
    FROM users
    WHERE id = $1;
  `;
  const result = await pool.query(query, [id]);
  return result.rows[0];
};

const getUserByEmail = async (email) => {
  const query = `
    SELECT id, organization_id, email, password_hash, first_name, last_name, created_at, is_active, last_login
    FROM users
    WHERE email = $1;
  `;
  const result = await pool.query(query, [email]);
  return result.rows[0];
};

const getUserWithOrganization = async (userId) => {
  const query = `
    SELECT 
      u.id, u.organization_id, u.email, u.first_name, u.last_name, u.created_at, u.is_active,
      o.name as organization_name, o.slug as organization_slug, o.is_individual
    FROM users u
    JOIN organizations o ON u.organization_id = o.id
    WHERE u.id = $1;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0];
};

const updateLastLogin = async (userId) => {
  const query = `
    UPDATE users
    SET last_login = CURRENT_TIMESTAMP
    WHERE id = $1
    RETURNING id, last_login;
  `;
  const result = await pool.query(query, [userId]);
  return result.rows[0];
};

const getUsersByOrganization = async (organizationId) => {
  const query = `
    SELECT id, organization_id, email, first_name, last_name, created_at, is_active
    FROM users
    WHERE organization_id = $1
    ORDER BY created_at DESC;
  `;
  const result = await pool.query(query, [organizationId]);
  return result.rows;
};

module.exports = {
  // Organizations
  createOrganization,
  getOrganizationById,
  getOrganizationBySlug,
  
  // Users
  createUser,
  getUserById,
  getUserByEmail,
  getUserWithOrganization,
  updateLastLogin,
  getUsersByOrganization,
};
