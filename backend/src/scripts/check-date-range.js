const db = require('../db/connection');

async function checkDateRange() {
  try {
    console.log('📅 Checking transaction date ranges...\n');
    
    // Check the date range in raw_transactions
    const dateRange = await db.getOne(
      `SELECT 
         MIN(posted_date) as earliest,
         MAX(posted_date) as latest,
         COUNT(*) as total
       FROM raw_transactions`
    );
    
    console.log(`Raw transactions date range:`);
    console.log(`  Earliest: ${dateRange.earliest}`);
    console.log(`  Latest: ${dateRange.latest}`);
    console.log(`  Total: ${dateRange.total} transactions`);
    
    // Check PG&E transactions specifically
    const pgeTransactions = await db.query(
      `SELECT posted_date, description, amount
       FROM raw_transactions
       WHERE suggested_expense_type = 'electricity'
          OR LOWER(description) LIKE '%pgande%'
          OR LOWER(description) LIKE '%pg&e%'
       ORDER BY posted_date ASC`
    );
    
    console.log(`\n⚡ PG&E Transactions found (${pgeTransactions.rows.length}):`);
    pgeTransactions.rows.forEach(t => {
      console.log(`  ${t.posted_date.toISOString().split('T')[0]} - $${Math.abs(t.amount)}`);
    });
    
    // Check the sync date range in SimpleFIN service
    console.log('\n🔍 Checking SimpleFIN sync code...');
    console.log('Default sync: Last 90 days');
    console.log('Current date:', new Date().toISOString().split('T')[0]);
    console.log('90 days ago:', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkDateRange();