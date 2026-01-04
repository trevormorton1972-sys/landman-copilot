const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/authModels');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRATION = process.env.JWT_EXPIRATION || '7d';

// ============================================================================
// PASSWORD HASHING
// ============================================================================

const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
};

const verifyPassword = async (password, hash) => {
  return bcrypt.compare(password, hash);
};

// ============================================================================
// JWT TOKENS
// ============================================================================

const generateToken = (userId, organizationId) => {
  return jwt.sign(
    { userId, organizationId },
    JWT_SECRET,
    { expiresIn: JWT_EXPIRATION }
  );
};

const verifyToken = (token) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

// ============================================================================
// REGISTRATION
// ============================================================================

const register = async (email, password, firstName, lastName, isIndividual = false) => {
  try {
    // Generate slug from email or name
    const slug = isIndividual 
      ? email.split('@')[0].toLowerCase() + '-' + uuidv4().slice(0, 8)
      : firstName.toLowerCase() + '-' + lastName.toLowerCase() + '-' + uuidv4().slice(0, 8);

    // Create organization
    const orgName = isIndividual ? `${firstName} ${lastName}` : `${firstName} ${lastName}`;
    const organization = await db.createOrganization(orgName, slug, isIndividual);

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const user = await db.createUser(
      organization.id,
      email,
      passwordHash,
      firstName,
      lastName
    );

    // Generate token
    const token = generateToken(user.id, organization.id);

    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        organization: {
          id: organization.id,
          name: organization.name,
          slug: organization.slug,
          isIndividual: organization.is_individual,
        },
      },
      token,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// LOGIN
// ============================================================================

const login = async (email, password) => {
  try {
    // Find user by email
    const user = await db.getUserByEmail(email);
    if (!user) {
      return { success: false, error: 'User not found' };
    }

    // Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      return { success: false, error: 'Invalid password' };
    }

    // Update last login
    await db.updateLastLogin(user.id);

    // Get user with organization
    const userWithOrg = await db.getUserWithOrganization(user.id);

    // Generate token
    const token = generateToken(user.id, user.organization_id);

    return {
      success: true,
      user: {
        id: userWithOrg.id,
        email: userWithOrg.email,
        firstName: userWithOrg.first_name,
        lastName: userWithOrg.last_name,
        organization: {
          id: userWithOrg.organization_id,
          name: userWithOrg.organization_name,
          slug: userWithOrg.organization_slug,
          isIndividual: userWithOrg.is_individual,
        },
      },
      token,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// GET USER PROFILE
// ============================================================================

const getUserProfile = async (userId) => {
  try {
    const userWithOrg = await db.getUserWithOrganization(userId);
    if (!userWithOrg) {
      return { success: false, error: 'User not found' };
    }

    return {
      success: true,
      user: {
        id: userWithOrg.id,
        email: userWithOrg.email,
        firstName: userWithOrg.first_name,
        lastName: userWithOrg.last_name,
        organization: {
          id: userWithOrg.organization_id,
          name: userWithOrg.organization_name,
          slug: userWithOrg.organization_slug,
          isIndividual: userWithOrg.is_individual,
        },
      },
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  generateToken,
  verifyToken,
  register,
  login,
  getUserProfile,
};
