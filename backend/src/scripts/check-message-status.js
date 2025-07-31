require('dotenv').config();
const twilio = require('twilio');

async function checkMessageStatus() {
  const client = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  
  console.log('📱 Checking recent SMS messages to +19298884132...\n');
  
  try {
    const messages = await client.messages.list({
      to: '+19298884132',
      limit: 10
    });
    
    if (messages.length === 0) {
      console.log('No messages found to this number.');
      return;
    }
    
    messages.forEach((msg, index) => {
      console.log(`Message ${index + 1}:`);
      console.log(`  SID: ${msg.sid}`);
      console.log(`  Status: ${msg.status}`);
      console.log(`  Sent: ${msg.dateSent || 'Not sent yet'}`);
      console.log(`  Created: ${msg.dateCreated}`);
      console.log(`  Direction: ${msg.direction}`);
      console.log(`  From: ${msg.from}`);
      console.log(`  Price: ${msg.price || 'N/A'}`);
      
      if (msg.errorCode) {
        console.log(`  ❌ Error Code: ${msg.errorCode}`);
        console.log(`  ❌ Error Message: ${msg.errorMessage}`);
      }
      
      console.log('---');
    });
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkMessageStatus();