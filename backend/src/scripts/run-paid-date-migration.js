const db = require('../db/connection');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  try {
    console.log('Running migration to add paid_date column...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../db/migrations/011_add_payment_request_paid_date.sql');
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');
    
    // Split by semicolons to run each command separately
    const commands = migrationSQL
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0);
    
    for (const command of commands) {
      console.log('Executing:', command.substring(0, 50) + '...');
      await db.query(command);
    }
    
    console.log('✅ Migration completed successfully!');
    
    // Check if the column was added
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payment_requests' 
      AND column_name = 'paid_date'
    `);
    
    if (result.rows.length > 0) {
      console.log('✅ paid_date column exists:', result.rows[0]);
    } else {
      console.log('❌ paid_date column was not created');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();