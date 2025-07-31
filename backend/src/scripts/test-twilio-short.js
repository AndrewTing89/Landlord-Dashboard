require('dotenv').config();
const twilio = require('twilio');

async function testTwilioShortSMS() {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  
  // Short message under 160 characters for trial account
  const shortMessage = `Water bill $300. Your share: $100. Pay: https://venmo.com/@andrewhting?txn=charge&amount=100`;
  
  console.log('📱 Sending SHORT test SMS to: +19298884132');
  console.log(`Message length: ${shortMessage.length} characters`);
  console.log('Message:', shortMessage);
  console.log('');
  
  try {
    const message = await client.messages.create({
      body: shortMessage,
      from: process.env.TWILIO_FROM_NUMBER,
      to: '+19298884132'
    });
    
    console.log('✅ SMS sent successfully!');
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    
    // Wait 3 seconds then check status
    setTimeout(async () => {
      const updatedMessage = await client.messages(message.sid).fetch();
      console.log(`\n📊 Status after 3 seconds: ${updatedMessage.status}`);
      if (updatedMessage.errorCode) {
        console.log(`   Error: ${updatedMessage.errorCode} - ${updatedMessage.errorMessage}`);
      }
    }, 3000);
    
  } catch (error) {
    console.error('❌ Failed to send SMS:', error.message);
  }
}

testTwilioShortSMS();