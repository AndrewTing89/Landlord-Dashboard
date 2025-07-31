const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const db = require('../db/connection');
const simplefinService = require('../services/simplefinService');
const moment = require('moment');

async function importBofaHistory() {
  try {
    console.log('🏦 Starting Bank of America CSV import...\n');
    
    const csvPath = path.join(__dirname, '../../../bofa history.csv');
    const transactions = [];
    let skippedCount = 0;
    let processedCount = 0;
    
    // First, read and parse the CSV file
    await new Promise((resolve, reject) => {
      let headerFound = false;
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => {
          // Skip rows until we find the header row
          if (!headerFound && row['Date'] && row['Description'] && row['Amount']) {
            headerFound = true;
          }
          
          if (headerFound) {
            const date = row['Date'];
            const description = row['Description'];
            const amount = row['Amount'];
            
            // Skip summary rows and balance rows
            if (date && description && amount && 
                !description.includes('Beginning balance') && 
                !description.includes('Ending balance') &&
                !description.includes('Total credits') &&
                !description.includes('Total debits')) {
              
              const parsedAmount = parseFloat(amount.replace(/[$,"]/g, ''));
              const parsedDate = moment(date, 'MM/DD/YYYY');
              
              if (parsedDate.isValid() && !isNaN(parsedAmount)) {
                transactions.push({
                  date: parsedDate.format('YYYY-MM-DD'),
                  description: description.trim(),
                  amount: parsedAmount,
                  // Generate a unique ID based on date, description, and amount
                  uniqueId: `bofa_${parsedDate.format('YYYYMMDD')}_${Math.abs(parsedAmount * 100).toFixed(0)}_${description.substring(0, 10).replace(/[^a-zA-Z0-9]/g, '')}`
                });
              }
            }
          } else {
            skippedCount++;
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });
    
    console.log(`📊 Found ${transactions.length} transactions in CSV`);
    console.log(`⚠️  Skipped ${skippedCount} rows with incomplete data\n`);
    
    // Sort transactions by date (oldest first)
    transactions.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    // Show date range
    if (transactions.length > 0) {
      console.log(`📅 Date range: ${transactions[0].date} to ${transactions[transactions.length - 1].date}\n`);
    }
    
    // Process each transaction
    for (const transaction of transactions) {
      try {
        // Check if transaction already exists
        const existing = await db.getOne(
          `SELECT id FROM raw_transactions 
           WHERE simplefin_id = $1`,
          [transaction.uniqueId]
        );
        
        if (!existing) {
          // Apply ETL rules to get suggestions
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
          
          // If auto-approved by rules, also insert into main transactions table
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
          
          // Show progress every 100 transactions
          if (processedCount % 100 === 0) {
            console.log(`  Processed ${processedCount} transactions...`);
          }
        }
      } catch (error) {
        console.error(`Error processing transaction: ${transaction.description}`, error.message);
      }
    }
    
    console.log(`\n✅ Import complete! Processed ${processedCount} new transactions`);
    
    // Show summary of imported data
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
      console.log(`  ${row.expense_type || 'other'}: ${row.count} transactions - $${row.total}`);
    });
    
    // Show transactions that need review
    const pendingReview = await db.getOne(
      `SELECT COUNT(*) as count
       FROM raw_transactions
       WHERE simplefin_account_id = 'bofa_import'
         AND processed = false
         AND excluded = false`
    );
    
    console.log(`\n⏳ Transactions pending review: ${pendingReview.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Import error:', error);
    process.exit(1);
  }
}

function extractPayee(description) {
  // Try to extract merchant/payee from description
  const cleanDesc = description.replace(/[0-9]/g, '').trim();
  const parts = cleanDesc.split(/\s+/);
  
  // Common patterns
  if (description.includes('CHECKCARD')) {
    return parts.slice(2, 5).join(' ');
  } else if (description.includes('PURCHASE')) {
    return parts.slice(2, 5).join(' ');
  } else if (description.includes('DES:')) {
    const match = description.match(/DES:([^ID:]+)/);
    return match ? match[1].trim() : parts.slice(0, 3).join(' ');
  }
  
  return parts.slice(0, 3).join(' ');
}

// First install csv-parser if not already installed
const { exec } = require('child_process');
exec('npm list csv-parser', (error) => {
  if (error) {
    console.log('Installing csv-parser...');
    exec('npm install csv-parser', (installError) => {
      if (installError) {
        console.error('Failed to install csv-parser:', installError);
        process.exit(1);
      }
      importBofaHistory();
    });
  } else {
    importBofaHistory();
  }
});