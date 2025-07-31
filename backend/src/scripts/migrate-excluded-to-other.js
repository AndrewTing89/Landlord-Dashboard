const db = require('../db/connection');

async function migrateExcludedToOther() {
  try {
    console.log('🔄 Migrating excluded transactions to "other" category...\n');
    
    // First, let's see what we're dealing with
    const excluded = await db.query(`
      SELECT * FROM raw_transactions 
      WHERE excluded = true 
      ORDER BY posted_date DESC
    `);
    
    console.log(`Found ${excluded.rows.length} excluded transactions to migrate\n`);
    
    // Start transaction
    await db.query('BEGIN');
    
    let migrated = 0;
    
    for (const rawTx of excluded.rows) {
      // Check if already exists in main transactions
      const existing = await db.getOne(
        `SELECT id FROM transactions 
         WHERE date = $1 
           AND amount = $2 
           AND (plaid_transaction_id = $3 OR plaid_transaction_id LIKE '%' || $4)`,
        [rawTx.posted_date, Math.abs(rawTx.amount), `simplefin_${rawTx.simplefin_id}`, rawTx.simplefin_id.substring(5)]
      );
      
      if (!existing) {
        // Insert into main transactions as "other"
        await db.insert('transactions', {
          plaid_transaction_id: `simplefin_${rawTx.simplefin_id}`,
          plaid_account_id: rawTx.simplefin_account_id,
          amount: Math.abs(rawTx.amount),
          date: rawTx.posted_date,
          name: rawTx.description,
          merchant_name: rawTx.payee || rawTx.suggested_merchant,
          expense_type: 'other', // Mark as other instead of excluding
          category: rawTx.category || 'Personal',
          subcategory: null
        });
        
        migrated++;
        console.log(`✅ Migrated: ${rawTx.description} - ${rawTx.posted_date}`);
      } else {
        console.log(`⏭️  Already exists: ${rawTx.description}`);
      }
    }
    
    // Update raw_transactions to mark as processed instead of excluded
    await db.query(`
      UPDATE raw_transactions 
      SET excluded = false,
          processed = true,
          suggested_expense_type = 'other',
          confidence_score = 1.0,
          reviewed_at = NOW()
      WHERE excluded = true
    `);
    
    await db.query('COMMIT');
    
    console.log(`\n✅ Migration complete!`);
    console.log(`   Migrated ${migrated} transactions to "other" category`);
    console.log(`   Updated ${excluded.rows.length} raw transactions`);
    
    // Show updated counts
    const counts = await db.query(`
      SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM transactions
      WHERE expense_type = 'other'
      GROUP BY expense_type
    `);
    
    if (counts.rows.length > 0) {
      console.log(`\n📊 "Other" category now has:`);
      console.log(`   ${counts.rows[0].count} transactions`);
      console.log(`   Total: $${parseFloat(counts.rows[0].total).toFixed(2)}`);
    }
    
    process.exit(0);
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error:', error);
    process.exit(1);
  }
}

migrateExcludedToOther();