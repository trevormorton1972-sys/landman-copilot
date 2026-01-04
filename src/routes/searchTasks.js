const express = require('express');
const { body, param, validationResult } = require('express-validator');
const searchTaskService = require('../services/searchTaskService');
const { verifyAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// All routes require authentication
router.use(verifyAuth);

// ============================================================================
// CREATE SEARCH TASK
// ============================================================================

router.post(
  '/',
  [
    body('portalId').isInt().toInt(),
    body('countyId').isInt().toInt(),
    body('partyName').notEmpty().trim().escape(),
    body('partyRole').isIn(['grantor', 'grantee', 'both']),
    body('dateFrom').isISO8601(),
    body('dateTo').isISO8601(),
    body('legalDescription').optional().trim(),
    body('documentReference').optional().trim(),
    body('priority').optional().isInt({ min: 1, max: 10 }).toInt(),
    body('notes').optional().trim(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await searchTaskService.createTask(
        req.user.userId,
        req.user.organizationId,
        req.body
      );

      if (!result.success) {
        return res.status(400).json({ error: result.error });
      }

      res.status(201).json({
        message: 'Search task created',
        task: result.task,
      });
    } catch (error) {
      console.error('Create task error:', error);
      res.status(500).json({ error: 'Failed to create task' });
    }
  }
);

// ============================================================================
// LIST USER'S SEARCH TASKS
// ============================================================================

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 50, 100);

    const result = await searchTaskService.getUserTasks(
      req.user.userId,
      page,
      limit
    );

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(200).json({
      tasks: result.tasks,
      pagination: {
        page: result.page,
        limit: result.limit,
        totalReturned: result.tasks.length,
      },
    });
  } catch (error) {
    console.error('List tasks error:', error);
    res.status(500).json({ error: 'Failed to list tasks' });
  }
});

// ============================================================================
// GET SINGLE SEARCH TASK
// ============================================================================

router.get(
  '/:id',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await searchTaskService.getTaskById(
        req.params.id,
        req.user.userId
      );

      if (!result.success) {
        return res.status(result.error === 'Unauthorized' ? 403 : 404).json({
          error: result.error,
        });
      }

      res.status(200).json({
        task: result.task,
      });
    } catch (error) {
      console.error('Get task error:', error);
      res.status(500).json({ error: 'Failed to get task' });
    }
  }
);

// ============================================================================
// UPDATE SEARCH TASK
// ============================================================================

router.put(
  '/:id',
  [
    param('id').isInt().toInt(),
    body('partyName').optional().trim().escape(),
    body('partyRole').optional().isIn(['grantor', 'grantee', 'both']),
    body('dateFrom').optional().isISO8601(),
    body('dateTo').optional().isISO8601(),
    body('legalDescription').optional().trim(),
    body('documentReference').optional().trim(),
    body('priority').optional().isInt({ min: 1, max: 10 }).toInt(),
    body('notes').optional().trim(),
    body('status').optional().isIn(['queued', 'running', 'completed', 'paused', 'failed']),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Separate status from other updates
      const { status, ...updates } = req.body;

      let result;
      if (status) {
        result = await searchTaskService.updateTaskStatus(
          req.params.id,
          req.user.userId,
          status
        );
      } else {
        result = await searchTaskService.updateTask(
          req.params.id,
          req.user.userId,
          updates
        );
      }

      if (!result.success) {
        return res.status(result.error === 'Unauthorized' ? 403 : 400).json({
          error: result.error,
        });
      }

      res.status(200).json({
        message: 'Task updated',
        task: result.task,
      });
    } catch (error) {
      console.error('Update task error:', error);
      res.status(500).json({ error: 'Failed to update task' });
    }
  }
);

// ============================================================================
// UPDATE TASK PRIORITY
// ============================================================================

router.patch(
  '/:id/priority',
  [
    param('id').isInt().toInt(),
    body('priority').isInt({ min: 1, max: 10 }).toInt(),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await searchTaskService.updateTaskPriority(
        req.params.id,
        req.user.userId,
        req.body.priority
      );

      if (!result.success) {
        return res.status(result.error === 'Unauthorized' ? 403 : 400).json({
          error: result.error,
        });
      }

      res.status(200).json({
        message: 'Priority updated',
        task: result.task,
      });
    } catch (error) {
      console.error('Update priority error:', error);
      res.status(500).json({ error: 'Failed to update priority' });
    }
  }
);

// ============================================================================
// DELETE SEARCH TASK
// ============================================================================

router.delete(
  '/:id',
  [param('id').isInt().toInt()],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const result = await searchTaskService.deleteTask(
        req.params.id,
        req.user.userId
      );

      if (!result.success) {
        return res.status(result.error === 'Unauthorized' ? 403 : 400).json({
          error: result.error,
        });
      }

      res.status(200).json({
        message: result.message,
      });
    } catch (error) {
      console.error('Delete task error:', error);
      res.status(500).json({ error: 'Failed to delete task' });
    }
  }
);

// ============================================================================
// GET QUEUE STATS
// ============================================================================

router.get('/stats/queue', async (req, res) => {
  try {
    const result = await searchTaskService.getQueueStats(req.user.userId);

    if (!result.success) {
      return res.status(400).json({ error: result.error });
    }

    res.status(200).json({
      stats: result.stats,
    });
  } catch (error) {
    console.error('Get queue stats error:', error);
    res.status(500).json({ error: 'Failed to get queue stats' });
  }
});

module.exports = router;
