#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function deleteJunJulData() {
  try {
    console.log('Deleting June and July 2025 data...\n');
    
    // Delete payment requests
    const prResult = await db.query(
      `DELETE FROM payment_requests 
       WHERE (month = 6 OR month = 7) AND year = 2025
       RETURNING id, month, year, bill_type`
    );
    console.log(`✅ Deleted ${prResult.rowCount} payment requests`);
    
    // Delete transactions
    const txResult = await db.query(
      `DELETE FROM transactions 
       WHERE date >= '2025-06-01' AND date < '2025-08-01'
       RETURNING id`
    );
    console.log(`✅ Deleted ${txResult.rowCount} transactions`);
    
    // Show remaining data summary
    const remainingPR = await db.query(
      `SELECT month, year, COUNT(*) as count 
       FROM payment_requests 
       WHERE year = 2025
       GROUP BY month, year 
       ORDER BY month DESC`
    );
    
    console.log('\nRemaining payment requests:');
    remainingPR.rows.forEach(row => {
      console.log(`  - ${row.month}/${row.year}: ${row.count} requests`);
    });
    
    const remainingTx = await db.query(
      `SELECT COUNT(*) as count, MIN(date) as min_date, MAX(date) as max_date
       FROM transactions 
       WHERE date >= '2025-01-01'`
    );
    
    if (remainingTx.rows[0].count > 0) {
      console.log(`\nRemaining transactions: ${remainingTx.rows[0].count}`);
      console.log(`  - Date range: ${new Date(remainingTx.rows[0].min_date).toLocaleDateString()} to ${new Date(remainingTx.rows[0].max_date).toLocaleDateString()}`);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

deleteJunJulData();