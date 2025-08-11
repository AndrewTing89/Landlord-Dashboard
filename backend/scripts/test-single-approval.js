const db = require('../src/db/connection');

async function testSingleApproval() {
  try {
    console.log('🧪 Testing single transaction approval...');
    
    // Get a pending transaction that needs review
    const pendingTx = await db.getOne(`
      SELECT * FROM raw_transactions 
      WHERE processed = false 
        AND excluded = false 
        AND amount < 0
      ORDER BY posted_date DESC
      LIMIT 1
    `);
    
    if (!pendingTx) {
      console.log('❌ No pending transactions found to test');
      return;
    }
    
    console.log(`\nFound pending transaction:`);
    console.log(`  ID: ${pendingTx.id}`);
    console.log(`  Description: ${pendingTx.description}`);
    console.log(`  Amount: $${pendingTx.amount}`);
    console.log(`  Suggested: ${pendingTx.suggested_expense_type}`);
    
    // Test approval - simulate what the review route does
    await db.query('BEGIN');
    
    try {
      // Insert into expenses table with SimpleFIN fields
      const expense = await db.insert('expenses', {
        simplefin_transaction_id: `simplefin_${pendingTx.simplefin_id}`,
        simplefin_account_id: pendingTx.simplefin_account_id,
        amount: Math.abs(pendingTx.amount),
        date: pendingTx.posted_date,
        name: pendingTx.description,
        merchant_name: pendingTx.suggested_merchant || pendingTx.payee,
        expense_type: 'cleaning_maintenance', // Test with landscape -> cleaning_maintenance  
        category: 'Manual Test',
        subcategory: null
      });
      
      console.log(`✅ Created expense record: ID ${expense.id}`);
      
      // Mark as processed
      await db.query(
        'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
        [pendingTx.id]
      );
      
      console.log(`✅ Marked transaction as processed`);
      
      await db.query('COMMIT');
      
      // Check if payment requests were created (should happen if it's a utility)
      if (['electricity', 'water'].includes('cleaning_maintenance')) {
        console.log(`✅ Trigger should create payment requests for utilities`);
      } else {
        console.log(`ℹ️  No payment requests needed for cleaning_maintenance`);
      }
      
      console.log(`\n🎯 Single approval test PASSED!`);
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error testing single approval:', error);
  } finally {
    process.exit(0);
  }
}

testSingleApproval();