const db = require('../db/connection');

async function updateVenmoTransactions() {
  try {
    console.log('🔄 Updating Venmo transactions to "other" category...\n');
    
    // First, let's see what we're updating
    const venmoTransactions = await db.query(`
      SELECT COUNT(*) as count, 
             SUM(amount) as total,
             expense_type
      FROM transactions
      WHERE (LOWER(name) LIKE '%venmo%' 
         OR LOWER(merchant_name) LIKE '%venmo%')
      GROUP BY expense_type
    `);
    
    console.log('Current Venmo transactions by type:');
    venmoTransactions.rows.forEach(row => {
      console.log(`  ${row.expense_type}: ${row.count} transactions - $${parseFloat(row.total || 0).toFixed(2)}`);
    });
    
    // Update all Venmo transactions to 'other'
    const updateResult = await db.query(`
      UPDATE transactions
      SET expense_type = 'other',
          updated_at = NOW()
      WHERE (LOWER(name) LIKE '%venmo%' 
         OR LOWER(merchant_name) LIKE '%venmo%')
        AND expense_type != 'other'
      RETURNING id, date, name, amount, expense_type
    `);
    
    console.log(`\n✅ Updated ${updateResult.rowCount} Venmo transactions to 'other'`);
    
    if (updateResult.rowCount > 0) {
      console.log('\nSample updated transactions:');
      updateResult.rows.slice(0, 5).forEach(tx => {
        console.log(`  ${tx.date.toISOString().split('T')[0]} - ${tx.name} - $${tx.amount}`);
      });
    }
    
    // Also add/update ETL rule for future Venmo transactions
    const existingRule = await db.getOne(
      `SELECT id FROM etl_rules WHERE pattern ILIKE '%venmo%'`
    );
    
    if (existingRule) {
      await db.query(
        `UPDATE etl_rules 
         SET expense_type = 'other',
             confidence = 1.0,
             updated_at = NOW()
         WHERE id = $1`,
        [existingRule.id]
      );
      console.log('\n✅ Updated existing Venmo ETL rule');
    } else {
      await db.insert('etl_rules', {
        pattern: '%Venmo%',
        expense_type: 'other',
        rule_type: 'description',
        confidence: 1.0
      });
      console.log('\n✅ Created new ETL rule for Venmo transactions');
    }
    
    console.log('\n✨ All Venmo transactions have been reclassified as "other"');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateVenmoTransactions();