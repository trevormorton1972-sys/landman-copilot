const puppeteer = require('puppeteer');

// ============================================================================
// IDOCMARKET ADAPTER
// ============================================================================

class IDOCMarketAdapter {
  constructor(options = {}) {
    this.headless = options.headless !== false; // Default to headless
    this.timeout = options.timeout || 30000;
    this.slowMo = options.slowMo || 0; // Slow down operations for debugging
    this.browser = null;
    this.page = null;
  }

  // ============================================================================
  // INITIALIZE BROWSER
  // ============================================================================

  async initialize() {
    try {
      this.browser = await puppeteer.launch({
        headless: this.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
      });

      this.page = await this.browser.newPage();
      this.page.setDefaultTimeout(this.timeout);
      this.page.setDefaultNavigationTimeout(this.timeout);

      // Set viewport
      await this.page.setViewport({ width: 1280, height: 720 });

      console.log('[IDOCMarket] Browser initialized');
      return true;
    } catch (error) {
      console.error('[IDOCMarket] Failed to initialize browser:', error.message);
      return false;
    }
  }

  // ============================================================================
  // LOGIN TO IDOCMARKET
  // ============================================================================

  async login(username, password) {
    try {
      console.log('[IDOCMarket] Logging in as:', username);

      // Navigate to IDOCMarket
      await this.page.goto('https://www.idocmarket.com/', {
        waitUntil: 'networkidle2',
      });

      // Wait for login form
      await this.page.waitForSelector('input[name="username"]', { timeout: 10000 });

      // Fill in username
      await this.page.type('input[name="username"]', username, { delay: 50 });

      // Fill in password
      await this.page.type('input[name="password"]', password, { delay: 50 });

      // Click login button
      await this.page.click('button[type="submit"], button:contains("Login")');

      // Wait for navigation after login
      await this.page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 15000 });

      // Check if login was successful by looking for dashboard elements
      const isLoggedIn = await this.page.evaluate(() => {
        return document.body.innerText.includes('Search') || 
               document.body.innerText.includes('Document') ||
               document.querySelector('[data-test="dashboard"]') !== null;
      });

      if (!isLoggedIn) {
        return {
          success: false,
          error: 'Login failed - invalid credentials or site changed',
        };
      }

      console.log('[IDOCMarket] Login successful');
      return { success: true };
    } catch (error) {
      console.error('[IDOCMarket] Login error:', error.message);
      return {
        success: false,
        error: `Login failed: ${error.message}`,
      };
    }
  }

  // ============================================================================
  // SEARCH FOR DOCUMENTS
  // ============================================================================

  async search(searchParams) {
    try {
      const { partyName, partyRole, dateFrom, dateTo, countyCode, legalDescription } = searchParams;

      console.log('[IDOCMarket] Starting search for:', partyName);

      // Navigate to search page if needed
      await this.page.goto('https://www.idocmarket.com/search', {
        waitUntil: 'networkidle2',
      });

      // Wait for search form
      await this.page.waitForSelector('input[name="party"]', { timeout: 10000 });

      // Clear and fill party name
      await this.page.focus('input[name="party"]');
      await this.page.keyboard.press('Control+A');
      await this.page.type('input[name="party"]', partyName, { delay: 30 });

      // Select party role if available
      if (partyRole) {
        const roleSelector = `select[name="role"], [data-test="party-role"]`;
        const roleExists = await this.page.$(roleSelector);
        if (roleExists) {
          await this.page.select(roleSelector, partyRole);
        }
      }

      // Fill date from
      if (dateFrom) {
        const dateFromInput = await this.page.$('input[name="dateFrom"], input[placeholder*="From"]');
        if (dateFromInput) {
          await dateFromInput.click();
          await this.page.keyboard.press('Control+A');
          await this.page.keyboard.type(dateFrom, { delay: 30 });
        }
      }

      // Fill date to
      if (dateTo) {
        const dateToInput = await this.page.$('input[name="dateTo"], input[placeholder*="To"]');
        if (dateToInput) {
          await dateToInput.click();
          await this.page.keyboard.press('Control+A');
          await this.page.keyboard.type(dateTo, { delay: 30 });
        }
      }

      // Submit search
      await this.page.click('button[type="submit"], button:contains("Search")');

      // Wait for results to load
      await this.page.waitForSelector('.search-results, [data-test="results"], table', {
        timeout: 20000,
      });

      console.log('[IDOCMarket] Search completed');

      // Extract results
      const results = await this.extractResults();

      return {
        success: true,
        resultsCount: results.length,
        results,
      };
    } catch (error) {
      console.error('[IDOCMarket] Search error:', error.message);
      return {
        success: false,
        error: `Search failed: ${error.message}`,
        resultsCount: 0,
        results: [],
      };
    }
  }

  // ============================================================================
  // EXTRACT SEARCH RESULTS
  // ============================================================================

  async extractResults() {
    try {
      const results = await this.page.evaluate(() => {
        const rows = document.querySelectorAll('table tbody tr, .result-row, [data-test="result-row"]');
        const documents = [];

        rows.forEach((row) => {
          try {
            const cells = row.querySelectorAll('td, .result-cell, [data-test="result-cell"]');

            if (cells.length >= 4) {
              const document = {
                documentNumber: cells[0]?.innerText?.trim() || '',
                recordingDate: cells[1]?.innerText?.trim() || '',
                grantor: cells[2]?.innerText?.trim() || '',
                grantee: cells[3]?.innerText?.trim() || '',
                documentType: cells[4]?.innerText?.trim() || '',
                pageCount: parseInt(cells[5]?.innerText || '1'),
                link: row.querySelector('a')?.href || '',
              };

              if (document.documentNumber) {
                documents.push(document);
              }
            }
          } catch (e) {
            // Skip rows that don't have expected structure
          }
        });

        return documents;
      });

      console.log('[IDOCMarket] Extracted', results.length, 'documents');
      return results;
    } catch (error) {
      console.error('[IDOCMarket] Extract results error:', error.message);
      return [];
    }
  }

  // ============================================================================
  // GET DOCUMENT PREVIEW/DETAILS
  // ============================================================================

  async getDocumentDetails(documentLink) {
    try {
      console.log('[IDOCMarket] Fetching document details');

      await this.page.goto(documentLink, { waitUntil: 'networkidle2' });

      const details = await this.page.evaluate(() => {
        return {
          title: document.querySelector('h1, .document-title')?.innerText || '',
          recordingDate: document.querySelector('[data-test="recording-date"]')?.innerText || '',
          grantor: document.querySelector('[data-test="grantor"]')?.innerText || '',
          grantee: document.querySelector('[data-test="grantee"]')?.innerText || '',
          documentType: document.querySelector('[data-test="type"]')?.innerText || '',
          legalDescription: document.querySelector('[data-test="legal-description"]')?.innerText || '',
          pageCount: parseInt(document.querySelector('[data-test="page-count"]')?.innerText || '1'),
        };
      });

      return { success: true, details };
    } catch (error) {
      console.error('[IDOCMarket] Get document details error:', error.message);
      return {
        success: false,
        error: error.message,
        details: null,
      };
    }
  }

  // ============================================================================
  // DOWNLOAD DOCUMENT
  // ============================================================================

  async downloadDocument(documentLink, savePath) {
    try {
      console.log('[IDOCMarket] Downloading document');

      // Create a new page for download
      const downloadPage = await this.browser.newPage();
      await downloadPage._client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: savePath,
      });

      await downloadPage.goto(documentLink);
      await downloadPage.waitForTimeout(3000);

      await downloadPage.close();

      console.log('[IDOCMarket] Document download initiated');
      return { success: true, message: 'Document download started' };
    } catch (error) {
      console.error('[IDOCMarket] Download error:', error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // ============================================================================
  // LOGOUT
  // ============================================================================

  async logout() {
    try {
      console.log('[IDOCMarket] Logging out');

      // Look for logout button or link
      const logoutSelector = 'a[href*="logout"], button:contains("Logout"), [data-test="logout"]';
      const logoutExists = await this.page.$(logoutSelector);

      if (logoutExists) {
        await this.page.click(logoutSelector);
        await this.page.waitForNavigation({ timeout: 5000 });
      }

      return { success: true };
    } catch (error) {
      console.error('[IDOCMarket] Logout error:', error.message);
      return { success: false, error: error.message };
    }
  }

  // ============================================================================
  // CLOSE BROWSER
  // ============================================================================

  async close() {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('[IDOCMarket] Browser closed');
      }
    } catch (error) {
      console.error('[IDOCMarket] Close error:', error.message);
    }
  }

  // ============================================================================
  // EXECUTE FULL SEARCH WORKFLOW
  // ============================================================================

  async executeSearch(username, password, searchParams) {
    try {
      // Initialize browser
      const initialized = await this.initialize();
      if (!initialized) {
        return { success: false, error: 'Failed to initialize browser' };
      }

      // Login
      const loginResult = await this.login(username, password);
      if (!loginResult.success) {
        await this.close();
        return loginResult;
      }

      // Search
      const searchResult = await this.search(searchParams);

      // Logout
      await this.logout();

      // Close browser
      await this.close();

      return searchResult;
    } catch (error) {
      console.error('[IDOCMarket] Execute search error:', error.message);
      await this.close();
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = IDOCMarketAdapter;
