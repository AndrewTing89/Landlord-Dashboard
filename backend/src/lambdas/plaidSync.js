const db = require('../db/connection');
const plaidService = require('../services/plaidService');
const transactionClassifier = require('../services/transactionClassifier');

/**
 * Lambda handler for syncing Plaid transactions
 * This will be triggered by EventBridge on a schedule
 */
exports.handler = async (event, context) => {
  console.log('Starting Plaid sync Lambda', { event });
  
  try {
    // Get stored Plaid access token
    const tokenData = await db.getOne('SELECT * FROM plaid_tokens ORDER BY created_at DESC LIMIT 1');
    
    if (!tokenData) {
      throw new Error('No Plaid access token found. Please connect your bank account first.');
    }
    
    // Set the access token
    plaidService.setAccessToken(tokenData.access_token);
    
    // Sync transactions
    console.log('Syncing transactions from Plaid...');
    const transactions = await plaidService.syncTransactions();
    
    // Classify transactions
    console.log(`Classifying ${transactions.length} transactions...`);
    const classifiedTransactions = await transactionClassifier.classifyTransactions(transactions);
    
    // Save transactions to database
    let savedCount = 0;
    let skippedCount = 0;
    
    for (const transaction of classifiedTransactions) {
      try {
        // Check if transaction already exists
        const existing = await db.getOne(
          'SELECT id FROM transactions WHERE plaid_transaction_id = $1',
          [transaction.transaction_id]
        );
        
        if (!existing) {
          await db.insert('transactions', {
            plaid_transaction_id: transaction.transaction_id,
            plaid_account_id: transaction.account_id,
            amount: Math.abs(transaction.amount),
            date: transaction.date,
            name: transaction.name,
            merchant_name: transaction.merchant_name,
            category: transaction.category?.[0] || null,
            subcategory: transaction.category?.[1] || null,
            expense_type: transaction.expense_type
          });
          savedCount++;
        } else {
          skippedCount++;
        }
      } catch (error) {
        console.error('Error saving transaction:', error, transaction);
      }
    }
    
    // Log job run
    await db.insert('job_runs', {
      job_name: 'plaid_sync',
      run_date: new Date(),
      status: 'success',
      details: {
        total_transactions: transactions.length,
        saved: savedCount,
        skipped: skippedCount
      }
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Synced ${savedCount} new transactions, skipped ${skippedCount} existing`,
        totals: {
          fetched: transactions.length,
          saved: savedCount,
          skipped: skippedCount
        }
      })
    };
    
  } catch (error) {
    console.error('Plaid sync error:', error);
    
    // Log failed job run
    await db.insert('job_runs', {
      job_name: 'plaid_sync',
      run_date: new Date(),
      status: 'failed',
      details: { error: error.message }
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};