const db = require('../src/db/connection');

async function backfillPaymentRequests() {
  try {
    console.log('🔄 Backfilling payment requests for existing utility expenses...');
    
    // Get existing utility expenses that don't have payment requests
    const utilityExpenses = await db.query(`
      SELECT e.id, e.name, e.expense_type, e.amount, e.date, e.created_at
      FROM expenses e
      WHERE e.expense_type IN ('electricity', 'water')
      ORDER BY e.date DESC
    `);
    
    console.log(`Found ${utilityExpenses.rows.length} existing utility expenses`);
    
    for (const expense of utilityExpenses.rows) {
      console.log(`\n💡 Processing: ${expense.expense_type} - $${expense.amount} (${expense.date})`);
      
      // Check if payment requests already exist for this expense
      const existingRequests = await db.query(`
        SELECT COUNT(*) as count 
        FROM payment_requests 
        WHERE bill_type = $1 
          AND total_amount = $2 
          AND EXTRACT(MONTH FROM request_date) = EXTRACT(MONTH FROM $3::date)
          AND EXTRACT(YEAR FROM request_date) = EXTRACT(YEAR FROM $3::date)
      `, [expense.expense_type, expense.amount, expense.date]);
      
      if (existingRequests.rows[0].count > 0) {
        console.log(`  ⏭️  Skip - payment requests already exist`);
        continue;
      }
      
      // Create payment requests manually (trigger doesn't fire for existing data)
      const splitAmount = expense.amount / 3;
      const roommates = [
        { name: 'Ushi Lo', venmo_username: '@UshiLo' },
        { name: 'Eileen', venmo_username: '@eileen-venmo' }
      ];
      
      for (const roommate of roommates) {
        await db.insert('payment_requests', {
          roommate_name: roommate.name,
          venmo_username: roommate.venmo_username,
          amount: splitAmount,
          request_date: expense.date,
          status: 'pending',
          bill_type: expense.expense_type,
          month: new Date(expense.date).getMonth() + 1,
          year: new Date(expense.date).getFullYear(),
          total_amount: expense.amount,
          tracking_id: `${new Date(expense.date).getFullYear()}${String(new Date(expense.date).getMonth() + 1).padStart(2, '0')}${expense.expense_type}`,
          created_at: new Date()
        });
      }
      
      // Create utility_bills record
      await db.insert('utility_bills', {
        transaction_id: expense.id,
        bill_type: expense.expense_type,
        total_amount: expense.amount,
        split_amount: splitAmount,
        month: new Date(expense.date).getMonth() + 1,
        year: new Date(expense.date).getFullYear(),
        payment_requested: true,
        created_at: new Date()
      });
      
      console.log(`  ✅ Created 2 payment requests + utility bill record`);
    }
    
    // Summary
    const totalRequests = await db.query(`SELECT COUNT(*) as count FROM payment_requests`);
    const totalBills = await db.query(`SELECT COUNT(*) as count FROM utility_bills`);
    
    console.log(`\n📊 FINAL SUMMARY:`);
    console.log(`  Total payment requests: ${totalRequests.rows[0].count}`);
    console.log(`  Total utility bills: ${totalBills.rows[0].count}`);
    console.log(`  ✅ Backfill complete!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

backfillPaymentRequests();