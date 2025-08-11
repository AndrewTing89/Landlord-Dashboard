const db = require('../src/db/connection');

async function testApprovalSystem() {
  try {
    console.log('🧪 Testing Approval System...');
    console.log('=' + '='.repeat(50));
    
    // Get pending transactions for testing
    const pendingTxs = await db.query(`
      SELECT id, description, amount, posted_date, suggested_expense_type, simplefin_id
      FROM raw_transactions 
      WHERE processed = false 
        AND excluded = false 
        AND amount < 0
      ORDER BY posted_date DESC
      LIMIT 3
    `);
    
    console.log(`\n📋 Found ${pendingTxs.rows.length} pending transactions for testing:`);
    pendingTxs.rows.forEach((tx, i) => {
      console.log(`  ${i+1}. ID: ${tx.id} | ${tx.description} | $${tx.amount} | SimpleFIN ID: ${tx.simplefin_id || 'NULL'}`);
    });
    
    if (pendingTxs.rows.length === 0) {
      console.log('❌ No pending transactions to test with');
      return;
    }
    
    // Test single approval first
    console.log(`\n🔧 Testing Single Approval...`);
    const testTx = pendingTxs.rows[0];
    
    await db.query('BEGIN');
    
    try {
      console.log(`  Processing transaction ID: ${testTx.id}`);
      console.log(`  Description: ${testTx.description}`);
      console.log(`  Amount: $${testTx.amount}`);
      console.log(`  SimpleFIN ID: ${testTx.simplefin_id || 'NULL'}`);
      
      // Simulate what the single approval route does
      const expense = await db.insert('expenses', {
        simplefin_transaction_id: testTx.simplefin_id ? `simplefin_${testTx.simplefin_id}` : null,
        simplefin_account_id: null, // CSV data has NULL account ID
        amount: Math.abs(testTx.amount),
        date: testTx.posted_date,
        name: testTx.description,
        merchant_name: 'Test Merchant',
        expense_type: 'cleaning_maintenance', // Test with landscape type
        category: 'Manual Review Test'
      });
      
      console.log(`  ✅ Created expense ID: ${expense.id}`);
      
      // Mark as processed
      await db.query(
        'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
        [testTx.id]
      );
      
      console.log(`  ✅ Marked transaction as processed`);
      
      await db.query('COMMIT');
      console.log(`  🎯 Single approval test PASSED!`);
      
    } catch (error) {
      await db.query('ROLLBACK');
      console.error(`  ❌ Single approval FAILED:`, error.message);
      
      if (error.message.includes('duplicate key value violates unique constraint')) {
        console.log(`  🔍 This is likely a natural key constraint violation`);
        console.log(`  🔍 Check if expense already exists with same (date, amount, name, expense_type)`);
      }
    }
    
    // Test bulk approval if we have more transactions
    if (pendingTxs.rows.length > 1) {
      console.log(`\n🔧 Testing Bulk Approval...`);
      
      const bulkTxIds = pendingTxs.rows.slice(1).map(tx => tx.id);
      console.log(`  Processing transaction IDs: [${bulkTxIds.join(', ')}]`);
      
      await db.query('BEGIN');
      
      try {
        let approved = 0;
        
        for (const txId of bulkTxIds) {
          const rawTx = await db.getOne(
            'SELECT * FROM raw_transactions WHERE id = $1 AND processed = false AND excluded = false',
            [txId]
          );
          
          if (rawTx) {
            console.log(`  Processing: ${rawTx.description} ($${rawTx.amount})`);
            
            // Check if transaction already exists using natural keys
            const existing = await db.getOne(
              'SELECT id FROM expenses WHERE date = $1 AND amount = $2 AND name = $3',
              [rawTx.posted_date, Math.abs(rawTx.amount), rawTx.description]
            );
            
            if (existing) {
              console.log(`    ⚠️  Expense already exists with ID: ${existing.id}`);
              // Just mark as processed
              await db.query(
                'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
                [txId]
              );
            } else {
              // Insert new expense
              const newExpense = await db.insert('expenses', {
                simplefin_transaction_id: rawTx.simplefin_id ? `simplefin_${rawTx.simplefin_id}` : null,
                simplefin_account_id: rawTx.simplefin_account_id,
                amount: Math.abs(rawTx.amount),
                date: rawTx.posted_date,
                name: rawTx.description,
                merchant_name: rawTx.suggested_merchant || rawTx.payee || 'Unknown',
                expense_type: 'other', // Test with other type
                category: 'Bulk Test'
              });
              
              console.log(`    ✅ Created expense ID: ${newExpense.id}`);
              
              // Mark as processed
              await db.query(
                'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
                [txId]
              );
              
              approved++;
            }
          }
        }
        
        await db.query('COMMIT');
        console.log(`  🎯 Bulk approval test PASSED! Approved: ${approved} transactions`);
        
      } catch (error) {
        await db.query('ROLLBACK');
        console.error(`  ❌ Bulk approval FAILED:`, error.message);
        
        if (error.message.includes('duplicate key value violates unique constraint')) {
          console.log(`  🔍 Natural key constraint violation in bulk approval`);
        }
      }
    }
    
    console.log(`\n📊 Final Status Check...`);
    
    // Check remaining pending transactions
    const remainingPending = await db.query(`
      SELECT COUNT(*) as count 
      FROM raw_transactions 
      WHERE processed = false AND excluded = false
    `);
    
    console.log(`  Remaining pending transactions: ${remainingPending.rows[0].count}`);
    
    // Check total expenses created
    const totalExpenses = await db.query(`SELECT COUNT(*) as count FROM expenses`);
    console.log(`  Total expenses in database: ${totalExpenses.rows[0].count}`);
    
  } catch (error) {
    console.error('❌ Error testing approval system:', error);
  } finally {
    process.exit(0);
  }
}

testApprovalSystem();