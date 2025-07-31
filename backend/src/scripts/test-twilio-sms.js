require('dotenv').config();

async function testTwilioSMS() {
  console.log('🔍 Checking Twilio Configuration...\n');
  
  // Check environment variables
  const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
  const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
  const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;
  
  console.log('Environment Variables:');
  console.log(`  TWILIO_ACCOUNT_SID: ${twilioAccountSid ? twilioAccountSid.substring(0, 10) + '...' : 'NOT SET'}`);
  console.log(`  TWILIO_AUTH_TOKEN: ${twilioAuthToken ? '***SET***' : 'NOT SET'}`);
  console.log(`  TWILIO_FROM_NUMBER: ${twilioFromNumber || 'NOT SET'}`);
  
  if (!twilioAccountSid || !twilioAuthToken || !twilioFromNumber) {
    console.log('\n❌ Twilio is not configured!');
    console.log('\nTo configure Twilio:');
    console.log('1. Sign up for a Twilio account at https://www.twilio.com');
    console.log('2. Get your Account SID and Auth Token from the Twilio Console');
    console.log('3. Buy a phone number from Twilio');
    console.log('4. Add these to your .env file:');
    console.log('   TWILIO_ACCOUNT_SID=your_account_sid');
    console.log('   TWILIO_AUTH_TOKEN=your_auth_token');
    console.log('   TWILIO_FROM_NUMBER=+1234567890 (your Twilio phone number)');
    return;
  }
  
  console.log('\n✅ Twilio credentials found!\n');
  
  // Try to initialize Twilio
  let twilioClient;
  try {
    const twilio = require('twilio');
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    console.log('✅ Twilio client initialized successfully!\n');
  } catch (error) {
    console.error('❌ Failed to initialize Twilio:', error.message);
    return;
  }
  
  // Generate a test Venmo link
  const testAmount = 100.00;
  const testNote = encodeURIComponent('Test utility payment - Water bill');
  const venmoLink = `https://venmo.com/@andrewhting?txn=charge&amount=${testAmount}&note=${testNote}`;
  
  // Prepare test message
  const testMessage = `🧪 TEST MESSAGE from Landlord Dashboard\n\nHi! This is a test of the Venmo payment request system.\n\nTest bill: $${testAmount}\nYour share: $${(testAmount/3).toFixed(2)}\n\nPay here: ${venmoLink}`;
  
  console.log('📱 Sending test SMS to: +19298884132');
  console.log('Message preview:');
  console.log('---');
  console.log(testMessage);
  console.log('---\n');
  
  try {
    const message = await twilioClient.messages.create({
      body: testMessage,
      from: twilioFromNumber,
      to: '+19298884132'
    });
    
    console.log('✅ SMS sent successfully!');
    console.log(`   Message SID: ${message.sid}`);
    console.log(`   Status: ${message.status}`);
    console.log(`   From: ${message.from}`);
    console.log(`   To: ${message.to}`);
    console.log('\n🎉 Twilio is working! Check your phone for the test message.');
  } catch (error) {
    console.error('❌ Failed to send SMS:', error.message);
    if (error.code) {
      console.error(`   Error code: ${error.code}`);
    }
    console.log('\nCommon issues:');
    console.log('- Phone number not verified (trial accounts)');
    console.log('- Invalid phone number format');
    console.log('- Insufficient balance');
    console.log('- Wrong credentials');
  }
}

testTwilioSMS();