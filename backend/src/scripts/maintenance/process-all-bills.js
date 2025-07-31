const db = require('../db/connection');
const moment = require('moment');
const venmoLinkService = require('../services/venmoLinkService');

async function processAllBills() {
  try {
    console.log('🏠 Processing all electricity and water bills...\n');
    
    // Get all electricity and water transactions grouped by month
    const transactions = await db.query(`
      SELECT 
        expense_type,
        EXTRACT(YEAR FROM date) as year,
        EXTRACT(MONTH FROM date) as month,
        SUM(amount) as total_amount,
        MIN(date) as first_date,
        MAX(date) as last_date,
        COUNT(*) as transaction_count,
        STRING_AGG(DISTINCT merchant_name, ', ') as merchants
      FROM transactions
      WHERE expense_type IN ('electricity', 'water')
      GROUP BY expense_type, EXTRACT(YEAR FROM date), EXTRACT(MONTH FROM date)
      ORDER BY year DESC, month DESC
    `);
    
    console.log(`Found ${transactions.rows.length} monthly bills to process\n`);
    
    let createdCount = 0;
    
    for (const monthlyBill of transactions.rows) {
      const { expense_type, year, month, total_amount, first_date, transaction_count, merchants } = monthlyBill;
      
      console.log(`\n📅 ${moment(`${year}-${String(month).padStart(2, '0')}-01`).format('MMM YYYY')} - ${expense_type}`);
      console.log(`   Amount: $${parseFloat(total_amount).toFixed(2)}`);
      console.log(`   Transactions: ${transaction_count}`);
      console.log(`   Merchant: ${merchants}`);
      
      // Check if utility bill already exists
      let utilityBill = await db.getOne(
        `SELECT * FROM utility_bills 
         WHERE bill_type = $1 
         AND EXTRACT(YEAR FROM created_at) = $2 
         AND EXTRACT(MONTH FROM created_at) = $3`,
        [expense_type, year, month]
      );
      
      if (!utilityBill) {
        // Create utility bill with split amount
        const roommateConfig = require('../../config/roommate.config');
        const splitAmount = parseFloat(total_amount) * roommateConfig.roommate.splitRatio;
        
        utilityBill = await db.insert('utility_bills', {
          bill_type: expense_type,
          total_amount: total_amount,
          split_amount: splitAmount.toFixed(2),
          month: parseInt(month),
          year: parseInt(year),
          created_at: first_date
        });
        console.log(`   ✅ Created utility bill #${utilityBill.id}`);
      } else {
        console.log(`   ⏭️  Utility bill already exists #${utilityBill.id}`);
      }
      
      // Check if payment request already exists
      const existingRequest = await db.getOne(
        'SELECT * FROM payment_requests WHERE utility_bill_id = $1',
        [utilityBill.id]
      );
      
      if (!existingRequest) {
        // Get the actual transactions for this bill
        const billTransactions = await db.query(
          `SELECT * FROM transactions 
           WHERE expense_type = $1 
           AND EXTRACT(YEAR FROM date) = $2 
           AND EXTRACT(MONTH FROM date) = $3`,
          [expense_type, year, month]
        );
        
        // Create payment request using the service
        try {
          const result = await venmoLinkService.createPaymentRequestsForBill(
            utilityBill,
            billTransactions.rows
          );
          
          if (result) {
            console.log(`   ✅ Created payment request for $${result.paymentRequest.amount}`);
            console.log(`   📱 SMS will be sent with Venmo link`);
            createdCount++;
          }
        } catch (error) {
          console.error(`   ❌ Error creating payment request: ${error.message}`);
        }
      } else {
        console.log(`   ⏭️  Payment request already exists`);
      }
    }
    
    console.log(`\n✨ Processing complete!`);
    console.log(`   Created ${createdCount} new payment requests`);
    console.log(`   Check your phone for SMS messages with Venmo links`);
    
    // Show summary
    const summary = await db.getOne(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(*) FILTER (WHERE status = 'pending') as pending,
        COUNT(*) FILTER (WHERE status = 'paid') as paid,
        SUM(amount) FILTER (WHERE status = 'pending') as pending_amount
      FROM payment_requests
    `);
    
    console.log(`\n📊 Payment Request Summary:`);
    console.log(`   Total requests: ${summary.total_requests}`);
    console.log(`   Pending: ${summary.pending} ($${parseFloat(summary.pending_amount || 0).toFixed(2)})`);
    console.log(`   Paid: ${summary.paid}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

processAllBills();