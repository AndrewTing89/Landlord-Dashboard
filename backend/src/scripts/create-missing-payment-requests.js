#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');
const venmoLinkService = require('../services/venmoLinkService');

async function createMissingPaymentRequests() {
  try {
    console.log('Checking for utility bills without payment requests...\n');
    
    // Find utility bills that don't have payment requests
    const missingBills = await db.query(
      `SELECT t.* FROM transactions t
       WHERE t.expense_type IN ('electricity', 'water', 'internet')
       AND NOT EXISTS (
         SELECT 1 FROM payment_requests pr 
         WHERE pr.merchant_name = t.merchant_name 
         AND pr.month = EXTRACT(MONTH FROM t.date)
         AND pr.year = EXTRACT(YEAR FROM t.date)
       )
       ORDER BY t.date DESC`
    );
    
    console.log(`Found ${missingBills.rows.length} bills without payment requests:`);
    
    for (const bill of missingBills.rows) {
      console.log(`\n💡 Creating payment request for ${bill.expense_type} from ${bill.date}`);
      console.log(`   Merchant: ${bill.merchant_name}`);
      console.log(`   Total: $${bill.amount}`);
      
      // Calculate split amount
      const totalAmount = parseFloat(bill.amount);
      const splitAmount = (totalAmount / 3).toFixed(2);
      console.log(`   Split (1/3): $${splitAmount}`);
      
      // Create payment request
      const paymentRequest = await db.insert('payment_requests', {
        bill_type: bill.expense_type,
        merchant_name: bill.merchant_name,
        amount: splitAmount,
        venmo_username: '@UshiLo',
        roommate_name: 'UshiLo',
        status: 'pending',
        request_date: new Date(),
        month: new Date(bill.date).getMonth() + 1,
        year: new Date(bill.date).getFullYear(),
        charge_date: bill.date,
        created_at: new Date()
      });
      
      // Generate Venmo link
      const monthName = new Date(bill.date).toLocaleString('default', { month: 'short' });
      const utilityName = bill.expense_type === 'electricity' ? 'PG&E' : 
                          bill.expense_type === 'water' ? 'Water' :
                          'Internet';
      const note = `${utilityName} bill for ${monthName} ${new Date(bill.date).getFullYear()}: Total $${totalAmount}, your share is $${splitAmount} (1/3). I've already paid the full amount.`;
      
      const venmoLink = venmoLinkService.generateVenmoLink('@UshiLo', parseFloat(splitAmount), note);
      
      // Update with Venmo link
      await db.query(
        'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
        [venmoLink, paymentRequest.id]
      );
      
      console.log(`   ✅ Payment request created (ID: ${paymentRequest.id})`);
    }
    
    console.log('\n✅ All missing payment requests have been created!');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

createMissingPaymentRequests();