const db = require('../models/searchTaskModels');

// ============================================================================
// CREATE NEW SEARCH TASK
// ============================================================================

const createTask = async (userId, organizationId, taskData) => {
  try {
    const {
      portalId,
      countyId,
      partyName,
      partyRole = 'both',
      dateFrom,
      dateTo,
      legalDescription,
      documentReference,
      priority = 5,
      notes = '',
    } = taskData;

    // Validate required fields
    if (!portalId || !countyId || !partyName || !dateFrom || !dateTo) {
      return {
        success: false,
        error: 'Missing required fields: portalId, countyId, partyName, dateFrom, dateTo',
      };
    }

    // Validate priority is 1-10
    if (priority < 1 || priority > 10) {
      return {
        success: false,
        error: 'Priority must be between 1 and 10',
      };
    }

    // Create the task
    const task = await db.createSearchTask(
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
      priority,
      notes
    );

    return {
      success: true,
      task,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// GET TASKS
// ============================================================================

const getUserTasks = async (userId, page = 1, limit = 50) => {
  try {
    const offset = (page - 1) * limit;
    const tasks = await db.getSearchTasksByUser(userId, limit, offset);

    return {
      success: true,
      tasks,
      page,
      limit,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const getTaskById = async (taskId, userId) => {
  try {
    const task = await db.getSearchTaskById(taskId);

    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Verify user owns this task
    if (task.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    return {
      success: true,
      task,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// UPDATE TASKS
// ============================================================================

const updateTask = async (taskId, userId, updates) => {
  try {
    // Verify user owns this task
    const task = await db.getSearchTaskById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Can't update completed or failed tasks
    if (task.status === 'completed' || task.status === 'failed') {
      return {
        success: false,
        error: `Cannot update ${task.status} task`,
      };
    }

    const updated = await db.updateSearchTask(taskId, updates);

    return {
      success: true,
      task: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const updateTaskStatus = async (taskId, userId, status) => {
  try {
    // Verify user owns this task
    const task = await db.getSearchTaskById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate status transition
    const validStatuses = ['queued', 'running', 'completed', 'paused', 'failed'];
    if (!validStatuses.includes(status)) {
      return { success: false, error: 'Invalid status' };
    }

    const updated = await db.updateSearchTaskStatus(taskId, status);

    return {
      success: true,
      task: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

const updateTaskPriority = async (taskId, userId, priority) => {
  try {
    // Verify user owns this task
    const task = await db.getSearchTaskById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Validate priority
    if (priority < 1 || priority > 10) {
      return { success: false, error: 'Priority must be between 1 and 10' };
    }

    const updated = await db.updateSearchTaskPriority(taskId, priority);

    return {
      success: true,
      task: updated,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// DELETE TASK
// ============================================================================

const deleteTask = async (taskId, userId) => {
  try {
    // Verify user owns this task
    const task = await db.getSearchTaskById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    if (task.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Can only delete queued tasks
    if (task.status !== 'queued') {
      return {
        success: false,
        error: `Can only delete queued tasks. This task is ${task.status}`,
      };
    }

    await db.deleteSearchTask(taskId);

    return {
      success: true,
      message: 'Task deleted',
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// GET QUEUE STATUS
// ============================================================================

const getQueueStats = async (userId) => {
  try {
    const stats = await db.getQueueStatus(userId);

    return {
      success: true,
      stats: {
        queuedCount: parseInt(stats.queued_count || 0),
        runningCount: parseInt(stats.running_count || 0),
        completedCount: parseInt(stats.completed_count || 0),
        failedCount: parseInt(stats.failed_count || 0),
        totalCount: parseInt(stats.total_count || 0),
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
  createTask,
  getUserTasks,
  getTaskById,
  updateTask,
  updateTaskStatus,
  updateTaskPriority,
  deleteTask,
  getQueueStats,
};
