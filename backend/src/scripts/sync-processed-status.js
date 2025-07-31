const db = require('../db/connection');

async function syncProcessedStatus() {
  try {
    console.log('🔄 Syncing processed status between tables...\n');
    
    // Mark raw_transactions as processed if they exist in main transactions table
    const result = await db.query(`
      UPDATE raw_transactions rt
      SET processed = true,
          reviewed_at = COALESCE(reviewed_at, NOW())
      WHERE processed = false
        AND excluded = false
        AND EXISTS (
          SELECT 1 
          FROM transactions t
          WHERE t.date = rt.posted_date
            AND t.amount = ABS(rt.amount)
            AND (
              t.plaid_transaction_id = 'simplefin_' || rt.simplefin_id
              OR t.plaid_transaction_id LIKE '%' || SUBSTRING(rt.simplefin_id, 6)
            )
        )
    `);
    
    console.log(`✅ Marked ${result.rowCount} raw transactions as processed`);
    
    // Show updated counts
    const counts = await db.getOne(`
      SELECT 
        COUNT(*) FILTER (WHERE processed = false AND excluded = false) as pending,
        COUNT(*) FILTER (WHERE processed = true) as processed,
        COUNT(*) FILTER (WHERE excluded = true) as excluded,
        COUNT(*) as total
      FROM raw_transactions
    `);
    
    console.log('\n📊 Raw transactions status:');
    console.log(`  Total: ${counts.total}`);
    console.log(`  Processed: ${counts.processed}`);
    console.log(`  Excluded: ${counts.excluded}`);
    console.log(`  Pending review: ${counts.pending}`);
    
    // Show what's still pending
    const pendingSummary = await db.query(`
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
    
    if (pendingSummary.rows.length > 0) {
      console.log('\n⏳ Still pending review:');
      pendingSummary.rows.forEach(row => {
        const type = row.suggested_expense_type || 'uncategorized';
        console.log(`  ${type}: ${row.count} transactions - $${parseFloat(row.total).toFixed(2)}`);
      });
    } else {
      console.log('\n✨ All transactions have been processed!');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

syncProcessedStatus();