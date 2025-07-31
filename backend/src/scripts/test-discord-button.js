require('dotenv').config();
const axios = require('axios');

async function testDiscordButton() {
  const webhook = process.env.DISCORD_WEBHOOK_PAYMENT_REQUESTS;
  
  if (!webhook) {
    console.log('No webhook configured');
    return;
  }
  
  console.log('Testing Discord button support...\n');
  
  // Test 1: Simple button test
  try {
    await axios.post(webhook, {
      content: "Test: Can you see the button below?",
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: "Click Me - Google",
          url: "https://google.com"
        }]
      }]
    });
    console.log('✅ Simple button test sent');
  } catch (error) {
    console.error('❌ Simple button failed:', error.response?.data || error.message);
  }
  
  // Test 2: Embed with button
  try {
    await axios.post(webhook, {
      embeds: [{
        title: "Test Payment Request",
        description: "Testing Venmo button",
        color: 0x3D95CE,
        fields: [{
          name: "Amount",
          value: "$100.00",
          inline: true
        }]
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: "Pay on Venmo",
          url: "https://venmo.com/@andrewhting?txn=charge&amount=100.00&note=Test%20payment"
        }]
      }]
    });
    console.log('✅ Embed with button test sent');
  } catch (error) {
    console.error('❌ Embed with button failed:', error.response?.data || error.message);
  }
  
  // Test 3: Multiple format test
  try {
    await axios.post(webhook, {
      content: "**Option 1: Direct Link**\nhttps://venmo.com/@andrewhting?txn=charge&amount=50.00&note=Test%20direct%20link",
      embeds: [{
        title: "Option 2: Embed with Link",
        description: "[Click here to pay on Venmo](https://venmo.com/@andrewhting?txn=charge&amount=75.00&note=Test%20embed%20link)",
        color: 0x3D95CE
      }]
    });
    console.log('✅ Multiple format test sent');
  } catch (error) {
    console.error('❌ Multiple format failed:', error.response?.data || error.message);
  }
  
  console.log('\nCheck Discord for the test messages!');
}

testDiscordButton();