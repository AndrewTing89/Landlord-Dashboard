require('dotenv').config();
const twilio = require('twilio');

async function diagnoseTwilio() {
  console.log('🔍 Diagnosing Twilio Configuration...\n');
  
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_FROM_NUMBER;
  
  if (!accountSid || !authToken || !fromNumber) {
    console.log('❌ Missing Twilio credentials');
    return;
  }
  
  const client = twilio(accountSid, authToken);
  
  try {
    // 1. Check account details
    console.log('1. Checking account status...');
    const account = await client.api.accounts(accountSid).fetch();
    console.log(`   Status: ${account.status}`);
    console.log(`   Type: ${account.type}`);
    console.log(`   Friendly Name: ${account.friendlyName}`);
    
    // 2. Check phone number
    console.log('\n2. Checking phone number...');
    const phoneNumbers = await client.incomingPhoneNumbers.list({limit: 20});
    const myNumber = phoneNumbers.find(pn => pn.phoneNumber === fromNumber);
    
    if (!myNumber) {
      console.log(`   ❌ Phone number ${fromNumber} not found in your account`);
      console.log('   Available numbers:');
      phoneNumbers.forEach(pn => {
        console.log(`     - ${pn.phoneNumber} (${pn.friendlyName})`);
      });
    } else {
      console.log(`   ✅ Phone number verified: ${myNumber.phoneNumber}`);
      console.log(`   SMS Enabled: ${myNumber.capabilities.sms}`);
      console.log(`   Voice Enabled: ${myNumber.capabilities.voice}`);
    }
    
    // 3. Check if trial account and verified numbers
    if (account.type === 'Trial') {
      console.log('\n3. Trial Account Detected!');
      console.log('   ⚠️  Trial accounts can only send SMS to verified numbers');
      
      // Check verified numbers
      const verifiedNumbers = await client.validationRequests.list({limit: 20});
      console.log('\n   Verified phone numbers:');
      if (verifiedNumbers.length === 0) {
        console.log('     ❌ No verified numbers found');
        console.log('\n   To verify +19298884132:');
        console.log('   1. Go to https://console.twilio.com/us1/develop/phone-numbers/manage/verified');
        console.log('   2. Click "Add a new Caller ID"');
        console.log('   3. Enter +19298884132 and follow verification steps');
      } else {
        verifiedNumbers.forEach(vn => {
          console.log(`     - ${vn.phoneNumber} (${vn.status})`);
        });
      }
    }
    
    // 4. Check recent messages
    console.log('\n4. Recent message attempts (last 10):');
    const messages = await client.messages.list({limit: 10});
    
    messages.forEach(msg => {
      const status = msg.status === 'delivered' ? '✅' : 
                    msg.status === 'failed' ? '❌' : 
                    msg.status === 'undelivered' ? '⚠️' : '🔄';
      console.log(`   ${status} ${msg.to} - ${msg.status} (${msg.dateSent || msg.dateCreated})`);
      if (msg.errorCode) {
        console.log(`      Error ${msg.errorCode}: ${msg.errorMessage}`);
      }
    });
    
    // 5. Try to get more details about the last message
    if (messages.length > 0) {
      const lastMsg = messages[0];
      if (lastMsg.status === 'failed' || lastMsg.status === 'undelivered') {
        console.log(`\n5. Last failed message details:`);
        console.log(`   SID: ${lastMsg.sid}`);
        console.log(`   Error Code: ${lastMsg.errorCode}`);
        console.log(`   Error Message: ${lastMsg.errorMessage}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.code === 20003) {
      console.log('\n❌ Authentication failed. Please check your Account SID and Auth Token.');
    }
  }
}

diagnoseTwilio();