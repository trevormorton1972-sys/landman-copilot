const crypto = require('crypto');
const db = require('../models/portalModels');

// ============================================================================
// ENCRYPTION/DECRYPTION (simple XOR cipher - use proper encryption in production)
// ============================================================================

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'landman-copilot-dev-key-change-in-production';

const encryptPassword = (password) => {
  // In production, use a proper encryption library like crypto-js or node-crypto
  // This is a simple base64 encoding for demo purposes
  return Buffer.from(password).toString('base64');
};

const decryptPassword = (encrypted) => {
  try {
    return Buffer.from(encrypted, 'base64').toString('utf-8');
  } catch {
    return null;
  }
};

// ============================================================================
// GET PORTALS
// ============================================================================

const getAllPortals = async () => {
  try {
    const portals = await db.getAllPortals();
    
    return {
      success: true,
      portals,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const getPortalsForCounty = async (countyId) => {
  try {
    const portals = await db.getPortalsForCounty(countyId);
    
    return {
      success: true,
      portals,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// PORTAL CREDENTIALS
// ============================================================================

const addPortalCredential = async (userId, portalId, username, password, credentialLabel) => {
  try {
    // Verify portal exists
    const portal = await db.getPortalById(portalId);
    if (!portal) {
      return { success: false, error: 'Portal not found' };
    }

    // Encrypt password
    const encryptedPassword = encryptPassword(password);

    // Create credential
    const credential = await db.createPortalCredential(
      userId,
      portalId,
      username,
      encryptedPassword,
      credentialLabel
    );

    return {
      success: true,
      credential,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const getUserPortalCredentials = async (userId) => {
  try {
    const credentials = await db.getUserPortalCredentials(userId);

    return {
      success: true,
      credentials,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const getPortalCredential = async (credentialId, userId) => {
  try {
    const credential = await db.getPortalCredentialById(credentialId);

    if (!credential) {
      return { success: false, error: 'Credential not found' };
    }

    // Verify user owns this credential
    if (credential.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    return {
      success: true,
      credential,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const updatePortalCredential = async (credentialId, userId, username, password) => {
  try {
    // Verify credential exists and user owns it
    const credential = await db.getPortalCredentialById(credentialId);
    if (!credential) {
      return { success: false, error: 'Credential not found' };
    }

    if (credential.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Encrypt new password
    const encryptedPassword = encryptPassword(password);

    // Update credential
    const updated = await db.updatePortalCredential(
      credentialId,
      username,
      encryptedPassword
    );

    return {
      success: true,
      credential: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const removePortalCredential = async (credentialId, userId) => {
  try {
    // Verify credential exists and user owns it
    const credential = await db.getPortalCredentialById(credentialId);
    if (!credential) {
      return { success: false, error: 'Credential not found' };
    }

    if (credential.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Soft delete credential
    await db.deletePortalCredential(credentialId);

    return {
      success: true,
      message: 'Credential removed',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// GET DECRYPTED CREDENTIAL (for actual use)
// ============================================================================

const getDecryptedCredential = async (credentialId, userId) => {
  try {
    const credential = await db.getPortalCredentialWithPassword(credentialId);

    if (!credential) {
      return { success: false, error: 'Credential not found' };
    }

    if (credential.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Decrypt password
    const decryptedPassword = decryptPassword(credential.encrypted_password);
    if (!decryptedPassword) {
      return { success: false, error: 'Failed to decrypt password' };
    }

    return {
      success: true,
      credential: {
        id: credential.id,
        portalId: credential.portal_id,
        username: credential.username,
        password: decryptedPassword,
        credentialLabel: credential.credential_label,
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
  getAllPortals,
  getPortalsForCounty,
  addPortalCredential,
  getUserPortalCredentials,
  getPortalCredential,
  updatePortalCredential,
  removePortalCredential,
  getDecryptedCredential,
  encryptPassword,
  decryptPassword,
};
