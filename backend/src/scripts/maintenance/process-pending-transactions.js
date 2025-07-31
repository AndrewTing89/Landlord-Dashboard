const db = require('../db/connection');

async function processPendingTransactions() {
  try {
    console.log('Processing pending high-confidence transactions...\n');
    
    // Process Venmo rent payments
    const rentResult = await db.query(
      `INSERT INTO transactions (plaid_transaction_id, plaid_account_id, amount, date, name, merchant_name, expense_type, category, subcategory)
       SELECT 
         'simplefin_' || simplefin_id,
         simplefin_account_id,
         ABS(amount),
         posted_date,
         description,
         'Venmo Rent',
         'rent',
         'Income',
         null
       FROM raw_transactions
       WHERE suggested_expense_type = 'rent'
         AND confidence_score >= 0.9
         AND processed = false
         AND NOT EXISTS (
           SELECT 1 FROM transactions t 
           WHERE t.plaid_transaction_id = 'simplefin_' || raw_transactions.simplefin_id
         )`
    );
    
    console.log(`✅ Processed ${rentResult.rowCount} rent payments`);
    
    // Process yard maintenance (Carlos)
    const maintenanceResult = await db.query(
      `INSERT INTO transactions (plaid_transaction_id, plaid_account_id, amount, date, name, merchant_name, expense_type, category, subcategory)
       SELECT 
         'simplefin_' || simplefin_id,
         simplefin_account_id,
         ABS(amount),
         posted_date,
         description,
         'Carlos Gardener',
         'yard_maintenance',
         'Maintenance',
         null
       FROM raw_transactions
       WHERE suggested_expense_type = 'yard_maintenance'
         AND confidence_score >= 0.9
         AND processed = false
         AND NOT EXISTS (
           SELECT 1 FROM transactions t 
           WHERE t.plaid_transaction_id = 'simplefin_' || raw_transactions.simplefin_id
         )`
    );
    
    console.log(`✅ Processed ${maintenanceResult.rowCount} yard maintenance payments`);
    
    // Mark them as processed
    await db.query(
      `UPDATE raw_transactions 
       SET processed = true, processed_at = NOW()
       WHERE (suggested_expense_type IN ('rent', 'yard_maintenance'))
         AND confidence_score >= 0.9
         AND processed = false`
    );
    
    // Show updated monthly comparison
    const monthlyData = await db.query(
      `SELECT 
         EXTRACT(MONTH FROM date) as month,
         SUM(CASE WHEN expense_type = 'rent' THEN amount ELSE 0 END) as revenue,
         SUM(CASE WHEN expense_type != 'rent' THEN amount ELSE 0 END) as expenses
       FROM transactions
       WHERE EXTRACT(YEAR FROM date) = 2025
       GROUP BY EXTRACT(MONTH FROM date)
       ORDER BY month`
    );
    
    console.log('\n📊 Updated Monthly Summary:');
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
    monthlyData.rows.forEach(row => {
      console.log(`  ${monthNames[row.month - 1]}: Revenue: $${row.revenue}, Expenses: $${row.expenses}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

processPendingTransactions();