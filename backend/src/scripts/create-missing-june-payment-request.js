#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');
const venmoLinkService = require('../services/venmoLinkService');
const discordService = require('../services/discordService');

async function createMissingPaymentRequest() {
  try {
    console.log('Creating missing June electricity payment request...\n');
    
    // Get the June electricity bill
    const juneBill = await db.getOne(
      `SELECT * FROM transactions 
       WHERE expense_type = 'electricity' 
       AND date = '2025-06-09'`
    );
    
    if (!juneBill) {
      console.log('June electricity bill not found!');
      return;
    }
    
    console.log(`Found June electricity bill: $${juneBill.amount}`);
    
    // Check if payment request already exists
    const existing = await db.getOne(
      `SELECT * FROM payment_requests 
       WHERE merchant_name = $1 
       AND month = 6 
       AND year = 2025`,
      [juneBill.merchant_name]
    );
    
    if (existing) {
      console.log('Payment request already exists!');
      return;
    }
    
    // Calculate split amount
    const totalAmount = parseFloat(juneBill.amount);
    const splitAmount = (totalAmount / 3).toFixed(2);
    
    // Create payment request
    const paymentRequest = await db.insert('payment_requests', {
      bill_type: 'electricity',
      merchant_name: juneBill.merchant_name || juneBill.name,
      amount: splitAmount,
      venmo_username: '@UshiLo',
      roommate_name: 'UshiLo',
      status: 'pending',
      request_date: new Date(),
      month: 6,
      year: 2025,
      charge_date: juneBill.date,
      created_at: new Date()
    });
    
    console.log(`✅ Created payment request ID ${paymentRequest.id}`);
    
    // Generate Venmo link
    const note = `PG&E bill for Jun 2025: Total $${totalAmount}, your share is $${splitAmount} (1/3). I've already paid the full amount.`;
    const venmoLink = venmoLinkService.generateVenmoLink('@UshiLo', parseFloat(splitAmount), note);
    
    // Update with Venmo link
    await db.query(
      'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
      [venmoLink, paymentRequest.id]
    );
    
    console.log('✅ Added Venmo link');
    
    // Send Discord notification
    try {
      await discordService.sendPaymentRequest({
        billType: 'electricity',
        totalAmount: totalAmount,
        splitAmount: splitAmount,
        merchantName: juneBill.merchant_name || juneBill.name,
        venmoLink: venmoLink,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        month: 6,
        year: 2025
      });
      
      console.log('✅ Discord notification sent');
    } catch (error) {
      console.error('Failed to send Discord notification:', error.message);
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

createMissingPaymentRequest();