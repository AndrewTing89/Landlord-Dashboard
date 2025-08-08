#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function removeDuplicateIncome() {
  console.log('🔍 Removing duplicate utility reimbursement income...\n');
  
  try {
    await db.query('BEGIN');
    
    // First, show what we're going to delete
    const toDelete = await db.query(`
      SELECT 
        id,
        amount,
        description,
        notes
      FROM income
      WHERE income_type = 'utility_reimbursement'
        AND payment_request_id IS NULL
      ORDER BY id
    `);
    
    console.log(`Found ${toDelete.rows.length} duplicate records to remove:`);
    let totalAmount = 0;
    toDelete.rows.forEach(row => {
      console.log(`  ID:${row.id} - $${row.amount} - ${row.description}`);
      totalAmount += parseFloat(row.amount);
    });
    console.log(`\nTotal duplicate amount: $${totalAmount.toFixed(2)}`);
    
    // Delete the duplicates
    const deleteResult = await db.query(`
      DELETE FROM income
      WHERE income_type = 'utility_reimbursement'
        AND payment_request_id IS NULL
      RETURNING id
    `);
    
    console.log(`\n✅ Deleted ${deleteResult.rows.length} duplicate records`);
    
    // Show the corrected totals
    const newTotals = await db.query(`
      SELECT 
        income_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income
      GROUP BY income_type
      ORDER BY income_type
    `);
    
    console.log('\n📊 Corrected Income Totals:');
    let grandTotal = 0;
    newTotals.rows.forEach(row => {
      console.log(`  ${row.income_type}: ${row.count} records, $${parseFloat(row.total).toFixed(2)}`);
      grandTotal += parseFloat(row.total);
    });
    console.log(`  TOTAL INCOME: $${grandTotal.toFixed(2)}`);
    
    await db.query('COMMIT');
    console.log('\n✅ Successfully removed duplicates!');
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Error:', error.message);
    throw error;
  }
  
  process.exit(0);
}

removeDuplicateIncome();