#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function checkDuplicateBills() {
  try {
    // Check for duplicate payment requests
    console.log('Checking for duplicate payment requests...\n');
    
    const duplicates = await db.query(`
      SELECT 
        bill_type,
        merchant_name, 
        month, 
        year, 
        COUNT(*) as count,
        STRING_AGG(id::text, ', ') as ids,
        STRING_AGG(TO_CHAR(created_at, 'YYYY-MM-DD HH24:MI:SS'), ', ') as created_dates
      FROM payment_requests 
      WHERE bill_type IN ('electricity', 'water')
      GROUP BY bill_type, merchant_name, month, year 
      HAVING COUNT(*) > 1 
      ORDER BY year DESC, month DESC, bill_type
    `);
    
    if (duplicates.rows.length === 0) {
      console.log('✅ No duplicate payment requests found.\n');
    } else {
      console.log(`⚠️  Found ${duplicates.rows.length} duplicate payment request groups:\n`);
      duplicates.rows.forEach(dup => {
        console.log(`${dup.bill_type.toUpperCase()} - ${dup.merchant_name}`);
        console.log(`  Month/Year: ${dup.month}/${dup.year}`);
        console.log(`  Count: ${dup.count} duplicates`);
        console.log(`  IDs: ${dup.ids}`);
        console.log(`  Created: ${dup.created_dates}`);
        console.log('');
      });
    }
    
    // Check recent transactions to understand the issue
    console.log('Recent utility transactions (last 60 days):\n');
    
    const recentTransactions = await db.query(`
      SELECT 
        t.id,
        t.date,
        t.merchant_name,
        t.name,
        t.expense_type,
        t.amount,
        t.created_at,
        EXISTS (
          SELECT 1 FROM payment_requests pr 
          WHERE pr.merchant_name = t.merchant_name 
          AND pr.month = EXTRACT(MONTH FROM t.date)
          AND pr.year = EXTRACT(YEAR FROM t.date)
        ) as has_payment_request
      FROM transactions t
      WHERE t.expense_type IN ('electricity', 'water')
      AND t.date >= CURRENT_DATE - INTERVAL '60 days'
      ORDER BY t.date DESC
    `);
    
    recentTransactions.rows.forEach(tx => {
      console.log(`${tx.date} - ${tx.expense_type}: $${tx.amount}`);
      console.log(`  Merchant: ${tx.merchant_name || tx.name}`);
      console.log(`  Has Payment Request: ${tx.has_payment_request ? 'Yes' : 'No'}`);
      console.log(`  Transaction Created: ${tx.created_at}`);
      console.log('');
    });
    
    // Check the sync query logic
    console.log('Checking which transactions would trigger new payment requests...\n');
    
    const wouldCreateRequests = await db.query(`
      SELECT t.* FROM transactions t
      WHERE t.expense_type IN ('electricity', 'water')
      AND NOT EXISTS (
        SELECT 1 FROM payment_requests pr 
        WHERE pr.merchant_name = t.merchant_name 
        AND pr.month = EXTRACT(MONTH FROM t.date)
        AND pr.year = EXTRACT(YEAR FROM t.date)
      )
      AND t.date >= CURRENT_DATE - INTERVAL '30 days'
      ORDER BY t.date DESC
    `);
    
    if (wouldCreateRequests.rows.length > 0) {
      console.log(`⚠️  ${wouldCreateRequests.rows.length} transactions would create new payment requests:\n`);
      wouldCreateRequests.rows.forEach(tx => {
        console.log(`- ${tx.date} - ${tx.expense_type}: $${tx.amount} (${tx.merchant_name || tx.name})`);
      });
    } else {
      console.log('✅ No transactions would create new payment requests.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkDuplicateBills();