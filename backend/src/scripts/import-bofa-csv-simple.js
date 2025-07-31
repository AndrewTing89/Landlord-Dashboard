const fs = require('fs');
const path = require('path');
const readline = require('readline');
const db = require('../db/connection');
const simplefinService = require('../services/simplefinService');
const moment = require('moment');

async function importBofaHistory() {
  try {
    console.log('🏦 Starting Bank of America CSV import...\n');
    
    const csvPath = path.join(__dirname, '../../../bofa history.csv');
    const transactions = [];
    let lineNumber = 0;
    let headerFound = false;
    
    // Read file line by line
    const fileStream = fs.createReadStream(csvPath);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    for await (const line of rl) {
      lineNumber++;
      
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Look for the header line
      if (line.startsWith('Date,Description,Amount')) {
        headerFound = true;
        console.log(`Found header at line ${lineNumber}`);
        continue;
      }
      
      // Process data lines after header
      if (headerFound && line.includes(',')) {
        // Parse CSV line manually to handle quoted fields
        const parts = line.match(/(".*?"|[^,]+)(?=\s*,|\s*$)/g);
        
        if (parts && parts.length >= 3) {
          const date = parts[0];
          const description = parts[1].replace(/^"|"$/g, ''); // Remove quotes
          const amount = parts[2].replace(/^"|"$/g, '').replace(/,/g, ''); // Remove quotes and commas
          
          // Skip balance rows
          if (description.includes('balance as of')) continue;
          
          const parsedDate = moment(date, 'MM/DD/YYYY');
          const parsedAmount = parseFloat(amount);
          
          if (parsedDate.isValid() && !isNaN(parsedAmount)) {
            transactions.push({
              date: parsedDate.format('YYYY-MM-DD'),
              description: description.trim(),
              amount: parsedAmount,
              uniqueId: `bofa_${parsedDate.format('YYYYMMDD')}_${Math.abs(parsedAmount * 100).toFixed(0)}_${description.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`
            });
          }
        }
      }
    }
    
    console.log(`📊 Found ${transactions.length} transactions\n`);
    
    if (transactions.length === 0) {
      console.log('No transactions found. Please check the CSV format.');
      process.exit(1);
    }
    
    // Sort by date
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    console.log(`📅 Date range: ${transactions[0].date} to ${transactions[transactions.length - 1].date}\n`);
    
    // Clear existing imported data first (optional)
    console.log('Clearing previous imports...');
    await db.query(`DELETE FROM raw_transactions WHERE simplefin_account_id = 'bofa_import'`);
    await db.query(`DELETE FROM transactions WHERE plaid_account_id = 'bofa_import'`);
    
    // Process transactions
    let processedCount = 0;
    console.log('Processing transactions...');
    
    for (const transaction of transactions) {
      try {
        // Apply ETL rules
        const suggestions = await simplefinService.applyETLRules({
          id: transaction.uniqueId,
          description: transaction.description,
          payee: extractPayee(transaction.description),
          amount: transaction.amount,
          posted: new Date(transaction.date).getTime() / 1000
        });
        
        // Insert into raw_transactions
        await db.insert('raw_transactions', {
          simplefin_id: transaction.uniqueId,
          simplefin_account_id: 'bofa_import',
          amount: transaction.amount,
          posted_date: transaction.date,
          description: transaction.description,
          payee: extractPayee(transaction.description),
          category: 'Imported',
          suggested_expense_type: suggestions.expense_type,
          suggested_merchant: suggestions.merchant,
          confidence_score: suggestions.confidence,
          excluded: suggestions.excluded,
          exclude_reason: suggestions.exclude_reason,
          processed: suggestions.auto_approve || false,
          imported_at: new Date()
        });
        
        // Auto-approve high confidence transactions
        if (suggestions.auto_approve && !suggestions.excluded) {
          await db.insert('transactions', {
            plaid_transaction_id: `simplefin_${transaction.uniqueId}`,
            plaid_account_id: 'bofa_import',
            amount: Math.abs(transaction.amount),
            date: transaction.date,
            name: transaction.description,
            merchant_name: suggestions.merchant || extractPayee(transaction.description),
            expense_type: suggestions.expense_type || 'other',
            category: 'Imported',
            subcategory: null
          });
        }
        
        processedCount++;
        if (processedCount % 100 === 0) {
          console.log(`  Processed ${processedCount}/${transactions.length} transactions...`);
        }
      } catch (error) {
        console.error(`Error processing: ${transaction.description}`, error.message);
      }
    }
    
    console.log(`\n✅ Import complete! Processed ${processedCount} transactions`);
    
    // Show summary
    const summary = await db.query(`
      SELECT 
        suggested_expense_type as expense_type,
        COUNT(*) as count,
        SUM(ABS(amount)) as total
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
        AND excluded = false
      GROUP BY suggested_expense_type
      ORDER BY total DESC
    `);
    
    console.log('\n📊 Import Summary by Category:');
    summary.rows.forEach(row => {
      console.log(`  ${row.expense_type || 'other'}: ${row.count} transactions - $${parseFloat(row.total).toFixed(2)}`);
    });
    
    // Transactions needing review
    const pendingReview = await db.getOne(
      `SELECT COUNT(*) as count
       FROM raw_transactions
       WHERE simplefin_account_id = 'bofa_import'
         AND processed = false
         AND excluded = false`
    );
    
    console.log(`\n⏳ Transactions pending review: ${pendingReview.count}`);
    
    // Show some examples of auto-categorized transactions
    const examples = await db.query(`
      SELECT description, suggested_expense_type, amount
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
        AND processed = true
        AND excluded = false
      LIMIT 10
    `);
    
    console.log('\n✅ Sample auto-categorized transactions:');
    examples.rows.forEach(row => {
      console.log(`  ${row.suggested_expense_type}: ${row.description.substring(0, 60)}... ($${Math.abs(row.amount)})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
}

function extractPayee(description) {
  const cleanDesc = description.replace(/[0-9]/g, '').trim();
  const parts = cleanDesc.split(/\s+/);
  
  if (description.includes('DES:')) {
    const match = description.match(/DES:([^ID:]+)/);
    return match ? match[1].trim() : parts.slice(0, 3).join(' ');
  }
  
  return parts.slice(0, 3).join(' ');
}

importBofaHistory();