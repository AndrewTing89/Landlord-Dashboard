const db = require('../db/connection');

async function fixPaidPaymentTransactions() {
  try {
    console.log('Creating transactions for existing paid payment requests...\n');
    
    // Get all paid payment requests that don't have corresponding transactions
    const paidRequests = await db.query(
      `SELECT pr.*, ub.bill_type as utility_bill_type
       FROM payment_requests pr
       LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
       WHERE pr.status = 'paid'
       AND NOT EXISTS (
         SELECT 1 FROM transactions t 
         WHERE t.plaid_transaction_id = 'payment_' || pr.id || '%'
       )
       ORDER BY pr.id`
    );
    
    console.log(`Found ${paidRequests.rows.length} paid requests without transactions\n`);
    
    let createdCount = 0;
    
    for (const request of paidRequests.rows) {
      const transactionId = `payment_${request.id}_${Date.now()}`;
      const billType = request.bill_type || request.utility_bill_type || 'utility';
      
      console.log(`Creating transaction for payment request ${request.id}:`);
      console.log(`  Amount: $${request.amount}`);
      console.log(`  Type: ${billType}`);
      console.log(`  Roommate: ${request.roommate_name}`);
      
      try {
        await db.insert('transactions', {
          plaid_transaction_id: transactionId,
          plaid_account_id: 'manual_payment',
          amount: parseFloat(request.amount),
          date: request.paid_date || request.updated_at || request.created_at,
          name: `Utility Payment - ${billType} - ${request.roommate_name}`,
          merchant_name: request.roommate_name,
          category: 'Utility Payment',
          subcategory: billType,
          expense_type: 'rent', // Categorize as rent since it's income
          created_at: new Date(),
          updated_at: new Date()
        });
        
        createdCount++;
        console.log('  ✅ Transaction created\n');
      } catch (error) {
        console.error(`  ❌ Error creating transaction: ${error.message}\n`);
      }
    }
    
    console.log(`\n✨ Created ${createdCount} transactions`);
    
    // Check updated revenue summary
    const revenueSummary = await db.query(
      `SELECT 
        COUNT(*) as transaction_count,
        SUM(amount) as total_revenue
       FROM transactions 
       WHERE expense_type = 'rent'
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    
    console.log(`\nUpdated YTD Revenue:`);
    console.log(`  Transactions: ${revenueSummary.rows[0].transaction_count}`);
    console.log(`  Total: $${parseFloat(revenueSummary.rows[0].total_revenue || 0).toFixed(2)}`);
    
    // Show breakdown
    const breakdown = await db.query(
      `SELECT 
        CASE 
          WHEN name LIKE '%Utility Payment%' THEN 'Utility Reimbursements'
          ELSE 'Base Rent'
        END as revenue_type,
        COUNT(*) as count,
        SUM(amount) as total
       FROM transactions 
       WHERE expense_type = 'rent'
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
       GROUP BY revenue_type
       ORDER BY revenue_type`
    );
    
    console.log('\nRevenue Breakdown:');
    breakdown.rows.forEach(row => {
      console.log(`  ${row.revenue_type}: $${parseFloat(row.total).toFixed(2)} (${row.count} transactions)`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPaidPaymentTransactions();