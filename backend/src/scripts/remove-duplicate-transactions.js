const db = require('../db/connection');

async function removeDuplicates() {
  try {
    console.log('🧹 Starting duplicate transaction cleanup...\n');
    
    // First, find all duplicates based on date and amount
    const duplicates = await db.query(`
      WITH duplicate_groups AS (
        SELECT 
          date,
          amount,
          expense_type,
          COUNT(*) as count
        FROM transactions
        GROUP BY date, amount, expense_type
        HAVING COUNT(*) > 1
      )
      SELECT 
        t.id,
        t.plaid_transaction_id,
        t.date,
        t.amount,
        t.name,
        t.merchant_name,
        t.expense_type,
        dg.count as duplicate_count
      FROM transactions t
      INNER JOIN duplicate_groups dg 
        ON t.date = dg.date 
        AND t.amount = dg.amount 
        AND t.expense_type = dg.expense_type
      ORDER BY t.date, t.amount, t.merchant_name
    `);
    
    console.log(`Found ${duplicates.rows.length} transactions that are part of duplicate groups\n`);
    
    // Group duplicates by date/amount/type
    const duplicateGroups = {};
    duplicates.rows.forEach(row => {
      const key = `${row.date}_${row.amount}_${row.expense_type}`;
      if (!duplicateGroups[key]) {
        duplicateGroups[key] = [];
      }
      duplicateGroups[key].push(row);
    });
    
    // Process each duplicate group
    let totalDeleted = 0;
    let groupCount = 0;
    
    for (const [key, group] of Object.entries(duplicateGroups)) {
      groupCount++;
      console.log(`\nGroup ${groupCount}: ${group[0].date} - $${group[0].amount} - ${group[0].expense_type}`);
      
      // Sort group to prioritize keeping non-WEB ONL entries
      group.sort((a, b) => {
        // WEB ONL entries go to the end (will be deleted)
        if (a.name.includes('WEB ONL') && !b.name.includes('WEB ONL')) return 1;
        if (!a.name.includes('WEB ONL') && b.name.includes('WEB ONL')) return -1;
        
        // SimpleFIN entries preferred over imported ones
        if (a.plaid_transaction_id.startsWith('simplefin_bofa_') && !b.plaid_transaction_id.startsWith('simplefin_bofa_')) return 1;
        if (!a.plaid_transaction_id.startsWith('simplefin_bofa_') && b.plaid_transaction_id.startsWith('simplefin_bofa_')) return -1;
        
        // Keep the one with more descriptive name
        return b.name.length - a.name.length;
      });
      
      // Keep the first one, delete the rest
      const toKeep = group[0];
      const toDelete = group.slice(1);
      
      console.log(`  Keeping: ${toKeep.name}`);
      toDelete.forEach(t => {
        console.log(`  Deleting: ${t.name}`);
      });
      
      // Delete the duplicates
      if (toDelete.length > 0) {
        const deleteIds = toDelete.map(t => t.id);
        const deleteResult = await db.query(
          `DELETE FROM transactions WHERE id = ANY($1)`,
          [deleteIds]
        );
        totalDeleted += deleteResult.rowCount;
      }
    }
    
    console.log(`\n✅ Cleanup complete! Deleted ${totalDeleted} duplicate transactions`);
    
    // Show updated statistics
    const stats = await db.query(`
      SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM transactions
      WHERE EXTRACT(YEAR FROM date) = 2024
      GROUP BY expense_type
      ORDER BY total DESC
    `);
    
    console.log('\n📊 2024 Summary after cleanup:');
    stats.rows.forEach(row => {
      console.log(`  ${row.expense_type}: ${row.count} transactions - $${parseFloat(row.total).toFixed(2)}`);
    });
    
    // Check for any remaining duplicates
    const remainingDups = await db.getOne(`
      SELECT COUNT(*) as count
      FROM (
        SELECT date, amount, expense_type
        FROM transactions
        GROUP BY date, amount, expense_type
        HAVING COUNT(*) > 1
      ) as dups
    `);
    
    console.log(`\n📋 Remaining duplicate groups: ${remainingDups.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

removeDuplicates();