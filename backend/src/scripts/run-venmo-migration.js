const db = require('../db/connection');
const fs = require('fs');
const path = require('path');

async function runMigration() {
  try {
    console.log('Running Venmo tracking migration...\n');
    
    const migrationPath = path.join(__dirname, '../db/migrations/010_create_venmo_tracking.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    await db.query(sql);
    
    console.log('✅ Migration completed successfully!');
    console.log('\nCreated tables:');
    console.log('  - venmo_payment_requests');
    console.log('  - venmo_unmatched_payments');
    console.log('\nAdded indexes for performance');
    console.log('Added venmo_request_id column to payment_requests table');
    
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();