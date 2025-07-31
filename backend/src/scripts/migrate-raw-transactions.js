const fs = require('fs');
const path = require('path');
const db = require('../db/connection');

async function runMigration() {
  try {
    console.log('Running raw transactions migration...');
    
    const migrationPath = path.join(__dirname, '../db/migrations/008_create_raw_transactions.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await db.query(sql);
    
    console.log('✅ Raw transactions tables created successfully!');
    console.log('✅ ETL rules table created with default rules');
    console.log('✅ Pending review view created');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();