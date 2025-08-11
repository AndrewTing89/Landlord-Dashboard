#!/usr/bin/env node

require('dotenv').config();
const fs = require('fs');
const csv = require('csv-parse');
const db = require('../src/db/connection');
const simplefinService = require('../src/services/simplefinService');
const { generateTrackingId } = require('../src/utils/trackingId');

async function importBofaCSV(filePath) {
  console.log('=== Importing Bank of America CSV ===\n');
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
          if (endQuoteIndex > -1) {
            description = restOfLine.substring(1, endQuoteIndex);
            const afterDescription = restOfLine.substring(endQuoteIndex + 2);
            
            // Now parse amount and balance which may also be quoted
            // Look for quoted amount first
            if (afterDescription.startsWith('"')) {
              const amountEndQuote = afterDescription.indexOf('"', 1);
              if (amountEndQuote > -1) {
                amountStr = afterDescription.substring(1, amountEndQuote);
                // Balance should be after the comma
                const afterAmount = afterDescription.substring(amountEndQuote + 1);
                const balanceMatch = afterAmount.match(/,"([^"]+)"/);
                if (balanceMatch) {
                  balanceStr = balanceMatch[1];
                }
              }
            } else {
              // Amount not quoted, split by comma
              const parts = afterDescription.split(',');
              amountStr = parts[0];
              balanceStr = parts[1] || '';
            }
          }
        } else {
          // No quotes, simple split
          const parts = restOfLine.split(',');
          description = parts[0];
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
        
        // Create a transaction object similar to SimpleFIN format
        const transaction = {
          id: `bofa_csv_${dateString}_${Math.abs(record.amount)}_${record.description.substring(0, 10)}`,
          description: record.description,
          amount: record.amount,
          posted: new Date(dateString).getTime() / 1000,
          payee: extractPayee(record.description)
        };
        
        // Check if transaction already exists
        const existing = await db.getOne(
          `SELECT id FROM raw_transactions 
           WHERE simplefin_id = $1`,
          [transaction.id]
        );
        
        if (existing) {
          skipped++;
          continue;
        }
        
        // Apply ETL rules to get suggestions
        const suggestions = await simplefinService.applyETLRules(transaction);
        
        // Save to raw_transactions
        await db.insert('raw_transactions', {
          simplefin_id: transaction.id,
          simplefin_account_id: 'bofa_checking',
          amount: transaction.amount,
          posted_date: dateString,
          description: transaction.description,
          payee: transaction.payee,
          category: null,
          suggested_expense_type: suggestions.expense_type,
          suggested_merchant: suggestions.merchant,
          confidence_score: suggestions.confidence,
          excluded: suggestions.excluded,
          exclude_reason: suggestions.exclude_reason,
          processed: suggestions.auto_approve || false
        });
        
        // If auto-approved, also insert into expenses table
        if (suggestions.auto_approve && !suggestions.excluded && transaction.amount < 0) {
          await db.insert('expenses', {
            simplefin_transaction_id: `csv_${transaction.id}`,
            simplefin_account_id: 'bofa_checking',
            amount: Math.abs(transaction.amount),
            date: dateString,
            name: transaction.description,
            merchant_name: suggestions.merchant || transaction.payee || extractMerchant(transaction.description),
            expense_type: suggestions.expense_type || 'other',
            category: 'Other',
            subcategory: null
          });
          
          autoApproved++;
          console.log(`[Auto-Approved] ${transaction.description} -> ${suggestions.expense_type}`);
        }
        
        imported++;
        
        // Log progress every 50 transactions
        if (imported % 50 === 0) {
          console.log(`Progress: ${imported} imported, ${skipped} skipped...`);
        }
        
      } catch (error) {
        console.error(`Error processing transaction: ${record.description}`, error.message);
      }
    }
    
    console.log('\n=== Import Complete ===');
    console.log(`Total transactions: ${records.length}`);
    console.log(`Imported: ${imported}`);
    console.log(`Auto-approved: ${autoApproved}`);
    console.log(`Skipped (duplicates): ${skipped}`);
    console.log(`Pending review: ${imported - autoApproved}`);
    
    // Now check for bills that need payment requests
    console.log('\n=== Checking for Payment Requests ===');
    
    const newBills = await db.query(
      `SELECT t.* FROM transactions t
       WHERE t.expense_type IN ('electricity', 'water')
       AND NOT EXISTS (
         SELECT 1 FROM payment_requests pr 
         WHERE pr.merchant_name = t.merchant_name 
         AND pr.month = EXTRACT(MONTH FROM t.date)
         AND pr.year = EXTRACT(YEAR FROM t.date)
       )
       ORDER BY t.date DESC`
    );
    
    console.log(`Found ${newBills.rows.length} bills that need payment requests`);
    
    for (const bill of newBills.rows) {
      const billMonth = new Date(bill.date).getMonth() + 1;
      const billYear = new Date(bill.date).getFullYear();
      const trackingId = generateTrackingId(billMonth, billYear, bill.expense_type);
      
      const totalAmount = parseFloat(bill.amount);
      const splitAmount = (totalAmount / 3).toFixed(2);
      
      await db.insert('payment_requests', {
        bill_type: bill.expense_type,
        merchant_name: bill.merchant_name || bill.name,
        amount: splitAmount,
        total_amount: totalAmount.toFixed(2),
        venmo_username: '@UshiLo',
        roommate_name: 'UshiLo',
        status: 'pending',
        request_date: new Date(),
        month: billMonth,
        year: billYear,
        charge_date: bill.date,
        created_at: new Date(),
        tracking_id: trackingId
      });
      
      console.log(`Created payment request: ${trackingId} - $${splitAmount}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error importing CSV:', error);
    process.exit(1);
  }
}

function extractPayee(description) {
  // Extract merchant from common patterns
  if (description.includes('DES:')) {
    const parts = description.split('DES:');
    if (parts[1]) {
      return parts[1].split(' ')[0];
    }
  }
  
  // For simple purchases
  const purchaseMatch = description.match(/^([A-Z0-9\s&]+)\s+\d{2}\/\d{2}/);
  if (purchaseMatch) {
    return purchaseMatch[1].trim();
  }
  
  return description.split(' ')[0];
}

function extractMerchant(description) {
  const payee = extractPayee(description);
  return payee.substring(0, 50); // Limit length
}

// Run import
const csvPath = process.argv[2] || '/Users/ndting/Desktop/Landlord Dashboard/bofa history.csv';
importBofaCSV(csvPath);