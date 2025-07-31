const simplefin = require('../services/simplefinService');
const db = require('../db/connection');

async function syncFullYear() {
  try {
    console.log('🔄 Syncing full year of transactions...\n');
    
    // Clear existing raw transactions for a fresh sync
    await db.query('DELETE FROM raw_transactions');
    console.log('✅ Cleared existing raw transactions');
    
    // Sync from January 1, 2025
    const startDate = '2025-01-01';
    console.log(`📅 Syncing from ${startDate} to today...`);
    
    const result = await simplefin.syncTransactions(startDate);
    
    console.log(`\n✅ ${result.message}`);
    
    // Check PG&E transactions after sync
    const pgeCount = await db.getOne(
      `SELECT COUNT(*) as count
       FROM raw_transactions
       WHERE suggested_expense_type = 'electricity'
          OR LOWER(description) LIKE '%pgande%'
          OR LOWER(description) LIKE '%pg&e%'`
    );
    
    console.log(`\n⚡ Found ${pgeCount.count} PG&E transactions`);
    
    // Show monthly PG&E summary
    const pgeSummary = await db.query(
      `SELECT 
         EXTRACT(MONTH FROM posted_date) as month,
         COUNT(*) as count,
         SUM(ABS(amount)) as total
       FROM raw_transactions
       WHERE suggested_expense_type = 'electricity'
          OR LOWER(description) LIKE '%pgande%'
       GROUP BY EXTRACT(MONTH FROM posted_date)
       ORDER BY month`
    );
    
    console.log('\n📊 PG&E Monthly Summary:');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    pgeSummary.rows.forEach(row => {
      console.log(`  ${monthNames[row.month - 1]}: ${row.count} payment(s) - $${row.total}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

syncFullYear();