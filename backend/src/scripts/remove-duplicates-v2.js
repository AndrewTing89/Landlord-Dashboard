const db = require('../db/connection');

async function removeDuplicates() {
  try {
    console.log('🧹 Removing duplicate transactions...\n');
    
    // Find and remove duplicates
    const result = await db.query(`
      WITH duplicates AS (
        SELECT 
          id,
          plaid_transaction_id,
          date,
          amount,
          expense_type,
          name,
          ROW_NUMBER() OVER (
            PARTITION BY date, amount, expense_type 
            ORDER BY 
              CASE 
                WHEN plaid_transaction_id LIKE '%bofa%' THEN 1  -- Prefer descriptive IDs
                ELSE 2 
              END,
              LENGTH(name) DESC,  -- Prefer longer descriptions
              id ASC
          ) as rn
        FROM transactions
      )
      DELETE FROM transactions
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
    `);
    
    console.log(`✅ Removed ${result.rowCount} duplicate transactions`);
    
    // Show updated summary
    const summary = await db.query(`
      SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM transactions
      GROUP BY expense_type
      ORDER BY total DESC
    `);
    
    console.log('\n📊 Updated transaction summary:');
    summary.rows.forEach(row => {
      console.log(`  ${row.expense_type}: ${row.count} transactions - $${parseFloat(row.total).toFixed(2)}`);
    });
    
    const total = await db.getOne('SELECT COUNT(*) as count FROM transactions');
    console.log(`\nTotal transactions: ${total.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

removeDuplicates();