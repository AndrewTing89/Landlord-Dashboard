const db = require('./connection');
const fs = require('fs').promises;
const path = require('path');

async function setupDatabase() {
  console.log('Setting up database tables...');
  
  try {
    // Read the full schema
    const schemaPath = path.join(__dirname, 'init/01-schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // Execute the entire schema at once
    await db.query(schema);
    
    console.log('✅ Database setup complete!');
    console.log('Tables created: transactions, expense_categories, utility_bills, payment_requests, etc.');
    
  } catch (error) {
    console.error('Database setup failed:', error.message);
    
    // If the file doesn't exist, try the other schema file
    if (error.code === 'ENOENT') {
      console.log('Trying alternative schema file...');
      try {
        const altSchemaPath = path.join(__dirname, 'schema.sql');
        const schema = await fs.readFile(altSchemaPath, 'utf8');
        await db.query(schema);
        console.log('✅ Database setup complete using alternative schema!');
      } catch (altError) {
        console.error('Alternative also failed:', altError.message);
      }
    }
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  setupDatabase();
}

module.exports = setupDatabase;