const IDOCMarketAdapter = require('../adapters/idocmarketAdapter');
const portalService = require('./portalService');
const db = require('../models/searchTaskModels');
const searchResultsDb = require('../models/searchResultsModels');

// ============================================================================
// EXECUTE SEARCH TASK
// ============================================================================

const executeSearchTask = async (taskId, userId) => {
  try {
    // Get the search task
    const task = await db.getSearchTaskById(taskId);
    if (!task) {
      return { success: false, error: 'Task not found' };
    }

    // Verify user owns this task
    if (task.user_id !== userId) {
      return { success: false, error: 'Unauthorized' };
    }

    // Get portal credentials
    const credentialResult = await portalService.getDecryptedCredential(
      task.portal_id,
      userId
    );
    if (!credentialResult.success) {
      return {
        success: false,
        error: 'Portal credentials not found',
      };
    }

    const { username, password } = credentialResult.credential;

    // Update task status to running
    await db.updateSearchTaskStatus(taskId, 'running');

    // Build search parameters
    const searchParams = {
      partyName: task.party_name,
      partyRole: task.party_role,
      dateFrom: formatDate(task.date_from),
      dateTo: formatDate(task.date_to),
      countyCode: task.county_id,
      legalDescription: task.legal_description,
    };

    console.log(`[SearchTask ${taskId}] Starting search for ${task.party_name}`);

    // Execute search using IDOCMarket adapter
    const adapter = new IDOCMarketAdapter({
      headless: true,
      timeout: 30000,
    });

    const searchResult = await adapter.executeSearch(
      username,
      password,
      searchParams
    );

    if (!searchResult.success) {
      // Update task to failed
      await db.updateSearchTaskStatus(taskId, 'failed');
      return {
        success: false,
        error: searchResult.error,
      };
    }

    // Store search results in database
    const storedResults = [];
    for (const doc of searchResult.results) {
      const stored = await searchResultsDb.createSearchResult({
        searchTaskId: taskId,
        documentNumber: doc.documentNumber,
        recordingDate: doc.recordingDate,
        grantor: doc.grantor,
        grantee: doc.grantee,
        documentType: doc.documentType,
        pageCount: doc.pageCount,
        portalUrl: doc.link,
      });

      if (stored) {
        storedResults.push(stored);
      }
    }

    // Update task to completed
    await db.updateSearchTaskStatus(taskId, 'completed');

    console.log(
      `[SearchTask ${taskId}] Completed - Found ${storedResults.length} documents`
    );

    return {
      success: true,
      taskId,
      resultsCount: storedResults.length,
      results: storedResults,
    };
  } catch (error) {
    console.error(`[SearchTask ${taskId}] Error:`, error.message);

    // Update task to failed
    try {
      await db.updateSearchTaskStatus(taskId, 'failed');
    } catch (e) {
      // Ignore if we can't update
    }

    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// PROCESS SEARCH QUEUE
// ============================================================================

const processSearchQueue = async (userId, limit = 5) => {
  try {
    console.log(`[SearchQueue] Processing queue for user ${userId}`);

    // Get queued tasks ordered by priority
    const queuedTasks = await db.getSearchTasksByStatus(userId, 'queued', limit);

    if (queuedTasks.length === 0) {
      return {
        success: true,
        processed: 0,
        results: [],
      };
    }

    const results = [];

    for (const task of queuedTasks) {
      console.log(`[SearchQueue] Processing task ${task.id}`);

      const result = await executeSearchTask(task.id, userId);
      results.push({
        taskId: task.id,
        ...result,
      });

      // Add small delay between tasks
      await new Promise((resolve) => setTimeout(resolve, 2000));
    }

    console.log(`[SearchQueue] Processed ${results.length} tasks`);

    return {
      success: true,
      processed: results.length,
      results,
    };
  } catch (error) {
    console.error('[SearchQueue] Error:', error.message);
    return {
      success: false,
      error: error.message,
      processed: 0,
      results: [],
    };
  }
};

// ============================================================================
// TEST IDOCMARKET CONNECTIVITY
// ============================================================================

const testConnection = async (username, password) => {
  try {
    console.log('[IDOCMarket] Testing connection');

    const adapter = new IDOCMarketAdapter({
      headless: true,
      timeout: 15000,
    });

    const initialized = await adapter.initialize();
    if (!initialized) {
      return { success: false, error: 'Failed to initialize browser' };
    }

    const loginResult = await adapter.login(username, password);

    await adapter.close();

    return loginResult;
  } catch (error) {
    console.error('[IDOCMarket] Connection test error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') return date;
  return new Date(date).toISOString().split('T')[0];
};

module.exports = {
  executeSearchTask,
  processSearchQueue,
  testConnection,
};
