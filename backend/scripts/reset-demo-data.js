#!/usr/bin/env node

/**
 * Reset Demo Data - Delete July and August 2024 data
 * 
 * This script can be run repeatedly to reset the demo environment
 * by removing July and August 2024 data, allowing you to demonstrate
 * the sync and fetch features with fresh data.
 * 
 * Usage: node scripts/reset-demo-data.js
 */

require('dotenv').config();
const db = require('../src/db/connection');

const RESET_START_DATE = '2025-07-01';
const RESET_END_DATE = '2025-09-01';

async function resetDemoData() {
  console.log('🔄 Resetting demo data (removing July-August 2025)...\n');
  console.log(`📅 Date range: ${RESET_START_DATE} to ${RESET_END_DATE}\n`);

  try {
    await db.query('BEGIN');

    // Track what we're deleting
    const deletions = [];

    // 1. Delete income records
    const incomeResult = await db.query(`
      DELETE FROM income 
      WHERE date >= $1 AND date < $2
      RETURNING id, date, amount, income_type, description
    `, [RESET_START_DATE, RESET_END_DATE]);
    
    if (incomeResult.rowCount > 0) {
      deletions.push(`✓ Deleted ${incomeResult.rowCount} income records`);
      incomeResult.rows.forEach(row => {
        console.log(`  - ${row.date.toISOString().split('T')[0]}: $${row.amount} (${row.income_type})`);
      });
    }

    // 2. Delete expense records (renamed from transactions table)
    const expenseResult = await db.query(`
      DELETE FROM expenses 
      WHERE date >= $1 AND date < $2
      RETURNING id, date, amount, category, name
    `, [RESET_START_DATE, RESET_END_DATE]);
    
    if (expenseResult.rowCount > 0) {
      deletions.push(`✓ Deleted ${expenseResult.rowCount} expense records`);
      if (expenseResult.rowCount <= 10) {
        expenseResult.rows.forEach(row => {
          console.log(`  - ${row.date.toISOString().split('T')[0]}: $${row.amount} - ${row.name} (${row.category})`);
        });
      } else {
        console.log(`  - (${expenseResult.rowCount} records deleted)`);
      }
    }

    // 3. Delete raw transactions
    const rawTransactionResult = await db.query(`
      DELETE FROM raw_transactions 
      WHERE posted_date >= $1 AND posted_date < $2
      RETURNING id, posted_date, amount, description
    `, [RESET_START_DATE, RESET_END_DATE]);
    
    if (rawTransactionResult.rowCount > 0) {
      deletions.push(`✓ Deleted ${rawTransactionResult.rowCount} raw transactions`);
    }

    // 4. Delete venmo emails first (they reference payment_requests)
    const venmoEmailResult = await db.query(`
      DELETE FROM venmo_emails 
      WHERE received_date >= $1 AND received_date < $2
         OR payment_request_id IN (
           SELECT id FROM payment_requests 
           WHERE year = 2025 AND month IN (7, 8)
         )
      RETURNING id, received_date, venmo_amount, venmo_actor, email_type
    `, [RESET_START_DATE, RESET_END_DATE]);
    
    if (venmoEmailResult.rowCount > 0) {
      deletions.push(`✓ Deleted ${venmoEmailResult.rowCount} Venmo emails`);
      if (venmoEmailResult.rowCount <= 10) {
        venmoEmailResult.rows.forEach(row => {
          console.log(`  - ${row.received_date.toISOString().split('T')[0]}: $${row.venmo_amount} from ${row.venmo_actor} (${row.email_type})`);
        });
      }
    }

    // 5. Delete payment requests (after venmo_emails)
    const paymentRequestResult = await db.query(`
      DELETE FROM payment_requests 
      WHERE (year = 2025 AND month IN (7, 8))
      RETURNING id, month, year, amount, roommate_name, bill_type, status
    `, []);
    
    if (paymentRequestResult.rowCount > 0) {
      deletions.push(`✓ Deleted ${paymentRequestResult.rowCount} payment requests`);
      paymentRequestResult.rows.forEach(row => {
        console.log(`  - ${row.year}-${String(row.month).padStart(2, '0')}: $${row.amount} from ${row.roommate_name} (${row.bill_type}) - ${row.status}`);
      });
    }

    // 6. Delete utility bills
    const utilityBillResult = await db.query(`
      DELETE FROM utility_bills 
      WHERE (year = 2025 AND month IN (7, 8))
      RETURNING id, month, year, total_amount, bill_type
    `, []);
    
    if (utilityBillResult.rowCount > 0) {
      deletions.push(`✓ Deleted ${utilityBillResult.rowCount} utility bills`);
      utilityBillResult.rows.forEach(row => {
        console.log(`  - ${row.year}-${String(row.month).padStart(2, '0')}: $${row.total_amount} (${row.bill_type})`);
      });
    }

    // 7. Delete sync history entries (if table exists)
    try {
      const syncHistoryResult = await db.query(`
        DELETE FROM sync_history 
        WHERE started_at >= $1 AND started_at < $2
        RETURNING id, started_at, sync_type
      `, [RESET_START_DATE, RESET_END_DATE]);
      
      if (syncHistoryResult.rowCount > 0) {
        deletions.push(`✓ Deleted ${syncHistoryResult.rowCount} sync history entries`);
      }
    } catch (err) {
      // Table might not exist, that's ok
      if (err.code !== '42P01') throw err;
    }

    // Commit if we deleted anything
    if (deletions.length > 0) {
      await db.query('COMMIT');
      
      console.log('\n📊 Summary:');
      deletions.forEach(deletion => console.log(`  ${deletion}`));
      
      console.log('\n✅ Demo data reset successfully!');
    } else {
      await db.query('ROLLBACK');
      console.log('ℹ️  No data found in July-August 2025 to delete');
    }

    // Show remaining data range
    const dateRange = await db.getOne(`
      SELECT 
        MIN(LEAST(
          (SELECT MIN(date) FROM income),
          (SELECT MIN(date) FROM expenses)
        )) as earliest_date,
        MAX(GREATEST(
          (SELECT MAX(date) FROM income WHERE date < $1),
          (SELECT MAX(date) FROM expenses WHERE date < $1)
        )) as latest_date
    `, [RESET_START_DATE]);

    if (dateRange.earliest_date && dateRange.latest_date) {
      console.log(`\n📅 Remaining data range: ${dateRange.earliest_date.toISOString().split('T')[0]} to ${dateRange.latest_date.toISOString().split('T')[0]}`);
    }

    // Show demo instructions
    console.log('\n🎬 Ready for demo! Next steps:');
    console.log('  1. Go to /sync page and click "Sync Now" to fetch July-August transactions');
    console.log('  2. Go to /review page to categorize the new transactions');
    console.log('  3. Go to /email-sync page and click "Sync Emails" to fetch Venmo confirmations');
    console.log('  4. Go to /payments page to see matched payments and handle unmatched ones');
    console.log('  5. Generate reports to show the complete financial picture');

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error resetting demo data:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Add command line confirmation bypass with --force flag
const forceFlag = process.argv.includes('--force');

if (!forceFlag) {
  const readline = require('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  console.log('⚠️  WARNING: This will delete all July and August 2025 data!');
  rl.question('Are you sure you want to continue? (yes/no): ', (answer) => {
    rl.close();
    if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
      resetDemoData();
    } else {
      console.log('❌ Operation cancelled');
      process.exit(0);
    }
  });
} else {
  // Run immediately with --force flag
  resetDemoData();
}

module.exports = resetDemoData;