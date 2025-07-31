const db = require('../db/connection');

async function checkPaymentTransactions() {
  try {
    console.log('Checking for payment transactions...\n');
    
    // Check for any transactions created from payments
    const paymentTransactions = await db.query(
      `SELECT * FROM transactions 
       WHERE plaid_transaction_id LIKE 'payment_%' 
          OR plaid_transaction_id LIKE 'venmo_payment_%'
       ORDER BY created_at DESC`
    );
    
    console.log(`Found ${paymentTransactions.rows.length} payment transactions:\n`);
    
    if (paymentTransactions.rows.length > 0) {
      paymentTransactions.rows.forEach(tx => {
        console.log(`ID: ${tx.id}`);
        console.log(`  Name: ${tx.name}`);
        console.log(`  Amount: $${tx.amount}`);
        console.log(`  Type: ${tx.expense_type}`);
        console.log(`  Date: ${tx.date}`);
        console.log(`  Created: ${tx.created_at}`);
        console.log('---');
      });
    }
    
    // Check how many payment requests are marked as paid
    const paidRequests = await db.query(
      `SELECT COUNT(*) as count, SUM(amount) as total
       FROM payment_requests 
       WHERE status = 'paid'`
    );
    
    console.log(`\nPaid payment requests: ${paidRequests.rows[0].count}`);
    console.log(`Total paid amount: $${paidRequests.rows[0].total || 0}`);
    
    // Check current revenue summary
    const revenueSummary = await db.query(
      `SELECT 
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue
       FROM transactions 
       WHERE expense_type = 'rent'
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    
    console.log(`\nYTD Revenue transactions: ${revenueSummary.rows[0].transaction_count}`);
    console.log(`YTD Total revenue: $${revenueSummary.rows[0].total_revenue || 0}`);
    
    // Check if we need to restart the server
    console.log('\nNote: If you just updated the code, you may need to restart the backend server for changes to take effect.');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPaymentTransactions();