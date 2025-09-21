#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function checkAllTransactions() {
  try {
    console.log('Checking all transactions from May 2025...\n');
    
    // Check all transactions from May 2025 onwards
    const transactions = await db.query(
      `SELECT id, name, merchant_name, amount, date, expense_type, category, subcategory
       FROM expenses 
       WHERE date >= '2025-05-01'
       ORDER BY date DESC
       LIMIT 20`
    );
    
    console.log(`Found ${transactions.rows.length} transactions since May 2025 (showing first 20):`);
    transactions.rows.forEach(t => {
      console.log(`\n- ID: ${t.id}`);
      console.log(`  Name: ${t.name}`);
      console.log(`  Merchant: ${t.merchant_name}`);
      console.log(`  Amount: $${Math.abs(t.amount)}`);
      console.log(`  Date: ${new Date(t.date).toISOString().split('T')[0]}`);
      console.log(`  Expense Type: ${t.expense_type}`);
      console.log(`  Category: ${t.category}`);
      console.log(`  Subcategory: ${t.subcategory}`);
    });
    
    // Check specifically for PG&E and water transactions
    console.log('\n\nLooking for utility-like transactions...');
    const utilityLike = await db.query(
      `SELECT id, name, merchant_name, amount, date, expense_type, category
       FROM expenses 
       WHERE date >= '2025-05-01'
       AND (
         LOWER(name) LIKE '%pg&e%' OR 
         LOWER(name) LIKE '%pacific gas%' OR 
         LOWER(name) LIKE '%water%' OR
         LOWER(name) LIKE '%great oaks%' OR
         LOWER(merchant_name) LIKE '%pg&e%' OR
         LOWER(merchant_name) LIKE '%water%'
       )
       ORDER BY date DESC`
    );
    
    console.log(`\nFound ${utilityLike.rows.length} utility-like transactions:`);
    utilityLike.rows.forEach(t => {
      console.log(`\n- ID: ${t.id}`);
      console.log(`  Name: ${t.name}`);
      console.log(`  Merchant: ${t.merchant_name}`);
      console.log(`  Amount: $${Math.abs(t.amount)}`);
      console.log(`  Date: ${new Date(t.date).toISOString().split('T')[0]}`);
      console.log(`  Type: ${t.expense_type}`);
      console.log(`  Category: ${t.category}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkAllTransactions();