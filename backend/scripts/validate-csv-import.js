#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const db = require('../src/db/connection');

async function validateImport(csvFile) {
  console.log('=== CSV Import Validation ===\n');
  
  try {
    // Read CSV and extract key transactions with large amounts
    const fileContent = fs.readFileSync(csvFile, 'utf-8');
    const lines = fileContent.split('\n');
    
    // Find transactions with amounts > $1000 (likely important ones)
    const largeTransactions = [];
    let isTransactionSection = false;
    
    for (const line of lines) {
      if (!line.trim()) continue;
      
      if (line.startsWith('Date,Description,Amount,Running Bal.')) {
        isTransactionSection = true;
        continue;
      }
      
      if (!isTransactionSection) continue;
      
      // Parse line
      const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4}),/);
      if (dateMatch) {
        const date = dateMatch[1];
        const restOfLine = line.substring(date.length + 1);
        
        let description = '';
        let amountStr = '';
        
        if (restOfLine.startsWith('"')) {
          const endQuoteIndex = restOfLine.indexOf('",', 1);
          if (endQuoteIndex > -1) {
            description = restOfLine.substring(1, endQuoteIndex);
            const afterDescription = restOfLine.substring(endQuoteIndex + 2);
            
            if (afterDescription.startsWith('"')) {
              const amountEndQuote = afterDescription.indexOf('"', 1);
              if (amountEndQuote > -1) {
                amountStr = afterDescription.substring(1, amountEndQuote);
              }
            } else {
              amountStr = afterDescription.split(',')[0];
            }
          }
        }
        
        const amount = parseFloat(amountStr.replace(/[",]/g, ''));
        
        // Track large transactions
        if (Math.abs(amount) >= 1000) {
          largeTransactions.push({
            date,
            description: description.substring(0, 60),
            csvAmount: amount
          });
        }
      }
    }
    
    console.log(`Found ${largeTransactions.length} transactions >= $1000 in CSV\n`);
    
    // Compare with database
    let mismatches = 0;
    
    for (const csvTx of largeTransactions) {
      // Convert date format
      const [month, day, year] = csvTx.date.split('/');
      const dbDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      // Check in raw_transactions first
      const rawResult = await db.getOne(
        `SELECT amount, description, processed 
         FROM raw_transactions 
         WHERE posted_date = $1 
         AND ABS(amount - $2) < 0.01`,
        [dbDate, csvTx.csvAmount]
      );
      
      // Check in transactions table
      const txResult = await db.getOne(
        `SELECT amount, name, expense_type 
         FROM transactions 
         WHERE date = $1 
         AND ABS(amount - $2) < 0.01`,
        [dbDate, Math.abs(csvTx.csvAmount)]
      );
      
      if (!rawResult && !txResult) {
        console.log('❌ MISSING:');
        console.log(`   Date: ${csvTx.date}`);
        console.log(`   Description: ${csvTx.description}...`);
        console.log(`   CSV Amount: $${csvTx.csvAmount}`);
        console.log('');
        mismatches++;
      } else if (rawResult && Math.abs(rawResult.amount - csvTx.csvAmount) > 0.01) {
        console.log('⚠️  AMOUNT MISMATCH:');
        console.log(`   Date: ${csvTx.date}`);
        console.log(`   Description: ${csvTx.description}...`);
        console.log(`   CSV Amount: $${csvTx.csvAmount}`);
        console.log(`   DB Amount: $${rawResult.amount}`);
        console.log('');
        mismatches++;
      } else {
        // Check if it's the property tax specifically
        if (csvTx.description.includes('Santa Clara DTAC')) {
          console.log('✅ PROPERTY TAX VERIFIED:');
          console.log(`   Date: ${csvTx.date}`);
          console.log(`   CSV Amount: $${csvTx.csvAmount}`);
          console.log(`   DB Amount: $${rawResult ? rawResult.amount : txResult.amount}`);
          console.log(`   Status: ${rawResult ? (rawResult.processed ? 'Auto-approved' : 'Pending review') : 'Approved'}`);
          console.log('');
        }
      }
    }
    
    // Summary
    console.log('=== Summary ===');
    console.log(`Large transactions (>=$1000): ${largeTransactions.length}`);
    console.log(`Mismatches found: ${mismatches}`);
    
    if (mismatches === 0) {
      console.log('\n✅ All large transactions imported correctly!');
    } else {
      console.log('\n❌ Some transactions have issues - please review');
    }
    
    // Check specific known issues
    console.log('\n=== Specific Checks ===');
    
    // Check Santa Clara DTAC
    const santaClaraResult = await db.getOne(
      `SELECT amount, description, suggested_expense_type, processed 
       FROM raw_transactions 
       WHERE description ILIKE '%santa clara dtac%'`
    );
    
    if (santaClaraResult) {
      console.log('Property Tax (Santa Clara DTAC):');
      console.log(`  Amount: $${santaClaraResult.amount} (should be -5324.73)`);
      console.log(`  Type: ${santaClaraResult.suggested_expense_type}`);
      console.log(`  Status: ${santaClaraResult.processed ? 'Auto-approved' : 'Needs review'}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Run validation
validateImport('../bofa history.csv');