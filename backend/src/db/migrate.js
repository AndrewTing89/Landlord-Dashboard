const fs = require('fs').promises;
const path = require('path');
const db = require('./connection');

async function migrate() {
  console.log('Running database migrations...');
  
  try {
    // Read the schema file
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = await fs.readFile(schemaPath, 'utf8');
    
    // Split into individual statements
    const statements = schema
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 50) + '...');
      
      try {
        await db.query(statement);
        console.log('✓ Success');
      } catch (error) {
        console.error('✗ Error:', error.message);
        // Continue with other statements even if one fails
      }
    }
    
    console.log('\n✅ Migration complete!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = migrate;