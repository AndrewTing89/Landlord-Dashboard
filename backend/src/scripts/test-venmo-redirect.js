const axios = require('axios');

async function testVenmoRedirect() {
  console.log('Testing if Venmo redirects URLs...\n');
  
  const testUrls = [
    'https://venmo.com/UshiLo?txn=charge&amount=100.00&note=Test',
    'https://venmo.com/@UshiLo?txn=charge&amount=100.00&note=Test',
    'https://account.venmo.com/UshiLo?txn=charge&amount=100.00&note=Test'
  ];
  
  for (const url of testUrls) {
    console.log(`Testing: ${url}`);
    
    try {
      // Make a HEAD request to see where it redirects
      const response = await axios.head(url, {
        maxRedirects: 0,
        validateStatus: (status) => status < 400
      });
      
      console.log(`  Status: ${response.status}`);
      console.log(`  Location header: ${response.headers.location || 'None'}`);
      
      if (response.status === 301 || response.status === 302) {
        console.log(`  → Redirects to: ${response.headers.location}`);
      } else {
        console.log(`  → No redirect`);
      }
    } catch (error) {
      if (error.response) {
        console.log(`  Status: ${error.response.status}`);
        console.log(`  Location: ${error.response.headers.location || 'None'}`);
      } else {
        console.log(`  Error: ${error.message}`);
      }
    }
    
    console.log('');
  }
}

testVenmoRedirect();