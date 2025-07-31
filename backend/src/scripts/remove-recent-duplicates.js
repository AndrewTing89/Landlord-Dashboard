const db = require('../db/connection');

async function removeRecentDuplicates() {
  try {
    console.log('🧹 Removing recent duplicate transactions...\n');
    
    // Find and remove duplicates keeping the older one (lower ID)
    const result = await db.query(`
      WITH duplicates AS (
        SELECT 
          id,
          date,
          amount,
          expense_type,
          name,
          ROW_NUMBER() OVER (
            PARTITION BY date, amount, expense_type 
            ORDER BY id ASC  -- Keep the first one (lowest ID)
          ) as rn
        FROM transactions
        WHERE date >= '2025-06-01'  -- Only look at recent transactions
      )
      DELETE FROM transactions
      WHERE id IN (
        SELECT id FROM duplicates WHERE rn > 1
      )
      RETURNING id, date, amount, expense_type, name
    `);
    
    console.log(`✅ Removed ${result.rows.length} duplicate transactions:`);
    result.rows.forEach(tx => {
      console.log(`   ${tx.date.toISOString().split('T')[0]} - ${tx.name.substring(0, 40)} - $${tx.amount}`);
    });
    
    // Show updated counts
    const counts = await db.query(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(DISTINCT (date, amount, expense_type)) as unique_transactions
      FROM transactions
    `);
    
    console.log(`\n📊 Updated transaction counts:`);
    console.log(`   Total transactions: ${counts.rows[0].total_transactions}`);
    console.log(`   Unique transactions: ${counts.rows[0].unique_transactions}`);
    
    // Verify no more duplicates
    const remaining = await db.getOne(`
      SELECT COUNT(*) as count FROM (
        SELECT date, amount, expense_type
        FROM transactions
        GROUP BY date, amount, expense_type
        HAVING COUNT(*) > 1
      ) as dupes
    `);
    
    console.log(`   Remaining duplicates: ${remaining.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

removeRecentDuplicates();