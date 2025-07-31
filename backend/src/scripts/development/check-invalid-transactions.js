#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function checkInvalidTransactions() {
  try {
    console.log('Checking for transactions with invalid data...\n');
    
    // Check for null/invalid dates
    const invalidDates = await db.query(
      `SELECT id, name, date, amount, expense_type 
       FROM transactions 
       WHERE date IS NULL OR date > CURRENT_DATE + INTERVAL '1 year'
       OR date < '2020-01-01'`
    );
    
    if (invalidDates.rows.length > 0) {
      console.log(`Found ${invalidDates.rows.length} transactions with invalid dates:`);
      invalidDates.rows.forEach(tx => {
        console.log(`  - ID ${tx.id}: ${tx.name} (${tx.date})`);
      });
    }
    
    // Check for invalid amounts
    const invalidAmounts = await db.query(
      `SELECT id, name, amount, expense_type 
       FROM transactions 
       WHERE amount IS NULL OR amount < 0 OR amount > 1000000`
    );
    
    if (invalidAmounts.rows.length > 0) {
      console.log(`\nFound ${invalidAmounts.rows.length} transactions with invalid amounts:`);
      invalidAmounts.rows.forEach(tx => {
        console.log(`  - ID ${tx.id}: ${tx.name} ($${tx.amount})`);
      });
    }
    
    // Check for very long strings that might cause issues
    const longStrings = await db.query(
      `SELECT id, name, LENGTH(name) as name_length, LENGTH(merchant_name) as merchant_length
       FROM transactions 
       WHERE LENGTH(name) > 500 OR LENGTH(merchant_name) > 500`
    );
    
    if (longStrings.rows.length > 0) {
      console.log(`\nFound ${longStrings.rows.length} transactions with very long strings:`);
      longStrings.rows.forEach(tx => {
        console.log(`  - ID ${tx.id}: name length=${tx.name_length}, merchant length=${tx.merchant_length}`);
      });
    }
    
    // Check for special characters that might break JSON
    const specialChars = await db.query(
      `SELECT id, name, merchant_name 
       FROM transactions 
       WHERE name ~ '[\\x00-\\x1F]' OR merchant_name ~ '[\\x00-\\x1F]'
       LIMIT 10`
    );
    
    if (specialChars.rows.length > 0) {
      console.log(`\nFound transactions with control characters:`);
      specialChars.rows.forEach(tx => {
        console.log(`  - ID ${tx.id}: ${JSON.stringify(tx.name)}`);
      });
    }
    
    if (invalidDates.rows.length === 0 && invalidAmounts.rows.length === 0 && 
        longStrings.rows.length === 0 && specialChars.rows.length === 0) {
      console.log('✅ No invalid transactions found');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkInvalidTransactions();