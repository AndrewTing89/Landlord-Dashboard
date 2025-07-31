#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function clearJuneJulyData() {
  try {
    console.log('Clearing June and July 2025 data for testing...\n');
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // 1. Clear payment requests for June/July
      console.log('1. Clearing June/July payment requests...');
      const prResult = await db.query(
        `DELETE FROM payment_requests 
         WHERE (month IN (6, 7) AND year = 2025)
         OR charge_date >= '2025-06-01'`
      );
      console.log(`   - Deleted ${prResult.rowCount} payment requests`);
      
      // 2. Clear utility adjustments for those months
      const adjResult = await db.query(
        `DELETE FROM utility_adjustments 
         WHERE applied_date >= '2025-06-01'`
      );
      console.log(`   - Deleted ${adjResult.rowCount} utility adjustments`);
      
      // 3. Delete transactions after May 31, 2025
      console.log('\n2. Deleting transactions after May 31, 2025...');
      
      // First show what we're deleting
      const toDelete = await db.query(
        `SELECT expense_type, COUNT(*) as count 
         FROM transactions 
         WHERE date > '2025-05-31'
         GROUP BY expense_type
         ORDER BY expense_type`
      );
      
      console.log('   Transactions to be deleted:');
      toDelete.rows.forEach(row => {
        console.log(`   - ${row.expense_type}: ${row.count} transactions`);
      });
      
      // Delete the transactions
      const txResult = await db.query(
        `DELETE FROM transactions WHERE date > '2025-05-31'`
      );
      console.log(`\n   Total deleted: ${txResult.rowCount} transactions`);
      
      // 4. Delete corresponding raw_transactions
      const rawResult = await db.query(
        `DELETE FROM raw_transactions WHERE posted_date > '2025-05-31'`
      );
      console.log(`   Deleted ${rawResult.rowCount} raw transactions`);
      
      // 5. Clear sync history for testing
      console.log('\n3. Clearing recent sync history...');
      const syncResult = await db.query(
        `DELETE FROM sync_history 
         WHERE started_at > NOW() - INTERVAL '1 hour'`
      );
      console.log(`   - Deleted ${syncResult.rowCount} sync history records`);
      
      // Show remaining data summary
      console.log('\n4. Remaining data summary:');
      const summary = await db.query(
        `SELECT 
          (SELECT COUNT(*) FROM transactions) as total_transactions,
          (SELECT MAX(date) FROM transactions) as latest_transaction,
          (SELECT COUNT(*) FROM payment_requests) as total_payment_requests,
          (SELECT COUNT(*) FROM raw_transactions WHERE processed = false) as pending_review`
      );
      
      const row = summary.rows[0];
      console.log(`   - Total transactions: ${row.total_transactions}`);
      console.log(`   - Latest transaction: ${row.latest_transaction}`);
      console.log(`   - Total payment requests: ${row.total_payment_requests}`);
      console.log(`   - Pending review: ${row.pending_review}`);
      
      // Commit
      await db.query('COMMIT');
      console.log('\n✅ Data cleared successfully! Ready for testing.');
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

// Confirm before running
console.log('⚠️  WARNING: This will delete all June/July 2025 data!');
console.log('Press Ctrl+C to cancel, or wait 3 seconds to continue...\n');

setTimeout(() => {
  clearJuneJulyData();
}, 3000);