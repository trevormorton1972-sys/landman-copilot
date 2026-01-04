const express = require('express');
const { body, validationResult } = require('express-validator');
const authService = require('../services/authService');
const { verifyAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// ============================================================================
// REGISTER ENDPOINT
// ============================================================================

router.post(
  '/register',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
    body('firstName').notEmpty().trim().escape(),
    body('lastName').notEmpty().trim().escape(),
    body('isIndividual').optional().isBoolean(),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password, firstName, lastName, isIndividual } = req.body;

      // Register user
      const result = await authService.register(
        email,
        password,
        firstName,
        lastName,
        isIndividual || false
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json({
        message: 'User registered successfully',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      console.error('Register error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  }
);

// ============================================================================
// LOGIN ENDPOINT
// ============================================================================

router.post(
  '/login',
  [
    body('email').isEmail().normalizeEmail(),
    body('password').notEmpty(),
  ],
  async (req, res) => {
    try {
      // Validate input
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { email, password } = req.body;

      // Login user
      const result = await authService.login(email, password);

      if (!result.success) {
        return res.status(401).json({ error: result.error });
      }

      res.status(200).json({
        message: 'Login successful',
        user: result.user,
        token: result.token,
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  }
);

// ============================================================================
// GET CURRENT USER PROFILE
// ============================================================================

router.get('/me', verifyAuth, async (req, res) => {
  try {
    const result = await authService.getUserProfile(req.user.userId);

    if (!result.success) {
      return res.status(404).json({ error: result.error });
    }

    res.status(200).json({
      user: result.user,
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({ error: 'Failed to get profile' });
  }
});

// ============================================================================
// VERIFY TOKEN ENDPOINT
// ============================================================================

router.post('/verify', verifyAuth, (req, res) => {
  res.status(200).json({
    message: 'Token is valid',
    user: req.user,
  });
});

module.exports = router;
