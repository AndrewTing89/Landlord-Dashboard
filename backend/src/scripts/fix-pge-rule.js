const db = require('../db/connection');

async function fixPGERule() {
  try {
    console.log('Fixing PG&E rule to match PGANDE format...\n');
    
    // Update the PG&E pattern to include PGANDE
    await db.query(
      `UPDATE etl_rules 
       SET description_pattern = '(pg&e|pacific gas|pge|pgande)'
       WHERE rule_name = 'PG&E Electricity'`
    );
    
    console.log('✅ Updated PG&E pattern to include PGANDE');
    
    // Also manually update the existing PG&E transactions to be processed
    const result = await db.query(
      `UPDATE raw_transactions 
       SET processed = true
       WHERE suggested_expense_type = 'electricity'
         AND LOWER(description) LIKE '%pgande%'`
    );
    
    console.log(`✅ Marked ${result.rowCount} PG&E transactions as processed`);
    
    // Insert them into the main transactions table
    await db.query(
      `INSERT INTO transactions (plaid_transaction_id, plaid_account_id, amount, date, name, merchant_name, expense_type, category, subcategory)
       SELECT 
         'simplefin_' || simplefin_id,
         simplefin_account_id,
         ABS(amount),
         posted_date,
         description,
         'PG&E',
         'electricity',
         'Utilities',
         null
       FROM raw_transactions
       WHERE suggested_expense_type = 'electricity'
         AND LOWER(description) LIKE '%pgande%'
         AND NOT EXISTS (
           SELECT 1 FROM transactions t 
           WHERE t.plaid_transaction_id = 'simplefin_' || raw_transactions.simplefin_id
         )`
    );
    
    console.log('✅ Added PG&E transactions to main table');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPGERule();