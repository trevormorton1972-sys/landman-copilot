const express = require('express');
const { body, param, validationResult } = require('express-validator');
const portalService = require('../services/portalService');
const { verifyAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ============================================================================
// GET ALL PORTALS (public)
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const result = await portalService.getAllPortals();

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(200).json({
      portals: result.portals,
    });
  } catch (error) {
    console.error('Get portals error:', error);
    res.status(500).json({ error: 'Failed to get portals' });
  }
});

// ============================================================================
// GET PORTALS FOR COUNTY (public)
// ============================================================================

router.get(
  '/county/:countyId',
  [param('countyId').isInt().toInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await portalService.getPortalsForCounty(req.params.countyId);

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(200).json({
        portals: result.portals,
      });
    } catch (error) {
      console.error('Get county portals error:', error);
      res.status(500).json({ error: 'Failed to get portals' });
    }
  }
);

// ============================================================================
// ADD PORTAL CREDENTIAL (requires auth)
// ============================================================================

router.post(
  '/credentials',
  verifyAuth,
  [
    body('portalId').isInt().toInt(),
    body('username').notEmpty().trim(),
    body('password').notEmpty().isLength({ min: 6 }),
    body('credentialLabel').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await portalService.addPortalCredential(
        req.user.userId,
        req.body.portalId,
        req.body.username,
        req.body.password,
        req.body.credentialLabel
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json({
        message: 'Portal credential added',
        credential: result.credential,
      });
    } catch (error) {
      console.error('Add credential error:', error);
      res.status(500).json({ error: 'Failed to add credential' });
    }
  }
);

// ============================================================================
// GET USER'S PORTAL CREDENTIALS (requires auth)
// ============================================================================

router.get('/credentials/list', verifyAuth, async (req, res) => {
  try {
    const result = await portalService.getUserPortalCredentials(req.user.userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(200).json({
      credentials: result.credentials,
    });
  } catch (error) {
    console.error('Get credentials error:', error);
    res.status(500).json({ error: 'Failed to get credentials' });
  }
});

// ============================================================================
// GET SINGLE CREDENTIAL (requires auth)
// ============================================================================

router.get(
  '/credentials/:id',
  verifyAuth,
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await portalService.getPortalCredential(
        req.params.id,
        req.user.userId
      );

      if (!result.success) {
        return res
          .status(result.error === 'Unauthorized' ? 403 : 404)
          .json({ error: result.error });
      }

      res.status(200).json({
        credential: result.credential,
      });
    } catch (error) {
      console.error('Get credential error:', error);
      res.status(500).json({ error: 'Failed to get credential' });
    }
  }
);

// ============================================================================
// UPDATE PORTAL CREDENTIAL (requires auth)
// ============================================================================

router.put(
  '/credentials/:id',
  verifyAuth,
  [
    param('id').isInt().toInt(),
    body('username').notEmpty().trim(),
    body('password').notEmpty().isLength({ min: 6 }),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await portalService.updatePortalCredential(
        req.params.id,
        req.user.userId,
        req.body.username,
        req.body.password
      );

      if (!result.success) {
        return res
          .status(result.error === 'Unauthorized' ? 403 : 400)
          .json({ error: result.error });
      }

      res.status(200).json({
        message: 'Credential updated',
        credential: result.credential,
      });
    } catch (error) {
      console.error('Update credential error:', error);
      res.status(500).json({ error: 'Failed to update credential' });
    }
  }
);

// ============================================================================
// DELETE PORTAL CREDENTIAL (requires auth)
// ============================================================================

router.delete(
  '/credentials/:id',
  verifyAuth,
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await portalService.removePortalCredential(
        req.params.id,
        req.user.userId
      );

      if (!result.success) {
        return res
          .status(result.error === 'Unauthorized' ? 403 : 404)
          .json({ error: result.error });
      }

      res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      console.error('Delete credential error:', error);
      res.status(500).json({ error: 'Failed to delete credential' });
    }
  }
);

// ============================================================================
// GET DECRYPTED CREDENTIAL (for actual use - requires auth)
// ============================================================================

router.get(
  '/credentials/:id/decrypt',
  verifyAuth,
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await portalService.getDecryptedCredential(
        req.params.id,
        req.user.userId
      );

      if (!result.success) {
        return res
          .status(result.error === 'Unauthorized' ? 403 : 404)
          .json({ error: result.error });
      }

      res.status(200).json({
        credential: result.credential,
      });
    } catch (error) {
      console.error('Decrypt credential error:', error);
      res.status(500).json({ error: 'Failed to decrypt credential' });
    }
  }
);

module.exports = router;
