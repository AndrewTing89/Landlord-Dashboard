require('dotenv').config();
const discordService = require('../services/discordService');
const db = require('../db/connection');

async function testJulyWaterDiscord() {
  console.log('🧪 Testing July 2025 Water Bill Discord Message\n');
  
  // Get the July water bill
  const request = await db.getOne(
    `SELECT * FROM payment_requests 
     WHERE bill_type = 'water' AND month = 7 AND year = 2025 AND amount = 173.40`
  );
  
  if (!request) {
    console.log('❌ Could not find July 2025 water bill');
    return;
  }
  
  console.log('Found request:');
  console.log(`  ID: ${request.id}`);
  console.log(`  Amount: $${request.amount}`);
  console.log(`  Venmo Link: ${request.venmo_link}`);
  console.log('');
  
  // Send to Discord exactly as the endpoint would
  const notificationData = {
    billType: request.bill_type,
    totalAmount: parseFloat(request.amount) * 3,  // Total bill
    splitAmount: request.amount,
    merchantName: request.merchant_name || 'Great Oaks Water',
    venmoLink: request.venmo_link,  // This is the key - using the DB link
    dueDate: 'Aug 1, 2025',
    month: request.month,
    year: request.year
  };
  
  console.log('Sending to Discord with:');
  console.log(`  Venmo Link: ${notificationData.venmoLink}`);
  console.log('');
  
  try {
    await discordService.sendPaymentRequest(notificationData);
    console.log('✅ Sent to Discord successfully!');
    console.log('\nThe Discord message should have:');
    console.log('- "Click here to make a Venmo request" link');
    console.log('- Link goes to: https://venmo.com/u/UshiLo');
    console.log('- Amount: $173.40');
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
  
  process.exit(0);
}

testJulyWaterDiscord().catch(console.error);