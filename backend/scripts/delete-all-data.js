const db = require('../src/db/connection');

async function deleteAllTransactionalData() {
  console.log('🗑️  Starting complete data deletion...');
  console.log('⚠️  This will delete ALL transactional data but preserve settings and rules\n');
  
  try {
    await db.query('BEGIN');
    
    // Delete in order of dependencies (most dependent first)
    const tables = [
      'venmo_unmatched_emails',
      'venmo_emails',
      'payment_requests',
      'utility_bills',
      'income',
      'expenses',
      'raw_transactions',
      'gmail_sync_state',
      'maintenance_tickets'
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(`DELETE FROM ${table}`);
        console.log(`✅ Deleted ${result.rowCount} rows from ${table}`);
      } catch (err) {
        if (err.code === '42P01') { // Table doesn't exist
          console.log(`⏭️  Table ${table} doesn't exist, skipping`);
        } else {
          throw err;
        }
      }
    }
    
    // Reset any sequences if needed
    console.log('\n📊 Resetting sequences...');
    const sequenceTables = [
      'expenses',
      'income', 
      'raw_transactions',
      'utility_bills',
      'payment_requests',
      'venmo_emails',
      'maintenance_tickets'
    ];
    
    for (const table of sequenceTables) {
      try {
        await db.query(`ALTER SEQUENCE ${table}_id_seq RESTART WITH 1`);
        console.log(`✅ Reset sequence for ${table}`);
      } catch (err) {
        // Some tables might not have sequences
        console.log(`⏭️  No sequence for ${table} (or already at 1)`);
      }
    }
    
    await db.query('COMMIT');
    console.log('\n✨ All transactional data deleted successfully!');
    console.log('📌 Preserved: ETL rules, settings, estimated taxes, and system configuration\n');
    
    // Show what's still in the database
    console.log('📋 Remaining configuration:');
    
    try {
      const etlRules = await db.getMany('SELECT COUNT(*) as count FROM etl_rules');
      console.log(`   - ETL Rules: ${etlRules[0].count}`);
    } catch (err) {
      console.log('   - ETL Rules: table not found');
    }
    
    try {
      const estimatedTaxes = await db.getMany('SELECT COUNT(*) as count FROM estimated_taxes');
      console.log(`   - Estimated Taxes: ${estimatedTaxes[0].count}`);
    } catch (err) {
      console.log('   - Estimated Taxes: table not found');
    }
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error deleting data:', error);
    process.exit(1);
  }
}

// Run the deletion
deleteAllTransactionalData()
  .then(() => {
    console.log('\n🎯 Ready to import fresh data from CSV!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });