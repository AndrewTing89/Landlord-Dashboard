const venmoLinkService = require('../services/venmoLinkService');
const { sendSMS } = require('../services/notificationService');
const roommateConfig = require('../../config/roommate.config');

async function testVenmoSMS() {
  try {
    console.log('🧪 Testing Venmo link generation and SMS...\n');
    
    // Test data
    const testAmount = 150.50;
    const testBillType = 'electricity';
    const testNote = `Test: PG&E bill for Jan 2025: Total $451.50, your share is $150.50 (1/3). I've already paid the full amount.`;
    
    console.log('Configuration:');
    console.log(`  Roommate: ${roommateConfig.roommate.name} (@${roommateConfig.roommate.venmoUsername})`);
    console.log(`  Your phone: ${roommateConfig.landlord.phoneNumber}`);
    console.log(`  Split ratio: ${roommateConfig.roommate.splitRatio} (1/3)`);
    
    // Generate Venmo link
    const venmoLink = venmoLinkService.generateVenmoLink(
      roommateConfig.roommate.venmoUsername,
      testAmount,
      testNote
    );
    
    console.log('\n📱 Generated Venmo link:');
    console.log(`  ${venmoLink}`);
    
    // Test SMS
    console.log('\n📨 Sending test SMS...');
    const smsMessage = `TEST: ${roommateConfig.messageTemplates.sms(testBillType, venmoLink)}`;
    
    try {
      const result = await sendSMS(
        roommateConfig.landlord.phoneNumber,
        smsMessage
      );
      console.log('✅ SMS sent successfully!');
      console.log(`  Message ID: ${result.sid}`);
    } catch (smsError) {
      console.error('❌ SMS failed:', smsError.message);
      console.log('\nMake sure Twilio is configured with:');
      console.log('  TWILIO_ACCOUNT_SID');
      console.log('  TWILIO_AUTH_TOKEN');
      console.log('  TWILIO_PHONE_NUMBER');
    }
    
    console.log('\n🎯 Next steps:');
    console.log('1. Check your phone for the SMS');
    console.log('2. Click the Venmo link');
    console.log('3. Verify it opens Venmo with correct amount and note');
    console.log('4. Update roommate Venmo username in .env file');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
  
  process.exit(0);
}

testVenmoSMS();