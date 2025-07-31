const db = require('../db/connection');
const fs = require('fs').promises;
const path = require('path');

async function runMigration() {
  try {
    console.log('Running migration to add charge_date column...');
    
    // Read the migration file
    const migrationPath = path.join(__dirname, '../db/migrations/012_add_payment_request_charge_date.sql');
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
    
    // Check if the columns were added
    const result = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'payment_requests' 
      AND column_name IN ('charge_date', 'merchant_name')
    `);
    
    console.log('Columns added:', result.rows);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

runMigration();