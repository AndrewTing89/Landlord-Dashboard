#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function checkRecentTransactions() {
  try {
    console.log('Checking for June/July 2025 transactions...\n');
    
    // Check raw_transactions first
    const rawTx = await db.query(
      `SELECT COUNT(*) as count, MIN(posted_date) as min_date, MAX(posted_date) as max_date,
              SUM(CASE WHEN processed = true THEN 1 ELSE 0 END) as processed_count,
              SUM(CASE WHEN processed = false THEN 1 ELSE 0 END) as unprocessed_count
       FROM raw_transactions 
       WHERE posted_date >= '2025-06-01'`
    );
    
    console.log('Raw transactions (from SimpleFIN):');
    console.log(`  - Count: ${rawTx.rows[0].count}`);
    if (rawTx.rows[0].count > 0) {
      console.log(`  - Date range: ${new Date(rawTx.rows[0].min_date).toLocaleDateString()} to ${new Date(rawTx.rows[0].max_date).toLocaleDateString()}`);
      console.log(`  - Processed: ${rawTx.rows[0].processed_count}`);
      console.log(`  - Unprocessed: ${rawTx.rows[0].unprocessed_count}`);
    }
    
    // Check processed transactions
    const procTx = await db.query(
      `SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date
       FROM expenses 
       WHERE date >= '2025-06-01'`
    );
    
    console.log('\nProcessed transactions:');
    console.log(`  - Count: ${procTx.rows[0].count}`);
    if (procTx.rows[0].count > 0) {
      console.log(`  - Date range: ${new Date(procTx.rows[0].min_date).toLocaleDateString()} to ${new Date(procTx.rows[0].max_date).toLocaleDateString()}`);
    }
    
    // Check specific utility transactions
    const utilityTx = await db.query(
      `SELECT date, name, merchant_name, amount, expense_type 
       FROM expenses 
       WHERE date >= '2025-06-01' 
       AND (expense_type IN ('electricity', 'water') OR 
            LOWER(name) LIKE '%pgande%' OR 
            LOWER(name) LIKE '%water%')
       ORDER BY date DESC`
    );
    
    console.log(`\nUtility transactions found: ${utilityTx.rows.length}`);
    utilityTx.rows.forEach(t => {
      console.log(`  - ${new Date(t.date).toLocaleDateString()}: ${t.name} ($${Math.abs(t.amount)}) [${t.expense_type}]`);
    });
    
    // Check recent sync history
    const syncHistory = await db.query(
      `SELECT sync_type, status, started_at, completed_at, transactions_imported, bills_processed
       FROM sync_history 
       ORDER BY started_at DESC 
       LIMIT 5`
    );
    
    console.log('\nRecent sync history:');
    syncHistory.rows.forEach(s => {
      console.log(`  - ${new Date(s.started_at).toLocaleString()}: ${s.sync_type} - ${s.status}`);
      console.log(`    Transactions: ${s.transactions_imported || 0}, Bills: ${s.bills_processed || 0}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkRecentTransactions();