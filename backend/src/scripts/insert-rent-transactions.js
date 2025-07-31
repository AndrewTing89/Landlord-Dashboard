const db = require('../db/connection');

async function insertRentTransactions() {
  try {
    console.log('💰 Inserting monthly rent transactions...\n');
    
    // Configuration
    const MONTHLY_RENT = 4200; // Adjust this to your actual rent amount
    const START_DATE = '2024-01-01'; // Adjust start date as needed
    const END_DATE = new Date().toISOString().split('T')[0]; // Today
    
    // Generate rent transactions for each month
    const startDate = new Date(START_DATE);
    const endDate = new Date(END_DATE);
    
    const rentTransactions = [];
    const currentDate = new Date(startDate);
    
    while (currentDate <= endDate) {
      // Set to the 1st of each month (or adjust to when rent is typically received)
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
    
    console.log(`📅 Creating ${rentTransactions.length} rent transactions from ${START_DATE} to ${END_DATE}\n`);
    
    // Insert rent transactions
    for (const rent of rentTransactions) {
      // Check if rent transaction already exists for this month
      const existing = await db.getOne(
        `SELECT id FROM transactions 
         WHERE expense_type = 'rent' 
         AND date >= $1::date - INTERVAL '5 days'
         AND date <= $1::date + INTERVAL '5 days'`,
        [rent.date]
      );
      
      if (existing) {
        console.log(`⏭️  Skipping ${rent.date} - rent transaction already exists`);
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
    }
    
    console.log('\n✨ Rent transactions inserted successfully!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

insertRentTransactions();