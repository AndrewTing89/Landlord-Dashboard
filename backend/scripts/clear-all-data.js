const db = require('../src/db/connection');

async function clearAllData() {
  try {
    console.log('=== CLEARING ALL DATA ===');
    
    // Delete in safe order (child tables first)
    const tables = [
      'venmo_emails',
      'payment_requests', 
      'venmo_payment_requests',
      'payment_confirmations',
      'venmo_unmatched_payments',
      'venmo_unmatched_emails',
      'unmatched_payments',
      'utility_bills',
      'utility_adjustments',
      'transactions',
      'raw_transactions',
      'gmail_sync_state',
      'sync_history',
      'monthly_reports',
      'job_runs'
    ];
    
    for (const table of tables) {
      try {
        const result = await db.query(`DELETE FROM ${table}`);
        console.log(`✓ Cleared ${table}: ${result.rowCount} rows deleted`);
      } catch (err) {
        // Table might not exist, skip it
        console.log(`- Skipped ${table} (may not exist)`);
      }
    }
    
    console.log('\n✅ ALL DATA CLEARED SUCCESSFULLY');
    console.log('Database is ready for fresh import.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

clearAllData();