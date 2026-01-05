const searchResultsDb = require('../models/searchResultsModels');
const searchTaskDb = require('../models/searchTaskModels');
const documentReviewDb = require('../models/documentReviewModels');
const aiService = require('./aiService');
const { parse } = require('csv-parse/sync');

// ============================================================================
// UPLOAD SEARCH RESULTS (Parse CSV/JSON)
// ============================================================================

const uploadSearchResults = async (taskId, userId, file) => {
  try {
    // Verify user owns this task
    const task = await searchTaskDb.getSearchTaskById(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    if (task.user_id !== userId) return { success: false, error: 'Unauthorized' };

    let documents = [];
    const content = file.buffer.toString('utf-8');

    if (file.mimetype === 'application/json') {
      const parsed = JSON.parse(content);
      documents = Array.isArray(parsed) ? parsed : parsed.documents || parsed.results || [];
    } else if (file.mimetype === 'text/csv') {
      const records = parse(content, { columns: true, skip_empty_lines: true });
      documents = records.map(row => ({
        documentNumber: row.document_number || row.documentNumber || row['Document Number'] || row.doc_num,
        recordingDate: row.recording_date || row.recordingDate || row['Recording Date'] || row.date,
        grantor: row.grantor || row.Grantor || row.seller,
        grantee: row.grantee || row.Grantee || row.buyer,
        documentType: row.document_type || row.documentType || row['Document Type'] || row.type,
        legalDescription: row.legal_description || row.legalDescription || row['Legal Description'],
        pageCount: parseInt(row.page_count || row.pageCount || row['Page Count'] || '1'),
        portalUrl: row.portal_url || row.portalUrl || row.url || row.link,
      }));
    } else {
      return { success: false, error: 'Unsupported file type' };
    }

    // Store each document
    const storedDocs = [];
    for (const doc of documents) {
      if (!doc.documentNumber) continue;
      const stored = await searchResultsDb.createSearchResult({
        searchTaskId: taskId,
        ...doc,
      });
      if (stored) storedDocs.push(stored);
    }

    return {
      success: true,
      documentsCreated: storedDocs.length,
      documents: storedDocs,
    };
  } catch (error) {
    console.error('Upload service error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// SUBMIT MANUAL RESULTS (Paste/form entry)
// ============================================================================

const submitManualResults = async (taskId, userId, documents) => {
  try {
    const task = await searchTaskDb.getSearchTaskById(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    if (task.user_id !== userId) return { success: false, error: 'Unauthorized' };

    const storedDocs = [];
    for (const doc of documents) {
      if (!doc.documentNumber) continue;
      const stored = await searchResultsDb.createSearchResult({
        searchTaskId: taskId,
        documentNumber: doc.documentNumber,
        recordingDate: doc.recordingDate,
        grantor: doc.grantor,
        grantee: doc.grantee,
        documentType: doc.documentType,
        legalDescription: doc.legalDescription,
        pageCount: doc.pageCount || 1,
        portalUrl: doc.portalUrl,
      });
      if (stored) storedDocs.push(stored);
    }

    return {
      success: true,
      documentsCreated: storedDocs.length,
      documents: storedDocs,
    };
  } catch (error) {
    console.error('Submit manual error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// GET TASK RESULTS
// ============================================================================

const getTaskResults = async (taskId, userId, status = null) => {
  try {
    const task = await searchTaskDb.getSearchTaskById(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    if (task.user_id !== userId) return { success: false, error: 'Unauthorized' };

    let documents;
    if (status) {
      documents = await searchResultsDb.getSearchResultsByStatus(taskId, status);
    } else {
      documents = await searchResultsDb.getSearchResults(taskId);
    }

    return { success: true, documents };
  } catch (error) {
    console.error('Get results error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// ANALYZE DOCUMENTS WITH AI
// ============================================================================

const analyzeDocuments = async (userId, documentIds, searchCriteria) => {
  try {
    // Create reviews for each document and queue for AI analysis
    const reviews = [];
    for (const docId of documentIds) {
      const result = await searchResultsDb.getSearchResultById(docId);
      if (!result) continue;

      // Create document review record
      const review = await documentReviewDb.createDocumentReview({
        searchResultId: docId,
        userId: userId,
        aiAssessment: 'pending',
      });

      if (review) {
        reviews.push(review);

        // Queue AI analysis (async)
        processAIAnalysis(review.id, result, searchCriteria).catch(err => {
          console.error('AI analysis error for review', review.id, err);
        });
      }
    }

    return {
      success: true,
      analysisId: Date.now(),
      documentsQueued: reviews.length,
    };
  } catch (error) {
    console.error('Analyze documents error:', error);
    return { success: false, error: error.message };
  }
};

// Process AI analysis for a single document
const processAIAnalysis = async (reviewId, document, searchCriteria) => {
  try {
    console.log(`[AI] Analyzing document ${document.document_number}`);

    // Build analysis prompt
    const analysisResult = await aiService.analyzeDocument(document, searchCriteria);

    // Update review with AI results
    await documentReviewDb.updateAIAnalysis(reviewId, {
      aiAssessment: analysisResult.assessment,
      aiConfidence: analysisResult.confidence,
      aiEvidence: analysisResult.evidence,
      aiRelevantPages: analysisResult.relevantPages,
      aiQuotes: analysisResult.quotes,
    });

    console.log(`[AI] Analysis complete for ${document.document_number}: ${analysisResult.assessment}`);
  } catch (error) {
    console.error('[AI] Analysis failed:', error);
    await documentReviewDb.updateAIAnalysis(reviewId, {
      aiAssessment: 'pending',
      aiEvidence: `Analysis failed: ${error.message}`,
    });
  }
};

// ============================================================================
// GET ANALYSIS RESULTS
// ============================================================================

const getAnalysisResults = async (taskId, userId) => {
  try {
    const task = await searchTaskDb.getSearchTaskById(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    if (task.user_id !== userId) return { success: false, error: 'Unauthorized' };

    const reviews = await documentReviewDb.getReviewsByTask(taskId);
    const total = reviews.length;
    const analyzed = reviews.filter(r => r.ai_assessment !== 'pending').length;

    return {
      success: true,
      analysisComplete: analyzed === total && total > 0,
      totalDocuments: total,
      analyzedCount: analyzed,
      results: reviews.map(r => ({
        reviewId: r.id,
        documentNumber: r.document_number,
        documentType: r.document_type,
        recordingDate: r.recording_date,
        grantor: r.grantor,
        grantee: r.grantee,
        aiAssessment: r.ai_assessment,
        aiConfidence: r.ai_confidence,
        aiEvidence: r.ai_evidence,
        aiQuotes: r.ai_quotes,
        userDecision: r.user_decision,
        markedForDownload: r.marked_for_download,
      })),
    };
  } catch (error) {
    console.error('Get analysis error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// UPDATE USER DECISION
// ============================================================================

const updateUserDecision = async (reviewId, userId, decision, notes, markForDownload) => {
  try {
    const review = await documentReviewDb.getReviewById(reviewId);
    if (!review) return { success: false, error: 'Review not found' };
    if (review.user_id !== userId) return { success: false, error: 'Unauthorized' };

    const updated = await documentReviewDb.updateUserDecision(reviewId, {
      userDecision: decision,
      userNotes: notes,
      userConfirmed: true,
      markedForDownload: markForDownload || decision === 'approved',
    });

    return { success: true, review: updated };
  } catch (error) {
    console.error('Update decision error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// MARK FOR DOWNLOAD
// ============================================================================

const markForDownload = async (userId, reviewIds) => {
  try {
    let markedCount = 0;
    for (const reviewId of reviewIds) {
      const review = await documentReviewDb.getReviewById(reviewId);
      if (!review || review.user_id !== userId) continue;

      await documentReviewDb.markForDownload(reviewId, true);
      markedCount++;
    }

    return { success: true, markedCount };
  } catch (error) {
    console.error('Mark download error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// EXECUTE DOWNLOADS
// ============================================================================

const executeDownloads = async (taskId, userId) => {
  try {
    const task = await searchTaskDb.getSearchTaskById(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    if (task.user_id !== userId) return { success: false, error: 'Unauthorized' };

    // Get all reviews marked for download
    const reviews = await documentReviewDb.getMarkedForDownload(taskId);

    if (reviews.length === 0) {
      return { success: false, error: 'No documents marked for download' };
    }

    // Queue downloads (would integrate with Browserless)
    const downloadId = Date.now();
    console.log(`[Download] Starting download job ${downloadId} for ${reviews.length} documents`);

    // Start async download process
    processDownloads(downloadId, reviews, task).catch(err => {
      console.error('Download process error:', err);
    });

    return {
      success: true,
      downloadId,
      documentsToDownload: reviews.length,
    };
  } catch (error) {
    console.error('Execute downloads error:', error);
    return { success: false, error: error.message };
  }
};

// Process downloads asynchronously
const processDownloads = async (downloadId, reviews, task) => {
  console.log(`[Download ${downloadId}] Processing ${reviews.length} documents`);

  for (const review of reviews) {
    try {
      // This would integrate with Browserless to download the actual PDF
      console.log(`[Download ${downloadId}] Downloading ${review.document_number}`);

      // TODO: Implement actual Browserless download
      // const downloaded = await browserlessService.downloadDocument(review.portal_url);

      // For now, mark as downloaded
      await documentReviewDb.markAsDownloaded(review.id);

      // Add small delay between downloads
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`[Download ${downloadId}] Failed for ${review.document_number}:`, error);
    }
  }

  console.log(`[Download ${downloadId}] Complete`);
};

// ============================================================================
// GET DOWNLOAD STATUS
// ============================================================================

const getDownloadStatus = async (taskId, userId) => {
  try {
    const task = await searchTaskDb.getSearchTaskById(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    if (task.user_id !== userId) return { success: false, error: 'Unauthorized' };

    const marked = await documentReviewDb.getMarkedForDownload(taskId);
    const downloaded = marked.filter(r => r.downloaded_at !== null);

    return {
      success: true,
      status: downloaded.length === marked.length ? 'complete' : 'in_progress',
      downloadedCount: downloaded.length,
      totalMarked: marked.length,
      downloads: marked.map(r => ({
        reviewId: r.id,
        documentNumber: r.document_number,
        downloaded: r.downloaded_at !== null,
        downloadedAt: r.downloaded_at,
      })),
    };
  } catch (error) {
    console.error('Download status error:', error);
    return { success: false, error: error.message };
  }
};

// ============================================================================
// GET DOWNLOADED DOCUMENTS
// ============================================================================

const getDownloadedDocuments = async (taskId, userId) => {
  try {
    const task = await searchTaskDb.getSearchTaskById(taskId);
    if (!task) return { success: false, error: 'Task not found' };
    if (task.user_id !== userId) return { success: false, error: 'Unauthorized' };

    const downloads = await documentReviewDb.getDownloadedByTask(taskId);

    return {
      success: true,
      documents: downloads.map(d => ({
        reviewId: d.id,
        documentNumber: d.document_number,
        documentType: d.document_type,
        recordingDate: d.recording_date,
        grantor: d.grantor,
        grantee: d.grantee,
        filePath: d.file_path,
        downloadedAt: d.downloaded_at,
      })),
    };
  } catch (error) {
    console.error('Get downloaded error:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  uploadSearchResults,
  submitManualResults,
  getTaskResults,
  analyzeDocuments,
  getAnalysisResults,
  updateUserDecision,
  markForDownload,
  executeDownloads,
  getDownloadStatus,
  getDownloadedDocuments,
};
