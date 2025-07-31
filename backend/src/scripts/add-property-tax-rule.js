const db = require('../db/connection');

async function addPropertyTaxRule() {
  try {
    console.log('Adding property tax ETL rule...\n');
    
    // Add property tax rule
    await db.insert('etl_rules', {
      rule_name: 'Santa Clara County Property Tax',
      rule_type: 'categorize',
      priority: 100, // High priority for auto-approval
      description_pattern: 'county of santa',
      payee_pattern: null,
      action: 'categorize',
      expense_type: 'property_tax',
      active: true
    });
    
    console.log('✅ Added property tax rule');
    
    // Check for existing county of santa transactions
    const existingTransactions = await db.query(
      `SELECT COUNT(*) as count
       FROM raw_transactions
       WHERE LOWER(description) LIKE '%county of santa%'`
    );
    
    console.log(`\n📊 Found ${existingTransactions.rows[0].count} existing 'County of Santa' transactions`);
    
    if (existingTransactions.rows[0].count > 0) {
      // Update raw transactions with property tax categorization
      await db.query(
        `UPDATE raw_transactions
         SET suggested_expense_type = 'property_tax',
             confidence_score = 0.9,
             processed = true
         WHERE LOWER(description) LIKE '%county of santa%'`
      );
      
      console.log('✅ Updated raw transactions with property_tax classification');
      
      // Insert into main transactions table
      const insertResult = await db.query(
        `INSERT INTO transactions (plaid_transaction_id, plaid_account_id, amount, date, name, merchant_name, expense_type, category, subcategory)
         SELECT 
           'simplefin_' || simplefin_id,
           simplefin_account_id,
           ABS(amount),
           posted_date,
           description,
           'Santa Clara County',
           'property_tax',
           'Tax',
           null
         FROM raw_transactions
         WHERE LOWER(description) LIKE '%county of santa%'
           AND NOT EXISTS (
             SELECT 1 FROM transactions t 
             WHERE t.plaid_transaction_id = 'simplefin_' || raw_transactions.simplefin_id
           )`
      );
      
      console.log(`✅ Added ${insertResult.rowCount} property tax transactions to main table`);
      
      // Show property tax payments by month
      const monthlyTax = await db.query(
        `SELECT 
           EXTRACT(YEAR FROM date) as year,
           EXTRACT(MONTH FROM date) as month,
           COUNT(*) as count,
           SUM(amount) as total
         FROM transactions
         WHERE expense_type = 'property_tax'
         GROUP BY EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
         ORDER BY year, month`
      );
      
      console.log('\n💰 Property Tax Payments:');
      const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      monthlyTax.rows.forEach(row => {
        console.log(`  ${monthNames[row.month - 1]} ${row.year}: ${row.count} payment(s) - $${row.total}`);
      });
    }
    
    // Show all active ETL rules
    console.log('\n📋 All active ETL rules:');
    const allRules = await db.query(
      `SELECT rule_name, expense_type, priority 
       FROM etl_rules 
       WHERE active = true 
       ORDER BY priority DESC`
    );
    
    allRules.rows.forEach(rule => {
      console.log(`  ${rule.priority}: ${rule.rule_name} -> ${rule.expense_type}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addPropertyTaxRule();