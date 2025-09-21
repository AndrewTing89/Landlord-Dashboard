const db = require('../db/connection');

async function processUnmatched() {
  try {
    console.log('🔍 Finding unprocessed transactions...\n');
    
    // Reset processed flag for unmatched transactions
    const result = await db.query(`
      UPDATE raw_transactions rt
      SET processed = false
      WHERE processed = true
        AND NOT EXISTS (
          SELECT 1 FROM expenses t
          WHERE t.date = rt.posted_date
            AND ABS(t.amount) = ABS(rt.amount)
            AND (t.simplefin_transaction_id = 'simplefin_' || rt.simplefin_id
                 OR t.simplefin_transaction_id LIKE '%' || SUBSTRING(rt.simplefin_id, 6))
        )
    `);
    
    console.log(`✅ Reset ${result.rowCount} transactions to pending status`);
    
    // Show what needs review
    const pending = await db.query(`
      SELECT 
        suggested_expense_type,
        COUNT(*) as count,
        SUM(ABS(amount)) as total
      FROM raw_transactions
      WHERE processed = false 
        AND excluded = false
      GROUP BY suggested_expense_type
      ORDER BY count DESC
    `);
    
    console.log('\n📋 Transactions needing review:');
    pending.rows.forEach(row => {
      const type = row.suggested_expense_type || 'uncategorized';
      console.log(`  ${type}: ${row.count} transactions - $${parseFloat(row.total).toFixed(2)}`);
    });
    
    const totalPending = await db.getOne('SELECT COUNT(*) as count FROM raw_transactions WHERE processed = false AND excluded = false');
    console.log(`\n🔔 Total pending review: ${totalPending.count} transactions`);
    console.log('   Visit the Review page to process these transactions');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

processUnmatched();