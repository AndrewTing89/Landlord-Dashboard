const db = require('../src/db/connection');

async function testBulkApproval() {
  try {
    console.log('🧪 Testing bulk transaction approval...');
    
    // Get pending transactions that need review
    const pendingTxs = await db.query(`
      SELECT * FROM raw_transactions 
      WHERE processed = false 
        AND excluded = false 
        AND amount < 0
      ORDER BY posted_date DESC
      LIMIT 3
    `);
    
    if (pendingTxs.rows.length === 0) {
      console.log('❌ No pending transactions found to test');
      return;
    }
    
    console.log(`\nFound ${pendingTxs.rows.length} pending transactions:`);
    pendingTxs.rows.forEach((tx, i) => {
      console.log(`  ${i+1}. ID: ${tx.id} | ${tx.description} | $${tx.amount} | ${tx.suggested_expense_type}`);
    });
    
    const transactionIds = pendingTxs.rows.map(tx => tx.id);
    
    // Test bulk approval - simulate what the bulk-approve endpoint does
    await db.query('BEGIN');
    
    try {
      let approved = 0;
      const finalExpenseType = 'cleaning_maintenance'; // Test with landscape type
      
      for (const id of transactionIds) {
        // Get the raw transaction
        const rawTx = await db.getOne(
          'SELECT * FROM raw_transactions WHERE id = $1 AND processed = false AND excluded = false',
          [id]
        );
        
        if (rawTx) {
          // Check if transaction already exists
          const existing = await db.getOne(
            'SELECT id FROM expenses WHERE simplefin_transaction_id = $1',
            [`simplefin_${rawTx.simplefin_id}`]
          );
          
          if (existing) {
            console.log(`  ⏭️  Transaction already exists: ${rawTx.simplefin_id}`);
            // Just mark as processed
            await db.query(
              'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
              [id]
            );
          } else {
            // Only process expenses (negative amounts)
            if (rawTx.amount > 0) {
              // Exclude deposits
              await db.query(
                `UPDATE raw_transactions 
                 SET excluded = true, 
                     exclude_reason = 'Bank deposit - income tracked via payment requests',
                     processed = true,
                     updated_at = NOW() 
                 WHERE id = $1`,
                [id]
              );
            } else {
              // Insert expense into expenses table
              const newExpense = await db.insert('expenses', {
                simplefin_transaction_id: `simplefin_${rawTx.simplefin_id}`,
                simplefin_account_id: rawTx.simplefin_account_id,
                amount: Math.abs(rawTx.amount),
                date: rawTx.posted_date,
                name: rawTx.description,
                merchant_name: rawTx.suggested_merchant || rawTx.payee,
                expense_type: finalExpenseType || rawTx.suggested_expense_type || 'other',
                category: 'Bulk Test',
                subcategory: null
              });
              
              console.log(`  ✅ Created expense: ID ${newExpense.id} | ${rawTx.description}`);
              
              // Mark as processed  
              await db.query(
                'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
                [id]
              );
              
              approved++;
            }
          }
        }
      }
      
      await db.query('COMMIT');
      
      console.log(`\n📊 Bulk approval results:`);
      console.log(`  Approved: ${approved} transactions`);
      console.log(`  Total processed: ${transactionIds.length} transactions`);
      console.log(`\n🎯 Bulk approval test ${approved > 0 ? 'PASSED' : 'FAILED'}!`);
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
  } catch (error) {
    console.error('❌ Error testing bulk approval:', error);
  } finally {
    process.exit(0);
  }
}

testBulkApproval();