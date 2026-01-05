const Anthropic = require('@anthropic-ai/sdk');

// Initialize Anthropic client
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================================================
// ANALYZE DOCUMENT WITH CLAUDE
// ============================================================================

const analyzeDocument = async (document, searchCriteria) => {
  try {
    const { partyName, dateFrom, dateTo, legalDescription, documentTypes } = searchCriteria;

    const prompt = buildAnalysisPrompt(document, searchCriteria);

    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 1500,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    // Parse Claude's response
    const analysisText = response.content[0].text;
    return parseAnalysisResponse(analysisText);
  } catch (error) {
    console.error('[AI] Claude API error:', error);
    throw error;
  }
};

// ============================================================================
// BUILD ANALYSIS PROMPT
// ============================================================================

const buildAnalysisPrompt = (document, criteria) => {
  return `You are a land title analyst assistant. Analyze this document record to determine if it matches the search criteria.

DOCUMENT RECORD:
- Document Number: ${document.document_number || 'N/A'}
- Document Type: ${document.document_type || 'N/A'}
- Recording Date: ${document.recording_date || 'N/A'}
- Grantor (Seller): ${document.grantor || 'N/A'}
- Grantee (Buyer): ${document.grantee || 'N/A'}
- Legal Description: ${document.legal_description || 'N/A'}
- Page Count: ${document.page_count || 'N/A'}

SEARCH CRITERIA:
- Party Name to Match: ${criteria.partyName}
- Date Range: ${criteria.dateFrom || 'Any'} to ${criteria.dateTo || 'Any'}
- Legal Description to Match: ${criteria.legalDescription || 'Any'}
- Document Types of Interest: ${criteria.documentTypes?.join(', ') || 'Any'}

ANALYSIS INSTRUCTIONS:
1. Check if the party name appears in either Grantor or Grantee fields (consider partial matches, variations, and common abbreviations like LLC, Inc, Corp)
2. Check if the recording date falls within the specified date range
3. Check if the legal description matches or overlaps with the search criteria
4. Determine if the document type is relevant

Provide your analysis in the following JSON format:
{
  "assessment": "meets_criteria" | "probable_match" | "exclude",
  "confidence": 0.0-1.0,
  "evidence": "Brief explanation of why this document matches or does not match",
  "partyMatch": {
    "found": true/false,
    "matchType": "grantor" | "grantee" | "both" | "none",
    "details": "Specific match details"
  },
  "dateMatch": {
    "inRange": true/false,
    "details": "Date comparison details"
  },
  "legalMatch": {
    "matches": true/false,
    "details": "Legal description comparison"
  },
  "quotes": "Any relevant excerpts or key information from the document fields",
  "relevantPages": "all" | "none" | "1,2,3"
}

Respond ONLY with the JSON object, no additional text.`;
};

// ============================================================================
// PARSE ANALYSIS RESPONSE
// ============================================================================

const parseAnalysisResponse = (responseText) => {
  try {
    // Try to extract JSON from the response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      assessment: parsed.assessment || 'pending',
      confidence: parsed.confidence || 0.5,
      evidence: parsed.evidence || '',
      quotes: parsed.quotes || '',
      relevantPages: parsed.relevantPages || 'all',
      partyMatch: parsed.partyMatch,
      dateMatch: parsed.dateMatch,
      legalMatch: parsed.legalMatch,
    };
  } catch (error) {
    console.error('[AI] Failed to parse response:', error);
    return {
      assessment: 'pending',
      confidence: 0.5,
      evidence: 'Failed to parse AI response: ' + responseText.substring(0, 200),
      quotes: '',
      relevantPages: 'all',
    };
  }
};

// ============================================================================
// BATCH ANALYZE DOCUMENTS
// ============================================================================

const batchAnalyze = async (documents, searchCriteria, options = {}) => {
  const { concurrency = 3, delayMs = 500 } = options;
  const results = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < documents.length; i += concurrency) {
    const batch = documents.slice(i, i + concurrency);

    const batchResults = await Promise.all(
      batch.map(doc => analyzeDocument(doc, searchCriteria).catch(err => ({
        assessment: 'pending',
        confidence: 0,
        evidence: `Error: ${err.message}`,
        error: true,
      })))
    );

    results.push(...batchResults);

    // Delay between batches
    if (i + concurrency < documents.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  return results;
};

// ============================================================================
// SUMMARIZE DOCUMENT FOR DISPLAY
// ============================================================================

const summarizeDocument = async (documentText) => {
  try {
    const response = await anthropic.messages.create({
      model: 'claude-3-5-sonnet-20241022',
      max_tokens: 500,
      messages: [
        {
          role: 'user',
          content: `Summarize this land document in 2-3 sentences, focusing on: parties involved, property description, and transaction type.\n\nDocument:\n${documentText}`,
        },
      ],
    });

    return response.content[0].text;
  } catch (error) {
    console.error('[AI] Summarize error:', error);
    return null;
  }
};

module.exports = {
  analyzeDocument,
  batchAnalyze,
  summarizeDocument,
};
