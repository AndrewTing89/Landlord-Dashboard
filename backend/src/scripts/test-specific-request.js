const axios = require('axios');

async function testSpecificRequest() {
  console.log('Testing send-sms endpoint directly...\n');
  
  try {
    // Get a pending request ID
    const response = await axios.post('http://localhost:3002/api/payment-requests/17/send-sms', {}, {
      headers: { 'Content-Type': 'application/json' }
    });
    
    console.log('Response from server:');
    console.log(JSON.stringify(response.data, null, 2));
    
    if (response.data.venmoLink) {
      console.log('\nVenmo link returned:');
      console.log(response.data.venmoLink);
      
      // Check if it has account.venmo.com
      if (response.data.venmoLink.includes('account.venmo.com')) {
        console.log('\n❌ ERROR: Link contains account.venmo.com!');
      } else {
        console.log('\n✅ Link is correct (no account.venmo.com)');
      }
      
      // Check username
      const url = new URL(response.data.venmoLink);
      console.log('\nParsed URL:');
      console.log(`  Host: ${url.host}`);
      console.log(`  Path: ${url.pathname}`);
    }
    
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

testSpecificRequest();