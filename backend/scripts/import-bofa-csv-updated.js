#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const db = require('../src/db/connection');
const simplefinService = require('../src/services/simplefinService');

async function importBofaCSV(filePath) {
  console.log('=== Importing Bank of America CSV (Updated Schema) ===\n');
  console.log(`File: ${filePath}`);
  
  try {
    // Read and parse CSV
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const records = [];
    let isTransactionSection = false;
    
    // Parse CSV manually to handle BofA's specific format
    const lines = fileContent.split('\n');
    for (const line of lines) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Look for the transaction header
      if (line.startsWith('Date,Description,Amount,Running Bal.')) {
        isTransactionSection = true;
        continue;
      }
      
      // Skip non-transaction lines
      if (!isTransactionSection) continue;
      
      // Parse transaction line - handle quoted fields with commas
      const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4}),/);
      if (dateMatch) {
        const date = dateMatch[1];
        
        // Extract the rest after the date
        const restOfLine = line.substring(date.length + 1);
        
        // Find the description (quoted field)
        let description = '';
        let amountStr = '';
        let balanceStr = '';
        
        if (restOfLine.startsWith('"')) {
          // Find the closing quote for description
          const endQuoteIndex = restOfLine.indexOf('",', 1);
          if (endQuoteIndex !== -1) {
            description = restOfLine.substring(1, endQuoteIndex);
            const remainingLine = restOfLine.substring(endQuoteIndex + 2);
            const parts = remainingLine.split(',');
            amountStr = parts[0] || '0';
            balanceStr = parts[1] || '0';
          }
        } else {
          // Simple comma-separated format
          const parts = restOfLine.split(',');
          description = parts[0] || '';
          amountStr = parts[1] || '0';
          balanceStr = parts[2] || '0';
        }
        
        // Clean and parse amount and balance (remove quotes and commas)
        const amount = amountStr.replace(/[",]/g, '');
        const runningBalance = balanceStr.replace(/[",]/g, '');
        
        // Skip balance entries
        if (description.includes('Beginning balance') || description.includes('Ending balance')) {
          continue;
        }
        
        records.push({
          date,
          description,
          amount: parseFloat(amount) || 0,
          runningBalance: parseFloat(runningBalance) || 0
        });
      }
    }
    
    console.log(`\nFound ${records.length} transactions to import\n`);
    
    let imported = 0;
    let skipped = 0;
    let autoApproved = 0;
    
    // Process each transaction
    for (const record of records) {
      try {
        // Convert date from MM/DD/YYYY to YYYY-MM-DD
        const [month, day, year] = record.date.split('/');
        const dateString = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
        
        // Create a unique SimpleFIN-style ID for BofA CSV imports
        const transactionId = `bofa_csv_${dateString}_${Math.abs(record.amount)}_${record.description.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`;
        
        // Check if transaction already exists
        const existing = await db.getOne(
          `SELECT id FROM raw_transactions 
           WHERE simplefin_id = $1`,
          [transactionId]
        );
        
        if (existing) {
          skipped++;
          console.log(`[Skipped] Duplicate: ${record.description}`);
          continue;
        }
        
        // Create a transaction object for ETL processing
        const transaction = {
          id: transactionId,
          description: record.description,
          amount: record.amount,
          posted: new Date(dateString).getTime() / 1000,
          payee: extractPayee(record.description),
          category: null
        };
        
        // Apply ETL rules to get suggestions
        const suggestions = await simplefinService.applyETLRules(transaction);
        
        // Save to raw_transactions table (using current schema)
        await db.insert('raw_transactions', {
          simplefin_id: transactionId,
          simplefin_account_id: 'bofa_checking_csv',
          amount: record.amount,
          posted_date: dateString,
          description: record.description,
          payee: transaction.payee,
          category: null,
          suggested_expense_type: suggestions.expense_type,
          suggested_merchant: suggestions.merchant,
          confidence_score: suggestions.confidence,
          excluded: suggestions.excluded,
          exclude_reason: suggestions.exclude_reason,
          processed: suggestions.auto_approve || (record.amount > 0) // Mark deposits as processed
        });
        
        // If auto-approved and it's an expense (negative amount), create expense record
        if (suggestions.auto_approve && !suggestions.excluded && record.amount < 0) {
          await db.insert('expenses', {
            simplefin_transaction_id: `csv_${transactionId}`,
            simplefin_account_id: 'bofa_checking_csv',
            amount: Math.abs(record.amount),
            date: dateString,
            name: record.description,
            merchant_name: suggestions.merchant || transaction.payee || extractMerchant(record.description),
            expense_type: suggestions.expense_type || 'other',
            category: 'CSV Import'
          });
          
          autoApproved++;
          console.log(`[Auto-Approved] ${record.description} -> ${suggestions.expense_type} ($${Math.abs(record.amount)})`);
        } else if (record.amount > 0) {
          console.log(`[Income] ${record.description} (+$${record.amount}) - marked as processed`);
        } else {
          console.log(`[Needs Review] ${record.description} ($${record.amount}) - confidence: ${suggestions.confidence}`);
        }
        
        imported++;
        
        // Log progress every 25 transactions
        if (imported % 25 === 0) {
          console.log(`Progress: ${imported} imported, ${skipped} skipped, ${autoApproved} auto-approved...`);
        }
        
      } catch (error) {
        console.error(`Error processing transaction: ${record.description}`, error);
      }
    }
    
    console.log('\n=== Import Summary ===');
    console.log(`Total transactions processed: ${imported}`);
    console.log(`Skipped (duplicates): ${skipped}`);
    console.log(`Auto-approved expenses: ${autoApproved}`);
    console.log(`Need manual review: ${imported - autoApproved - records.filter(r => r.amount > 0).length}`);
    console.log(`Income entries: ${records.filter(r => r.amount > 0).length}`);
    
  } catch (error) {
    console.error('Error importing CSV:', error);
  } finally {
    process.exit(0);
  }
}

// Helper functions
function extractPayee(description) {
  // Extract payee from description
  const cleanDesc = description.replace(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}|\#\d+/g, '').trim();
  
  // Handle common BofA formats
  if (cleanDesc.includes('CHECKCARD')) {
    const parts = cleanDesc.split('CHECKCARD')[1];
    return parts ? parts.trim().split(' ')[0] : null;
  }
  
  if (cleanDesc.includes('ACH')) {
    const parts = cleanDesc.split('ACH')[1];
    return parts ? parts.trim().split(' ')[0] : null;
  }
  
  // Return first few words as payee
  const words = cleanDesc.split(' ').filter(w => w.length > 0);
  return words.slice(0, 3).join(' ') || null;
}

function extractMerchant(description) {
  // Extract merchant name from description
  const cleanDesc = description.replace(/[0-9]/g, '').trim();
  const parts = cleanDesc.split(/\s+/);
  return parts.slice(0, 3).join(' ');
}

// Get file path from command line arguments
const filePath = process.argv[2];
if (!filePath) {
  console.error('Please provide a CSV file path:');
  console.error('node scripts/import-bofa-csv-updated.js "/path/to/file.csv"');
  process.exit(1);
}

importBofaCSV(filePath);