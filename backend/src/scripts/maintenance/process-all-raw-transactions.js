#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function processAllRawTransactions() {
  try {
    console.log('Processing all pending raw transactions...\n');
    
    // Get ETL rules
    const etlRules = await db.query(
      `SELECT * FROM etl_rules WHERE active = true ORDER BY priority ASC`
    );
    
    console.log(`Found ${etlRules.rows.length} active ETL rules\n`);
    
    // Get pending raw transactions
    const pendingTransactions = await db.query(
      `SELECT * FROM raw_transactions 
       WHERE processed = false AND excluded = false
       ORDER BY posted_date DESC`
    );
    
    console.log(`Found ${pendingTransactions.rows.length} pending transactions to process\n`);
    
    let processedCount = 0;
    let utilityCount = 0;
    
    for (const rawTx of pendingTransactions.rows) {
      let matched = false;
      
      // Try to match against ETL rules
      for (const rule of etlRules.rows) {
        const pattern = new RegExp(rule.pattern, 'i');
        const textToMatch = rawTx.description + ' ' + (rawTx.payee || '');
        
        if (pattern.test(textToMatch)) {
          // Insert into transactions table
          await db.query(
            `INSERT INTO transactions (
              plaid_transaction_id, plaid_account_id, amount, date, 
              name, merchant_name, expense_type, category, subcategory
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            ON CONFLICT (plaid_transaction_id) DO NOTHING`,
            [
              'simplefin_' + rawTx.simplefin_id,
              rawTx.simplefin_account_id,
              Math.abs(rawTx.amount),
              rawTx.posted_date,
              rawTx.description,
              rule.merchant_name || rawTx.payee,
              rule.expense_type,
              rule.category,
              rule.subcategory
            ]
          );
          
          // Mark as processed
          await db.query(
            `UPDATE raw_transactions 
             SET processed = true, processed_at = NOW(), 
                 suggested_expense_type = $1, suggested_merchant = $2
             WHERE id = $3`,
            [rule.expense_type, rule.merchant_name, rawTx.id]
          );
          
          matched = true;
          processedCount++;
          
          if (rule.expense_type === 'electricity' || rule.expense_type === 'water') {
            utilityCount++;
            console.log(`  ✅ Processed ${rule.expense_type} bill: ${rawTx.description} ($${Math.abs(rawTx.amount)})`);
          }
          
          break;
        }
      }
      
      if (!matched) {
        // If no rule matches, insert as 'other' for manual review
        await db.query(
          `INSERT INTO transactions (
            plaid_transaction_id, plaid_account_id, amount, date, 
            name, merchant_name, expense_type, category
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
          ON CONFLICT (plaid_transaction_id) DO NOTHING`,
          [
            'simplefin_' + rawTx.simplefin_id,
            rawTx.simplefin_account_id,
            Math.abs(rawTx.amount),
            rawTx.posted_date,
            rawTx.description,
            rawTx.payee,
            'other',
            'Manual Review'
          ]
        );
        
        processedCount++;
      }
    }
    
    console.log(`\n✅ Processing complete:`);
    console.log(`   - Total processed: ${processedCount}`);
    console.log(`   - Utility bills found: ${utilityCount}`);
    
    // Show utility transactions
    const utilityTx = await db.query(
      `SELECT date, name, merchant_name, amount, expense_type 
       FROM transactions 
       WHERE expense_type IN ('electricity', 'water')
       AND date >= '2025-06-01'
       ORDER BY date DESC`
    );
    
    if (utilityTx.rows.length > 0) {
      console.log('\nUtility transactions in June/July:');
      utilityTx.rows.forEach(tx => {
        console.log(`  - ${new Date(tx.date).toLocaleDateString()}: ${tx.expense_type} - $${tx.amount}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

processAllRawTransactions();