#!/usr/bin/env node

/**
 * Monthly Rent Payment Request Checker
 * 
 * This script should be scheduled to run on the 1st of every month
 * It will check if a rent payment request exists for the current month
 * and create one if it doesn't exist.
 * 
 * To schedule on Windows:
 * 1. Open Task Scheduler
 * 2. Create Basic Task
 * 3. Set trigger to Monthly, Day 1
 * 4. Set action to start program: node.exe
 * 5. Add arguments: "C:\Users\Andrews Razer Laptop\Desktop\onlyjobs-desktop\Landlord-Dashboard\backend\scripts\monthly-rent-check.js"
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createRentPaymentRequest, processRentPaymentRequests } = require('./create-rent-payment-request');

async function checkMonthlyRent() {
  console.log('🏠 Monthly Rent Check - ' + new Date().toLocaleString());
  console.log('=' .repeat(50));
  
  const currentDate = new Date();
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth() + 1;
  const rentAmount = parseFloat(process.env.MONTHLY_RENT || 1685);
  
  console.log(`\n📅 Checking rent for ${month}/${year}...`);
  
  try {
    // Only process for the current month
    const result = await createRentPaymentRequest(year, month, rentAmount);
    
    if (result.success) {
      console.log('✅ SUCCESS: ' + result.message);
      
      // Send Discord notification if webhook is configured
      if (process.env.DISCORD_WEBHOOK_PAYMENT) {
        const discordService = require('../src/services/discordService');
        await discordService.sendPaymentRequest('rent', rentAmount, rentAmount, `${year}-${month}`);
        console.log('📨 Discord notification sent');
      }
    } else if (result.exists) {
      console.log('ℹ️  ' + result.message);
    } else {
      console.log('❌ ERROR: ' + result.message);
    }
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  }
  
  console.log('\n' + '=' .repeat(50));
  console.log('✅ Monthly rent check complete');
  process.exit(0);
}

// Run the check
checkMonthlyRent();