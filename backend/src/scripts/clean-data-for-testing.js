#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function cleanDataForTesting() {
  try {
    console.log('Starting data cleanup for testing...\n');
    
    // Start transaction
    await db.query('BEGIN');
    
    try {
      // 1. Clear payment request related tables
      console.log('1. Clearing payment request related tables...');
      
      // Delete utility adjustments first (has foreign key to payment_requests)
      const adjResult = await db.query('DELETE FROM utility_adjustments');
      console.log(`   - Deleted ${adjResult.rowCount} utility adjustments`);
      
      // Delete payment confirmations
      const confResult = await db.query('DELETE FROM payment_confirmations');
      console.log(`   - Deleted ${confResult.rowCount} payment confirmations`);
      
      // Delete payment requests first (they reference venmo_payment_requests)
      const prResult = await db.query('DELETE FROM payment_requests');
      console.log(`   - Deleted ${prResult.rowCount} payment requests`);
      
      // Delete venmo related tables
      const vrResult = await db.query('DELETE FROM venmo_payment_requests');
      console.log(`   - Deleted ${vrResult.rowCount} venmo payment requests`);
      
      const vumResult = await db.query('DELETE FROM venmo_unmatched_payments');
      console.log(`   - Deleted ${vumResult.rowCount} venmo unmatched payments`);
      
      // Delete utility bills (can delete now that all references are gone)
      const ubResult = await db.query('DELETE FROM utility_bills');
      console.log(`   - Deleted ${ubResult.rowCount} utility bills`);
      
      // 2. Delete transactions after May 31, 2025
      console.log('\n2. Deleting transactions after May 31, 2025...');
      
      // First, show what we're about to delete
      const toDelete = await db.query(
        `SELECT expense_type, COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date
         FROM transactions 
         WHERE date > '2025-05-31'
         GROUP BY expense_type
         ORDER BY expense_type`
      );
      
      console.log('   Transactions to be deleted:');
      toDelete.rows.forEach(row => {
        console.log(`   - ${row.expense_type}: ${row.count} transactions (${row.min_date} to ${row.max_date})`);
      });
      
      // Delete the transactions
      const txResult = await db.query(
        `DELETE FROM transactions WHERE date > '2025-05-31'`
      );
      console.log(`\n   Total deleted: ${txResult.rowCount} transactions`);
      
      // Also delete corresponding raw_transactions
      const rawResult = await db.query(
        `DELETE FROM raw_transactions WHERE posted_date > '2025-05-31'`
      );
      console.log(`   Deleted ${rawResult.rowCount} raw transactions`);
      
      // 3. Show remaining transaction summary
      console.log('\n3. Remaining transaction summary:');
      const remaining = await db.query(
        `SELECT 
          expense_type, 
          COUNT(*) as count, 
          SUM(amount) as total,
          MAX(date) as latest_date
         FROM transactions 
         GROUP BY expense_type 
         ORDER BY expense_type`
      );
      
      remaining.rows.forEach(row => {
        console.log(`   - ${row.expense_type}: ${row.count} transactions, $${row.total} total, latest: ${row.latest_date}`);
      });
      
      // 4. SimpleFIN doesn't use a cursor table, so we're ready to go
      
      // Commit all changes
      await db.query('COMMIT');
      console.log('\n✅ Data cleanup completed successfully!');
      
      console.log('\nReady for testing! Next steps:');
      console.log('1. Run SimpleFIN sync to fetch June/July transactions');
      console.log('2. Process bills to create payment requests');
      console.log('3. Test the payment flow');
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('Error during cleanup:', error);
  } finally {
    await db.close();
  }
}

// Confirm before running
console.log('⚠️  WARNING: This will delete all payment requests and transactions after May 31, 2025!');
console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');

setTimeout(() => {
  cleanDataForTesting();
}, 5000);