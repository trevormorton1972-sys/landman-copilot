const fs = require('fs');
const path = require('path');
const pool = require('../src/config/database');

async function initializeDatabase() {
  try {
    console.log('Starting database initialization...');

    // Read the schema file
    const schemaPath = path.join(__dirname, '../schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');

    // Split by semicolons and filter out empty statements
    const statements = schema
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0);

    // Execute each statement
    for (const statement of statements) {
      try {
        console.log(`Executing: ${statement.substring(0, 80)}...`);
        await pool.query(statement);
      } catch (err) {
        if (err.code === '42P07') {
          // Table already exists - that's fine
          console.log('(Table already exists - skipping)');
        } else {
          throw err;
        }
      }
    }

    console.log('✓ Database initialization completed successfully!');
    process.exit(0);
  } catch (err) {
    console.error('✗ Database initialization failed:', err.message);
    process.exit(1);
  }
}

initializeDatabase();
