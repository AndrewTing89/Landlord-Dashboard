const db = require('../src/db/connection');

async function investigatePaymentRequests() {
  try {
    console.log('🔍 INVESTIGATING PAYMENT REQUEST CREATION');
    console.log('=' + '='.repeat(50));
    
    // Check if any payment requests were created
    const paymentRequests = await db.query(`
      SELECT id, expense_id, bill_type, amount, total_amount, status, created_at
      FROM payment_requests 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`\n📋 Recent Payment Requests: ${paymentRequests.rows.length}`);
    paymentRequests.rows.forEach(pr => {
      console.log(`  ${pr.bill_type} - $${pr.amount} (total: $${pr.total_amount}) - ${pr.status}`);
    });
    
    // Check auto-approved utility expenses
    const utilityExpenses = await db.query(`
      SELECT id, name, expense_type, amount, date, created_at
      FROM expenses 
      WHERE expense_type IN ('electricity', 'water')
      ORDER BY created_at DESC
    `);
    
    console.log(`\n⚡ Auto-Approved Utility Expenses: ${utilityExpenses.rows.length}`);
    utilityExpenses.rows.forEach(exp => {
      console.log(`  ${exp.expense_type}: ${exp.name} - $${exp.amount} (${exp.date})`);
    });
    
    // Check utility bills table
    const utilityBills = await db.query(`
      SELECT id, expense_id, bill_type, total_amount, month, year, created_at
      FROM utility_bills 
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    console.log(`\n🧾 Utility Bills Created: ${utilityBills.rows.length}`);
    utilityBills.rows.forEach(bill => {
      console.log(`  ${bill.bill_type} - $${bill.total_amount} (${bill.month}/${bill.year}) - expense_id: ${bill.expense_id}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

investigatePaymentRequests();