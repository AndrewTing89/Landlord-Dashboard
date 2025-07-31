const db = require('../db/connection');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  try {
    console.log('Running migration to create utility_adjustments table...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../db/migrations/013_create_utility_adjustments.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Execute the entire migration as one command since it has related statements
    await db.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!');
    
    // Verify the table was created
    const result = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_name = 'utility_adjustments'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ utility_adjustments table created successfully');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();