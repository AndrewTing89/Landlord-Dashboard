#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');
const venmoMatchingService = require('../src/services/venmoMatchingService');

async function matchRentEmails() {
  console.log('📧 Matching Rent Payment Emails to Payment Requests\n');
  
  try {
    // Find unmatched Venmo emails that look like rent payments
    const rentEmails = await db.query(`
      SELECT * FROM venmo_emails
      WHERE venmo_amount >= 1585
      AND venmo_actor ILIKE '%ushi%'
      AND matched = false
      ORDER BY received_date
    `);
    
    console.log(`Found ${rentEmails.rows.length} potential rent payment emails\n`);
    
    let matched = 0;
    
    for (const email of rentEmails.rows) {
      console.log(`Processing email from ${email.received_date}:`);
      console.log(`  Actor: ${email.venmo_actor}`);
      console.log(`  Amount: $${email.venmo_amount}`);
      console.log(`  Note: ${email.venmo_note || 'No note'}`);
      
      // Try to match using the service
      const result = await venmoMatchingService.matchPaymentEmail(email);
      
      if (result.matched) {
        console.log(`  ✅ Matched to payment request #${result.payment_request_id}\n`);
        matched++;
      } else {
        console.log(`  ❌ No match found (${result.reason})\n`);
      }
    }
    
    console.log('='.repeat(60));
    console.log(`Summary: Matched ${matched} of ${rentEmails.rows.length} emails`);
    
    // Show current state of rent payment requests
    const rentRequests = await db.query(`
      SELECT pr.*, ve.venmo_actor, ve.venmo_amount, ve.received_date as payment_date
      FROM payment_requests pr
      LEFT JOIN venmo_emails ve ON ve.payment_request_id = pr.id
      WHERE pr.bill_type = 'rent'
      ORDER BY pr.year, pr.month
    `);
    
    console.log('\n📊 Rent Payment Request Status:');
    console.log('Month'.padEnd(15) + 'Status'.padEnd(12) + 'Amount'.padEnd(10) + 'Paid By'.padEnd(20) + 'Payment Date');
    console.log('-'.repeat(70));
    
    rentRequests.rows.forEach(req => {
      const month = `${req.month}/${req.year}`.padEnd(15);
      const status = req.status.padEnd(12);
      const amount = `$${req.amount}`.padEnd(10);
      const paidBy = (req.venmo_actor || '-').padEnd(20);
      const paymentDate = req.payment_date ? new Date(req.payment_date).toLocaleDateString() : '-';
      
      console.log(month + status + amount + paidBy + paymentDate);
    });
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

matchRentEmails();