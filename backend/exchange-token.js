const axios = require('axios');

// Replace this with your actual setup token
const SETUP_TOKEN = 'aHR0cHM6Ly9iZXRhLWJyaWRnZS5zaW1wbGVmaW4ub3JnL3NpbXBsZWZpbi9jbGFpbS9GMUVDMTc3NTc3MjE1NjRBQkU4MEVEQzFCNEI3MDE0NUIyMDEwNDIzRDZDNEE0MzVDM0M1RDU4MkQzODQyOTM5RkIzMzFBMzQxQjkwNTgwREY2OUVCRjNDQ0U2ODI2RjBCMTQyQ0NEMjRFNzhCNTVDQTI3MkU1NDkwRTYwQTM4RA==';

async function exchangeToken() {
  try {
    // 1. Decode the setup token to get claim URL
    const claimUrl = Buffer.from(SETUP_TOKEN, 'base64').toString('utf-8');
    console.log('Claim URL:', claimUrl);
    
    // 2. POST to claim URL to get access URL
    const response = await axios.post(claimUrl, null, {
      headers: { 'Content-Length': '0' }
    });
    
    console.log('\nYour Access URL is:');
    console.log(response.data);
    console.log('\nAdd this to your .env file as:');
    console.log(`SIMPLEFIN_TOKEN=${response.data}`);
    
  } catch (error) {
    console.error('Error:', error.message);
    if (error.response) {
      console.error('Response:', error.response.data);
    }
  }
}

exchangeToken();