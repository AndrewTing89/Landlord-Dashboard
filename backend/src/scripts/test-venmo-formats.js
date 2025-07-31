const axios = require('axios');

async function testVenmoFormats() {
  console.log('Testing different Venmo URL formats...\n');
  
  const formats = [
    'https://venmo.com/u/UshiLo',  // New format with /u/
    'https://venmo.com/code?user_id=UshiLo',  // Alternative format
    'https://account.venmo.com/u/UshiLo',  // Direct to account with /u/
    'https://venmo.com/pay/UshiLo',  // Pay format
  ];
  
  // Also test the parameters
  const params = '?txn=charge&amount=100.00&note=Test';
  
  for (const baseUrl of formats) {
    const fullUrl = baseUrl + params;
    console.log(`Testing: ${fullUrl}`);
    
    try {
      const response = await axios.head(fullUrl, {
        maxRedirects: 5,
        validateStatus: (status) => true,
        timeout: 5000
      });
      
      console.log(`  Final status: ${response.status}`);
      console.log(`  Works: ${response.status < 400 ? '✅' : '❌'}`);
      
    } catch (error) {
      console.log(`  Error: ${error.message}`);
    }
    
    console.log('');
  }
  
  console.log('\n📱 RECOMMENDATION:');
  console.log('For Venmo deep links, use the mobile app format:');
  console.log('venmo://paycharge?txn=charge&recipients=UshiLo&amount=100.00&note=Test');
  console.log('\nThis will open directly in the Venmo app on mobile!');
}

testVenmoFormats();