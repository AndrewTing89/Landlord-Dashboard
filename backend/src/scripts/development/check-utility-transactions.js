#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function checkUtilityTransactions() {
  try {
    console.log('Checking utility transactions...\n');
    
    // Check all utility transactions from May 2025 onwards
    const transactions = await db.query(
      `SELECT id, name, merchant_name, amount, date, expense_type 
       FROM transactions 
       WHERE expense_type = 'utility' 
       AND date >= '2025-05-01'
       ORDER BY date DESC`
    );
    
    console.log(`Found ${transactions.rows.length} utility transactions since May 2025:`);
    transactions.rows.forEach(t => {
      console.log(`\n- ID: ${t.id}`);
      console.log(`  Name: ${t.name}`);
      console.log(`  Merchant: ${t.merchant_name}`);
      console.log(`  Amount: $${Math.abs(t.amount)}`);
      console.log(`  Date: ${new Date(t.date).toISOString().split('T')[0]}`);
      console.log(`  Type: ${t.expense_type}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkUtilityTransactions();