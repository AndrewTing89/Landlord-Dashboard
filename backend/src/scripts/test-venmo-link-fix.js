require('dotenv').config();
const venmoLinkService = require('../services/venmoLinkService');
const discordService = require('../services/discordService');

async function testVenmoLinkFix() {
  console.log('🔗 Testing Fixed Venmo Links...\n');
  
  // Test with @ symbol
  const username1 = '@andrewhting';
  const username2 = 'andrewhting';
  const amount = 100.00;
  const note = 'Test payment - Water bill';
  
  const link1 = venmoLinkService.generateVenmoLink(username1, amount, note);
  const link2 = venmoLinkService.generateVenmoLink(username2, amount, note);
  
  console.log('Generated Links:');
  console.log('With @:', link1);
  console.log('Without @:', link2);
  console.log('');
  
  // The correct format should be:
  console.log('✅ Correct Venmo URL format:');
  console.log('https://venmo.com/andrewhting?txn=charge&amount=100.00&note=...');
  console.log('(No @ in the URL path)');
  console.log('');
  
  // Send test to Discord
  if (process.env.DISCORD_WEBHOOK_PAYMENT_REQUESTS) {
    console.log('📤 Sending corrected link to Discord...\n');
    
    try {
      await discordService.sendPaymentRequest({
        billType: 'water',
        totalAmount: 300,
        splitAmount: 100,
        merchantName: 'Great Oaks Water',
        venmoLink: link1,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      });
      
      console.log('✅ Sent to Discord!');
      console.log('');
      console.log('The message should now have:');
      console.log('1. A clickable link in the description');
      console.log('2. Another clickable link in the fields');
      console.log('3. Both should open Venmo correctly');
    } catch (error) {
      console.error('❌ Discord error:', error.message);
    }
  }
}

testVenmoLinkFix();