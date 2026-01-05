const express = require('express');
const { body, param, query, validationResult } = require('express-validator');
const multer = require('multer');
const { verifyAuth } = require('../middleware/authMiddleware');
const documentService = require('../services/documentService');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['text/csv', 'application/json', 'application/pdf'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  },
});

router.use(verifyAuth);

// Upload search results (CSV/JSON file)
router.post('/upload/:taskId', [param('taskId').isInt().toInt()], upload.single('file'), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const result = await documentService.uploadSearchResults(req.params.taskId, req.user.userId, req.file);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(201).json({ message: 'Search results uploaded', documentsCreated: result.documentsCreated, documents: result.documents });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: 'Failed to upload file' });
  }
});

// Paste/submit search results manually
router.post('/paste/:taskId', [param('taskId').isInt().toInt(), body('documents').isArray({ min: 1 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.submitManualResults(req.params.taskId, req.user.userId, req.body.documents);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(201).json({ message: 'Documents added', documentsCreated: result.documentsCreated, documents: result.documents });
  } catch (error) {
    console.error('Paste error:', error);
    res.status(500).json({ error: 'Failed to add documents' });
  }
});

// Get search results for task
router.get('/task/:taskId', [param('taskId').isInt().toInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.getTaskResults(req.params.taskId, req.user.userId, req.query.status);
    if (!result.success) return res.status(result.error === 'Unauthorized' ? 403 : 400).json({ error: result.error });
    res.status(200).json({ taskId: req.params.taskId, totalResults: result.documents.length, documents: result.documents });
  } catch (error) {
    console.error('Get results error:', error);
    res.status(500).json({ error: 'Failed to get results' });
  }
});

// Mark documents for AI analysis
router.post('/analyze', [body('documentIds').isArray({ min: 1 }), body('searchCriteria').isObject()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.analyzeDocuments(req.user.userId, req.body.documentIds, req.body.searchCriteria);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(200).json({ message: 'Analysis started', analysisId: result.analysisId, documentsQueued: result.documentsQueued });
  } catch (error) {
    console.error('Analyze error:', error);
    res.status(500).json({ error: 'Failed to start analysis' });
  }
});

// Get AI analysis results
router.get('/analysis/:taskId', [param('taskId').isInt().toInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.getAnalysisResults(req.params.taskId, req.user.userId);
    if (!result.success) return res.status(result.error === 'Unauthorized' ? 403 : 400).json({ error: result.error });
    res.status(200).json({ taskId: req.params.taskId, analysisComplete: result.analysisComplete, totalDocuments: result.totalDocuments, analyzedCount: result.analyzedCount, results: result.results });
  } catch (error) {
    console.error('Get analysis error:', error);
    res.status(500).json({ error: 'Failed to get analysis results' });
  }
});

// Update user decision on AI analysis
router.patch('/analysis/:reviewId/decision', [param('reviewId').isInt().toInt(), body('decision').isIn(['approved', 'rejected', 'needs_review'])], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.updateUserDecision(req.params.reviewId, req.user.userId, req.body.decision, req.body.notes, req.body.markForDownload);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(200).json({ message: 'Decision recorded', review: result.review });
  } catch (error) {
    console.error('Update decision error:', error);
    res.status(500).json({ error: 'Failed to update decision' });
  }
});

// Mark documents for download
router.post('/download/mark', [body('reviewIds').isArray({ min: 1 })], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.markForDownload(req.user.userId, req.body.reviewIds);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(200).json({ message: 'Documents marked for download', markedCount: result.markedCount });
  } catch (error) {
    console.error('Mark download error:', error);
    res.status(500).json({ error: 'Failed to mark documents' });
  }
});

// Execute downloads
router.post('/download/execute/:taskId', [param('taskId').isInt().toInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.executeDownloads(req.params.taskId, req.user.userId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(200).json({ message: 'Download started', downloadId: result.downloadId, documentsToDownload: result.documentsToDownload });
  } catch (error) {
    console.error('Execute download error:', error);
    res.status(500).json({ error: 'Failed to execute downloads' });
  }
});

// Get download status
router.get('/download/status/:taskId', [param('taskId').isInt().toInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.getDownloadStatus(req.params.taskId, req.user.userId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(200).json({ taskId: req.params.taskId, status: result.status, downloadedCount: result.downloadedCount, totalMarked: result.totalMarked, downloads: result.downloads });
  } catch (error) {
    console.error('Download status error:', error);
    res.status(500).json({ error: 'Failed to get download status' });
  }
});

// Get downloaded documents
router.get('/downloaded/:taskId', [param('taskId').isInt().toInt()], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });
    const result = await documentService.getDownloadedDocuments(req.params.taskId, req.user.userId);
    if (!result.success) return res.status(400).json({ error: result.error });
    res.status(200).json({ taskId: req.params.taskId, documents: result.documents });
  } catch (error) {
    console.error('Get downloaded error:', error);
    res.status(500).json({ error: 'Failed to get downloaded documents' });
  }
});

module.exports = router;
