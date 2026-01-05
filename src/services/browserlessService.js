const https = require('https');

const BROWSERLESS_API_KEY = process.env.BROWSERLESS_API_KEY;
const BROWSERLESS_ENDPOINT = process.env.BROWSERLESS_ENDPOINT || 'https://chrome.browserless.io';

const executeSearch = async (params) => {
  const { portalUrl, username, password, partyName, dateFrom, dateTo } = params;
  console.log('[Browserless] Starting search for:', partyName);

  try {
    const script = buildSearchScript(portalUrl, username, password, partyName, dateFrom, dateTo);
    const result = await callBrowserless('/function', { code: script });

    if (result.error) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      documents: result.documents || [],
      metadata: result.metadata,
    };
  } catch (error) {
    console.error('[Browserless] Search error:', error);
    return { success: false, error: error.message };
  }
};

const buildSearchScript = (portalUrl, username, password, partyName, dateFrom, dateTo) => {
  let script = 'module.exports = async ({ page }) => {\n';
  script += '  try {\n';
  script += '    await page.goto("' + portalUrl + '", { waitUntil: "networkidle2", timeout: 30000 });\n';
  script += '    await page.waitForSelector("input[name=username], input[type=email]", { timeout: 10000 });\n';
  script += '    await page.type("input[name=username], input[type=email]", "' + username + '");\n';
  script += '    await page.type("input[name=password], input[type=password]", "' + password + '");\n';
  script += '    await page.click("button[type=submit], input[type=submit]");\n';
  script += '    await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 15000 });\n';
  script += '    await page.goto("' + portalUrl + '/search", { waitUntil: "networkidle2" });\n';
  script += '    const partyInput = await page.$("input[name=party], input[name=partyName]");\n';
  script += '    if (partyInput) { await partyInput.type("' + partyName + '"); }\n';

  if (dateFrom) {
    script += '    const dfInput = await page.$("input[name=dateFrom]");\n';
    script += '    if (dfInput) { await dfInput.type("' + dateFrom + '"); }\n';
  }

  if (dateTo) {
    script += '    const dtInput = await page.$("input[name=dateTo]");\n';
    script += '    if (dtInput) { await dtInput.type("' + dateTo + '"); }\n';
  }

  script += '    await page.click("button[type=submit], .search-button");\n';
  script += '    await page.waitForSelector("table, .results", { timeout: 20000 });\n';
  script += '    const documents = await page.evaluate(() => {\n';
  script += '      const rows = document.querySelectorAll("table tbody tr");\n';
  script += '      return Array.from(rows).map(row => {\n';
  script += '        const cells = row.querySelectorAll("td");\n';
  script += '        return {\n';
  script += '          documentNumber: cells[0]?.innerText?.trim() || "",\n';
  script += '          recordingDate: cells[1]?.innerText?.trim() || "",\n';
  script += '          grantor: cells[2]?.innerText?.trim() || "",\n';
  script += '          grantee: cells[3]?.innerText?.trim() || "",\n';
  script += '          documentType: cells[4]?.innerText?.trim() || "",\n';
  script += '          pageCount: parseInt(cells[5]?.innerText || "1"),\n';
  script += '          link: row.querySelector("a")?.href || "",\n';
  script += '        };\n';
  script += '      }).filter(d => d.documentNumber);\n';
  script += '    });\n';
  script += '    return { documents, metadata: { searchedAt: new Date().toISOString() } };\n';
  script += '  } catch (error) {\n';
  script += '    return { error: error.message };\n';
  script += '  }\n';
  script += '};\n';

  return script;
};

const callBrowserless = (endpoint, data) => {
  return new Promise((resolve, reject) => {
    const url = new URL(endpoint, BROWSERLESS_ENDPOINT);
    url.searchParams.set('token', BROWSERLESS_API_KEY);

    const postData = JSON.stringify(data);
    const options = {
      hostname: url.hostname,
      port: 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          resolve({ error: 'Failed to parse response', raw: body });
        }
      });
    });

    req.on('error', reject);
    req.write(postData);
    req.end();
  });
};

const scrapePage = async (url) => {
  console.log('[Browserless] Scraping:', url);
  try {
    const result = await callBrowserless('/scrape', {
      url: url,
      elements: [{ selector: 'table' }, { selector: '.results' }],
    });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

const downloadDocument = async (documentUrl, credentials) => {
  console.log('[Browserless] Downloading document');
  try {
    let script = 'module.exports = async ({ page }) => {\n';

    if (credentials) {
      script += '  await page.goto("' + credentials.loginUrl + '", { waitUntil: "networkidle2" });\n';
      script += '  await page.type("input[name=username]", "' + credentials.username + '");\n';
      script += '  await page.type("input[name=password]", "' + credentials.password + '");\n';
      script += '  await page.click("button[type=submit]");\n';
      script += '  await page.waitForNavigation();\n';
    }

    script += '  await page.goto("' + documentUrl + '", { waitUntil: "networkidle2" });\n';
    script += '  const pdf = await page.pdf({ format: "A4" });\n';
    script += '  return { pdf: pdf.toString("base64") };\n';
    script += '};\n';

    const result = await callBrowserless('/function', { code: script });
    return { success: true, data: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

module.exports = { executeSearch, scrapePage, downloadDocument };
