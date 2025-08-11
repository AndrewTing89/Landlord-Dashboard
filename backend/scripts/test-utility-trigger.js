const db = require('../src/db/connection');

async function testUtilityTrigger() {
  try {
    console.log('🧪 Testing utility payment request trigger...');
    
    // Insert a test electricity expense
    const testExpense = await db.insert('expenses', {
      simplefin_transaction_id: 'test_trigger_electric_123',
      simplefin_account_id: 'test_account',
      amount: 300.00,
      date: '2025-08-01',
      name: 'TEST PG&E Bill for trigger',
      merchant_name: 'PG&E',
      expense_type: 'electricity',
      category: 'Test'
    });
    
    console.log(`✅ Inserted test electricity expense: ID ${testExpense.id}`);
    
    // Wait a moment for trigger to execute
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Check if payment requests were created
    const paymentRequests = await db.query(`
      SELECT roommate_name, amount, bill_type, total_amount 
      FROM payment_requests 
      WHERE bill_type = 'electricity' 
        AND total_amount = 300.00
      ORDER BY roommate_name
    `);
    
    console.log(`\n📋 Payment Requests Created: ${paymentRequests.rows.length}`);
    paymentRequests.rows.forEach(pr => {
      console.log(`  ${pr.roommate_name}: $${pr.amount} (${pr.bill_type}, total: $${pr.total_amount})`);
    });
    
    // Check if utility bill was created
    const utilityBill = await db.query(`
      SELECT * FROM utility_bills 
      WHERE bill_type = 'electricity' 
        AND total_amount = 300.00
        AND transaction_id = $1
    `, [testExpense.id]);
    
    console.log(`\n🧾 Utility Bill Created: ${utilityBill.rows.length > 0 ? 'YES' : 'NO'}`);
    if (utilityBill.rows.length > 0) {
      const bill = utilityBill.rows[0];
      console.log(`  Split amount: $${bill.split_amount} | Payment requested: ${bill.payment_requested}`);
    }
    
    console.log(`\n🎯 Trigger Test ${paymentRequests.rows.length === 2 && utilityBill.rows.length === 1 ? 'PASSED' : 'FAILED'}`);
    
    // Clean up test data
    await db.query('DELETE FROM payment_requests WHERE bill_type = $1 AND total_amount = $2', ['electricity', 300.00]);
    await db.query('DELETE FROM utility_bills WHERE bill_type = $1 AND total_amount = $2', ['electricity', 300.00]);
    await db.query('DELETE FROM expenses WHERE id = $1', [testExpense.id]);
    
    console.log('✅ Cleaned up test data');
    
  } catch (error) {
    console.error('❌ Error testing trigger:', error);
  } finally {
    process.exit(0);
  }
}

testUtilityTrigger();