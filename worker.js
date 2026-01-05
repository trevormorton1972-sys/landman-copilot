require('dotenv').config();
const pool = require('./src/config/database');
const browserlessService = require('./src/services/browserlessService');

const POLL_INTERVAL = 30000;

console.log('[Worker] Starting Landman Copilot Worker...');

const processQueuedTasks = async () => {
  try {
    const result = await pool.query(`
      SELECT st.*, pc.username, pc.encrypted_password, p.url as portal_url
      FROM search_tasks st
      JOIN portal_credentials pc ON st.portal_id = pc.portal_id AND st.user_id = pc.user_id
      JOIN portals p ON st.portal_id = p.id
      WHERE st.status = 'queued'
      ORDER BY st.priority ASC, st.created_at ASC
      LIMIT 1
    `);

    if (result.rows.length === 0) return;

    const task = result.rows[0];
    console.log('[Worker] Processing task ' + task.id + ': ' + task.party_name);

    await pool.query(
      'UPDATE search_tasks SET status = $1, started_at = NOW() WHERE id = $2',
      ['running', task.id]
    );

    try {
      const searchResult = await browserlessService.executeSearch({
        portalUrl: task.portal_url,
        username: task.username,
        password: decryptPassword(task.encrypted_password),
        partyName: task.party_name,
        partyRole: task.party_role,
        dateFrom: task.date_from,
        dateTo: task.date_to,
        legalDescription: task.legal_description,
      });

      if (searchResult.success) {
        for (const doc of searchResult.documents) {
          await pool.query(`
            INSERT INTO search_results (search_task_id, document_number, recording_date, 
              grantor, grantee, document_type, page_count, portal_url, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'new')
            ON CONFLICT (search_task_id, document_number) DO NOTHING
          `, [task.id, doc.documentNumber, doc.recordingDate, doc.grantor, 
              doc.grantee, doc.documentType, doc.pageCount, doc.link]);
        }

        await pool.query(
          'UPDATE search_tasks SET status = $1, completed_at = NOW() WHERE id = $2',
          ['completed', task.id]
        );
        console.log('[Worker] Task ' + task.id + ' completed - Found ' + searchResult.documents.length + ' documents');
      } else {
        throw new Error(searchResult.error || 'Search failed');
      }
    } catch (error) {
      console.error('[Worker] Task ' + task.id + ' failed:', error.message);
      await pool.query(
        'UPDATE search_tasks SET status = $1, error_message = $2 WHERE id = $3',
        ['failed', error.message, task.id]
      );
    }
  } catch (error) {
    console.error('[Worker] Error processing queue:', error);
  }
};

const decryptPassword = (encryptedPassword) => {
  const crypto = require('crypto');
  try {
    const key = process.env.ENCRYPTION_KEY || 'default-key-change-me';
    const [ivHex, encrypted] = encryptedPassword.split(':');
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(key.padEnd(32)), iv);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error('[Worker] Decryption error:', error);
    return encryptedPassword;
  }
};

const runWorker = async () => {
  console.log('[Worker] Polling every ' + (POLL_INTERVAL / 1000) + ' seconds...');
  while (true) {
    await processQueuedTasks();
    await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL));
  }
};

runWorker().catch(error => {
  console.error('[Worker] Fatal error:', error);
  process.exit(1);
});
