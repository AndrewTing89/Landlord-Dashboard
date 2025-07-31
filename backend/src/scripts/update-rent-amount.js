const db = require('../db/connection');

async function updateRentAmount() {
  try {
    console.log('💰 Updating rent transactions to $1,685/month...\n');
    
    // First, remove existing manual rent transactions
    const deleteResult = await db.query(`
      DELETE FROM transactions 
      WHERE plaid_transaction_id LIKE 'rent_%'
        AND expense_type = 'rent'
      RETURNING id, date, amount
    `);
    
    console.log(`🗑️  Removed ${deleteResult.rowCount} existing rent transactions\n`);
    
    // Configuration
    const MONTHLY_RENT = 1685; // Updated rent amount
    const START_DATE = '2024-01-01';
    const END_DATE = new Date().toISOString().split('T')[0];
    
    // Generate rent transactions for each month
    const startDate = new Date(START_DATE);
    const endDate = new Date(END_DATE);
    
    const rentTransactions = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Always set to the 1st of each month
      const rentDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      
      // Only add if the date is not in the future
      if (rentDate <= endDate) {
        rentTransactions.push({
          date: rentDate.toISOString().split('T')[0],
          amount: MONTHLY_RENT,
          description: 'Monthly Rent Payment',
          expense_type: 'rent'
        });
      }
      
      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
    
    console.log(`📅 Creating ${rentTransactions.length} rent transactions at $${MONTHLY_RENT}/month\n`);
    
    // Insert rent transactions
    let insertCount = 0;
    for (const rent of rentTransactions) {
      // Check if any rent transaction already exists for this month (from other sources)
      const existing = await db.getOne(
        `SELECT id FROM transactions 
         WHERE expense_type = 'rent' 
         AND date >= $1::date - INTERVAL '5 days'
         AND date <= $1::date + INTERVAL '5 days'
         AND plaid_transaction_id NOT LIKE 'rent_%'`,
        [rent.date]
      );
      
      if (existing) {
        console.log(`⏭️  Skipping ${rent.date} - other rent transaction exists`);
        continue;
      }
      
      // Insert the rent transaction
      await db.insert('transactions', {
        plaid_transaction_id: `rent_${rent.date}`,
        plaid_account_id: 'manual_rent',
        amount: rent.amount,
        date: rent.date,
        name: rent.description,
        merchant_name: 'Tenant',
        expense_type: rent.expense_type,
        category: 'Income',
        subcategory: 'Rental Income'
      });
      
      console.log(`✅ Added rent for ${rent.date}: $${rent.amount}`);
      insertCount++;
    }
    
    console.log(`\n✨ Successfully inserted ${insertCount} rent transactions at $${MONTHLY_RENT}/month!`);
    
    // Show summary
    const summary = await db.getOne(`
      SELECT 
        COUNT(*) as count,
        SUM(amount) as total,
        MIN(date) as first_date,
        MAX(date) as last_date
      FROM transactions
      WHERE expense_type = 'rent'
        AND plaid_transaction_id LIKE 'rent_%'
    `);
    
    console.log('\n📊 Rent Transaction Summary:');
    console.log(`   Total transactions: ${summary.count}`);
    console.log(`   Total amount: $${parseFloat(summary.total).toFixed(2)}`);
    console.log(`   Date range: ${summary.first_date.toISOString().split('T')[0]} to ${summary.last_date.toISOString().split('T')[0]}`);
    console.log(`   Monthly rent: $${MONTHLY_RENT}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateRentAmount();