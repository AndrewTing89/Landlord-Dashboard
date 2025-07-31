require('dotenv').config();
const discordService = require('../services/discordService');

async function testDiscord() {
  console.log('🎮 Testing Discord Webhooks...\n');
  
  // Check if webhooks are configured
  const webhookPayments = process.env.DISCORD_WEBHOOK_PAYMENT_REQUESTS;
  const webhookConfirmations = process.env.DISCORD_WEBHOOK_PAYMENT_CONFIRMATIONS;
  
  console.log('Webhook Configuration:');
  console.log(`  Payment Requests: ${webhookPayments ? '✅ Configured' : '❌ Not configured'}`);
  console.log(`  Payment Confirmations: ${webhookConfirmations ? '✅ Configured' : '❌ Not configured'}`);
  
  if (!webhookPayments) {
    console.log('\n❌ Discord webhook not configured!');
    console.log('\nTo configure:');
    console.log('1. Right-click #payment-requests channel in Discord');
    console.log('2. Edit Channel → Integrations → Webhooks');
    console.log('3. Create New Webhook');
    console.log('4. Copy the webhook URL');
    console.log('5. Add to .env: DISCORD_WEBHOOK_PAYMENT_REQUESTS=<webhook_url>');
    return;
  }
  
  console.log('\n📤 Sending test payment request to Discord...\n');
  
  // Test payment request
  try {
    await discordService.sendPaymentRequest({
      billType: 'water',
      totalAmount: 300,
      splitAmount: 100,
      merchantName: 'Great Oaks Water',
      venmoLink: 'https://venmo.com/@andrewhting?txn=charge&amount=100&note=Test%20water%20bill',
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(), // 7 days from now
      month: new Date().getMonth() + 1,
      year: new Date().getFullYear()
    });
    
    console.log('✅ Payment request sent to #payment-requests!');
  } catch (error) {
    console.error('❌ Failed to send payment request:', error.message);
  }
  
  // Test payment confirmation if configured
  if (webhookConfirmations) {
    console.log('\n📤 Sending test payment confirmation...\n');
    
    try {
      await discordService.sendPaymentConfirmation({
        billType: 'electricity',
        amount: 150,
        paidBy: 'Andrew',
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear()
      });
      
      console.log('✅ Payment confirmation sent to #payment-confirmations!');
    } catch (error) {
      console.error('❌ Failed to send payment confirmation:', error.message);
    }
  }
  
  // Test other webhooks if configured
  if (process.env.DISCORD_WEBHOOK_TRANSACTION_REVIEW) {
    console.log('\n📤 Sending test transaction review notification...\n');
    
    try {
      await discordService.sendTransactionReview(5);
      console.log('✅ Transaction review notification sent!');
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
  }
  
  if (process.env.DISCORD_WEBHOOK_SYNC_LOGS) {
    console.log('\n📤 Sending test sync status...\n');
    
    try {
      await discordService.sendSyncStatus('success', 'Imported 10 new transactions from Bank of America');
      console.log('✅ Sync status sent!');
    } catch (error) {
      console.error('❌ Failed:', error.message);
    }
  }
  
  console.log('\n🎉 Check your Discord server for the test messages!');
}

testDiscord();