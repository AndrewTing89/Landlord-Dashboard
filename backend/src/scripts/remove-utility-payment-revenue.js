const db = require('../db/connection');

async function removeUtilityPaymentRevenue() {
  try {
    console.log('🔧 Removing utility payment transactions from revenue...\n');
    
    // First, show what we're about to remove
    const utilityPayments = await db.query(
      `SELECT id, name, amount, date, plaid_transaction_id
       FROM transactions 
       WHERE name LIKE '%Utility Payment%'
       AND expense_type = 'rent'
       ORDER BY date`
    );
    
    console.log(`Found ${utilityPayments.rows.length} utility payment transactions to remove:\n`);
    
    let totalAmount = 0;
    utilityPayments.rows.forEach(tx => {
      console.log(`  ID ${tx.id}: ${tx.name} - $${tx.amount} (${tx.date})`);
      totalAmount += parseFloat(tx.amount);
    });
    
    console.log(`\nTotal amount to remove from revenue: $${totalAmount.toFixed(2)}`);
    
    if (utilityPayments.rows.length > 0) {
      // Delete these transactions
      const deleted = await db.query(
        `DELETE FROM transactions 
         WHERE name LIKE '%Utility Payment%'
         AND expense_type = 'rent'
         RETURNING id`
      );
      
      console.log(`\n✅ Deleted ${deleted.rows.length} transactions`);
    }
    
    // Show updated revenue
    const updatedRevenue = await db.query(
      `SELECT 
        COUNT(*) as count,
        SUM(amount) as total
       FROM transactions 
       WHERE expense_type = 'rent'
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    
    console.log(`\n📊 Updated YTD Revenue:`);
    console.log(`  Transactions: ${updatedRevenue.rows[0].count}`);
    console.log(`  Total: $${parseFloat(updatedRevenue.rows[0].total || 0).toFixed(2)} (base rent only)`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

removeUtilityPaymentRevenue();