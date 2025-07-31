require('dotenv').config();
const discordService = require('../services/discordService');
const venmoLinkService = require('../services/venmoLinkService');

async function testVenmoDiscord() {
  console.log('🔗 Testing Venmo Link Generation and Discord Integration...\n');
  
  // Test data
  const testBill = {
    type: 'electricity',
    totalAmount: 450.75,
    splitAmount: 150.25,  // 1/3 of total
    merchantName: 'PG&E',
    month: 12,
    year: 2024
  };
  
  // Generate Venmo link
  const venmoUsername = '@andrewhting';  // Your Venmo username
  const note = `PG&E bill - December 2024 - Your share: $${testBill.splitAmount}`;
  
  const venmoLink = venmoLinkService.generateVenmoLink(
    venmoUsername,
    testBill.splitAmount,
    note
  );
  
  console.log('Generated Venmo Link:');
  console.log(venmoLink);
  console.log('');
  
  // Parse the link to verify
  const url = new URL(venmoLink);
  console.log('Link Breakdown:');
  console.log(`  Base URL: ${url.origin}${url.pathname}`);
  console.log(`  Username: ${url.pathname}`);
  console.log(`  Transaction Type: ${url.searchParams.get('txn')}`);
  console.log(`  Amount: $${url.searchParams.get('amount')}`);
  console.log(`  Note: ${decodeURIComponent(url.searchParams.get('note'))}`);
  console.log('');
  
  // Test different bill amounts
  console.log('Testing Various Bill Amounts:');
  const testAmounts = [
    { total: 300, split: 100 },
    { total: 450.75, split: 150.25 },
    { total: 567.89, split: 189.30 }
  ];
  
  testAmounts.forEach(({ total, split }) => {
    const link = venmoLinkService.generateVenmoLink(
      venmoUsername,
      split,
      `Test bill - Total: $${total}, Your share: $${split}`
    );
    console.log(`  $${total} bill → $${split} share`);
    console.log(`  ${link}`);
    console.log('');
  });
  
  // Send test to Discord
  if (process.env.DISCORD_WEBHOOK_PAYMENT_REQUESTS) {
    console.log('📤 Sending test payment request to Discord...\n');
    
    try {
      await discordService.sendPaymentRequest({
        billType: testBill.type,
        totalAmount: testBill.totalAmount,
        splitAmount: testBill.splitAmount,
        merchantName: testBill.merchantName,
        venmoLink: venmoLink,
        dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
        month: testBill.month,
        year: testBill.year
      });
      
      console.log('✅ Payment request sent to Discord!');
      console.log('');
      console.log('Check Discord for:');
      console.log('  - Clickable "Pay on Venmo" button');
      console.log('  - Correct amount: $' + testBill.splitAmount);
      console.log('  - Correct username: @andrewhting');
      console.log('  - Descriptive note about the bill');
    } catch (error) {
      console.error('❌ Discord error:', error.message);
    }
  }
  
  console.log('\n📱 To test on mobile:');
  console.log('1. Open Discord on your phone');
  console.log('2. Click the "Pay on Venmo" button');
  console.log('3. It should open Venmo with:');
  console.log('   - Recipient: @andrewhting');
  console.log('   - Amount: $' + testBill.splitAmount);
  console.log('   - Note: ' + note);
}

testVenmoDiscord();