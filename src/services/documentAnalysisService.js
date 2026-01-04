const db = require('../models/documentAnalysisModels');

// ============================================================================
// EXTRACT TEXT FROM PDF (Using simple text extraction)
// ============================================================================

const extractTextFromPDF = async (filePath) => {
  try {
    // Note: In production, use pdf-parse or pdfjs-dist
    // For now, return placeholder
    console.log('[DocumentAnalysis] Extracting text from:', filePath);
    
    // This would integrate with pdf-parse or similar library
    // For demo, we'll show the pattern:
    return {
      success: true,
      text: 'Extracted PDF text would go here',
      pageCount: 1,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// PARSE DOCUMENT ENTITIES
// ============================================================================

const parseDocumentEntities = (text) => {
  const entities = [];

  // Pattern: "GRANTOR: John Smith" or similar
  const grantorMatch = text.match(/grantor[:\s]+([A-Za-z\s&,.]+?)(?:\n|GRANTEE|GRANTER)/i);
  if (grantorMatch) {
    entities.push({
      type: 'GRANTOR',
      value: grantorMatch[1].trim(),
      confidence: 0.85,
      context: 'Extracted from grantor field',
    });
  }

  // Pattern: "GRANTEE: Jane Doe"
  const granteeMatch = text.match(/grantee[:\s]+([A-Za-z\s&,.]+?)(?:\n|LEGAL|DESCRIPTION)/i);
  if (granteeMatch) {
    entities.push({
      type: 'GRANTEE',
      value: granteeMatch[1].trim(),
      confidence: 0.85,
      context: 'Extracted from grantee field',
    });
  }

  // Pattern: "CONSIDERATION: $100,000" or "FOR $50,000"
  const amountMatch = text.match(/(?:consideration|for)\s*[\$]?([\d,]+(?:\.\d{2})?)/i);
  if (amountMatch) {
    entities.push({
      type: 'CONSIDERATION_AMOUNT',
      value: amountMatch[1],
      confidence: 0.80,
      context: 'Extracted from consideration field',
    });
  }

  // Pattern: "LEGAL DESCRIPTION: E2W2 of Section 2..."
  const legalMatch = text.match(/legal\s+description[:\s]+([^\n]+(?:\n[^\n]+)?)/i);
  if (legalMatch) {
    entities.push({
      type: 'LEGAL_DESCRIPTION',
      value: legalMatch[1].trim(),
      confidence: 0.90,
      context: 'Extracted from legal description field',
    });
  }

  // Pattern: Date like "01/04/2026" or "January 4, 2026"
  const dateMatch = text.match(/(\d{1,2}\/\d{1,2}\/\d{4}|[A-Za-z]+\s+\d{1,2},?\s+\d{4})/);
  if (dateMatch) {
    entities.push({
      type: 'DATE',
      value: dateMatch[1],
      confidence: 0.85,
      context: 'Extracted from document',
    });
  }

  // Extract document type keywords
  const documentTypes = ['deed', 'lease', 'assignment', 'mortgage', 'release', 'conveyance', 'transfer'];
  const foundType = documentTypes.find((type) => text.toLowerCase().includes(type));
  if (foundType) {
    entities.push({
      type: 'DOCUMENT_TYPE',
      value: foundType.toUpperCase(),
      confidence: 0.75,
      context: 'Extracted from document keywords',
    });
  }

  return entities;
};

// ============================================================================
// ANALYZE DOCUMENT
// ============================================================================

const analyzeDocument = async (documentId, filePath, searchResultData) => {
  try {
    console.log(`[DocumentAnalysis] Analyzing document ${documentId}`);

    // Extract text from PDF
    const extractResult = await extractTextFromPDF(filePath);
    if (!extractResult.success) {
      return {
        success: false,
        error: 'Failed to extract text from document',
      };
    }

    const { text, pageCount } = extractResult;

    // Parse entities from extracted text
    const entities = parseDocumentEntities(text);

    // Calculate confidence score based on entities found
    const avgConfidence =
      entities.length > 0
        ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
        : 0.5;

    // Create analysis record
    const analysis = await db.createDocumentAnalysis({
      documentId,
      documentNumber: searchResultData.documentNumber,
      documentType: searchResultData.documentType,
      recordingDate: searchResultData.recordingDate,
      grantor: searchResultData.grantor || extractEntityValue(entities, 'GRANTOR'),
      grantee: searchResultData.grantee || extractEntityValue(entities, 'GRANTEE'),
      legalDescription: searchResultData.legalDescription || extractEntityValue(entities, 'LEGAL_DESCRIPTION'),
      considerationAmount: extractEntityValue(entities, 'CONSIDERATION_AMOUNT'),
      pageCount: pageCount || searchResultData.pageCount,
      extractedText: text,
      confidenceScore: Math.round(avgConfidence * 100) / 100,
    });

    if (!analysis) {
      return {
        success: false,
        error: 'Failed to create analysis record',
      };
    }

    // Store extracted entities
    const storedEntities = [];
    for (const entity of entities) {
      const stored = await db.createExtractedEntity(
        analysis.id,
        entity.type,
        entity.value,
        entity.confidence,
        entity.context
      );

      if (stored) {
        storedEntities.push(stored);
      }
    }

    // Update analysis status
    await db.updateAnalysisStatus(analysis.id, 'completed');

    console.log(`[DocumentAnalysis] Analysis complete - Found ${storedEntities.length} entities`);

    return {
      success: true,
      analysisId: analysis.id,
      entitiesCount: storedEntities.length,
      confidenceScore: analysis.confidence_score,
      entities: storedEntities,
    };
  } catch (error) {
    console.error('[DocumentAnalysis] Error:', error.message);
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// BATCH ANALYZE DOCUMENTS
// ============================================================================

const batchAnalyzeDocuments = async (organizationId, limit = 5) => {
  try {
    console.log(`[DocumentAnalysis] Batch analyzing documents for org ${organizationId}`);

    // Get unanalyzed documents
    const documents = await db.getUnanalyzedDocuments(organizationId, limit);

    if (documents.length === 0) {
      return {
        success: true,
        analyzed: 0,
        results: [],
      };
    }

    const results = [];

    for (const doc of documents) {
      const result = await analyzeDocument(doc.id, doc.file_path, {
        documentNumber: doc.document_number,
        documentType: doc.document_type,
        recordingDate: doc.recording_date,
        grantor: doc.grantor,
        grantee: doc.grantee,
        legalDescription: doc.legal_description,
        pageCount: doc.page_count,
      });

      results.push({
        documentId: doc.id,
        ...result,
      });

      // Small delay between analyses
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    console.log(`[DocumentAnalysis] Batch complete - Analyzed ${results.length} documents`);

    return {
      success: true,
      analyzed: results.length,
      results,
    };
  } catch (error) {
    console.error('[DocumentAnalysis] Batch error:', error.message);
    return {
      success: false,
      error: error.message,
      analyzed: 0,
      results: [],
    };
  }
};

// ============================================================================
// GET DOCUMENT SUMMARY
// ============================================================================

const getDocumentSummary = async (documentId) => {
  try {
    const analysis = await db.getDocumentAnalysis(documentId);

    if (!analysis) {
      return {
        success: false,
        error: 'Document not analyzed',
      };
    }

    const entities = await db.getExtractedEntities(analysis.id);

    return {
      success: true,
      document: {
        documentNumber: analysis.document_number,
        documentType: analysis.document_type,
        recordingDate: analysis.recording_date,
        grantor: analysis.grantor,
        grantee: analysis.grantee,
        legalDescription: analysis.legal_description,
        considerationAmount: analysis.consideration_amount,
        confidenceScore: analysis.confidence_score,
      },
      entities,
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
    };
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

const extractEntityValue = (entities, type) => {
  const entity = entities.find((e) => e.type === type);
  return entity ? entity.value : null;
};

module.exports = {
  analyzeDocument,
  batchAnalyzeDocuments,
  getDocumentSummary,
  parseDocumentEntities,
  extractTextFromPDF,
};
