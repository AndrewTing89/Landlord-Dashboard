const db = require('../db/connection');
const rentConfig = require('../../config/rent.config');

async function insertMonthlyRent() {
  try {
    console.log(`🏠 Running monthly rent insertion - ${new Date().toISOString()}\n`);
    
    const MONTHLY_RENT = rentConfig.MONTHLY_RENT;
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();
    
    // Create rent date for the configured day of current month
    const rentDate = new Date(currentYear, currentMonth, rentConfig.RENT_DAY);
    const rentDateStr = rentDate.toISOString().split('T')[0];
    
    // Check if rent already exists for this month
    const existing = await db.getOne(
      `SELECT id, amount FROM transactions 
       WHERE expense_type = 'rent' 
       AND date >= $1::date - INTERVAL '5 days'
       AND date <= $1::date + INTERVAL '5 days'`,
      [rentDateStr]
    );
    
    if (existing) {
      console.log(`⏭️  Rent transaction already exists for ${rentDateStr}`);
      console.log(`   Existing amount: $${existing.amount}`);
      process.exit(0);
    }
    
    // Insert the rent transaction
    const result = await db.insert('transactions', {
      plaid_transaction_id: `rent_${rentDateStr}`,
      plaid_account_id: 'manual_rent',
      amount: MONTHLY_RENT,
      date: rentDateStr,
      name: rentConfig.RENT_DESCRIPTION,
      merchant_name: rentConfig.MERCHANT_NAME,
      expense_type: 'rent',
      category: 'Income',
      subcategory: 'Rental Income'
    });
    
    console.log(`✅ Successfully inserted rent for ${rentDateStr}: $${MONTHLY_RENT}`);
    console.log(`   Transaction ID: ${result.id}`);
    
    // Send notification if configured
    if (rentConfig.SEND_NOTIFICATIONS && rentConfig.NOTIFICATION_EMAIL) {
      console.log(`📧 Notification would be sent to: ${rentConfig.NOTIFICATION_EMAIL}`);
      // TODO: Implement email notification using existing email service
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error inserting monthly rent:', error);
    process.exit(1);
  }
}

// Run the function
insertMonthlyRent();