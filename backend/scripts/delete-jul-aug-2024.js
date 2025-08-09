#!/usr/bin/env node

/**
 * Delete July and August 2024 data for demo purposes
 * This removes sensitive recent data while keeping older data for demonstration
 */

require('dotenv').config();
const db = require('../src/db/connection');

async function deleteJulAug2024() {
  try {
    console.log('🗑️  Deleting July and August 2024 data for demo...\n');

    // Start transaction
    await db.query('BEGIN');

    // Delete income records
    const incomeResult = await db.query(`
      DELETE FROM income 
      WHERE date >= '2024-07-01' AND date < '2024-09-01'
      RETURNING id, date, amount, income_type
    `);
    console.log(`✓ Deleted ${incomeResult.rowCount} income records`);

    // Delete expense records  
    const expenseResult = await db.query(`
      DELETE FROM expenses 
      WHERE date >= '2024-07-01' AND date < '2024-09-01'
      RETURNING id, date, amount, expense_type
    `);
    console.log(`✓ Deleted ${expenseResult.rowCount} expense records`);


    // Delete raw transactions
    const rawTransactionResult = await db.query(`
      DELETE FROM raw_transactions 
      WHERE posted_date >= '2024-07-01' AND posted_date < '2024-09-01'
      RETURNING id, posted_date, amount
    `);
    console.log(`✓ Deleted ${rawTransactionResult.rowCount} raw transactions`);

    // Delete payment requests
    const paymentRequestResult = await db.query(`
      DELETE FROM payment_requests 
      WHERE (year = 2024 AND month IN (7, 8))
      RETURNING id, month, year, amount
    `);
    console.log(`✓ Deleted ${paymentRequestResult.rowCount} payment requests`);

    // Delete utility bills
    const utilityBillResult = await db.query(`
      DELETE FROM utility_bills 
      WHERE (year = 2024 AND month IN (7, 8))
      RETURNING id, month, year, total_amount, bill_type
    `);
    console.log(`✓ Deleted ${utilityBillResult.rowCount} utility bills`);

    // Delete venmo emails from this period
    const venmoEmailResult = await db.query(`
      DELETE FROM venmo_emails 
      WHERE received_date >= '2024-07-01' AND received_date < '2024-09-01'
      RETURNING id, received_date, venmo_amount
    `);
    console.log(`✓ Deleted ${venmoEmailResult.rowCount} Venmo emails`);

    // Show summary
    console.log('\n📊 Summary:');
    console.log(`  Income records: ${incomeResult.rowCount}`);
    console.log(`  Expense records: ${expenseResult.rowCount}`);
    console.log(`  Raw transactions: ${rawTransactionResult.rowCount}`);
    console.log(`  Payment requests: ${paymentRequestResult.rowCount}`);
    console.log(`  Utility bills: ${utilityBillResult.rowCount}`);
    console.log(`  Venmo emails: ${venmoEmailResult.rowCount}`);

    // Commit transaction
    await db.query('COMMIT');
    console.log('\n✅ Successfully deleted July and August 2024 data');

    // Show remaining data range
    const dateRange = await db.getOne(`
      SELECT 
        MIN(LEAST(
          (SELECT MIN(date) FROM income),
          (SELECT MIN(date) FROM expenses)
        )) as earliest_date,
        MAX(GREATEST(
          (SELECT MAX(date) FROM income WHERE date < '2024-07-01'),
          (SELECT MAX(date) FROM expenses WHERE date < '2024-07-01')
        )) as latest_date
    `);

    if (dateRange.earliest_date && dateRange.latest_date) {
      console.log(`\n📅 Remaining data range: ${dateRange.earliest_date.toISOString().split('T')[0]} to ${dateRange.latest_date.toISOString().split('T')[0]}`);
    }

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error deleting data:', error);
    process.exit(1);
  } finally {
    // Database connection is managed by the connection pool
    process.exit(0);
  }
}

// Run if called directly
if (require.main === module) {
  deleteJulAug2024();
}

module.exports = deleteJulAug2024;