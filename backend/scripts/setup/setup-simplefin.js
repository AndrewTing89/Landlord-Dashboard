#!/usr/bin/env node

const https = require('https');
const readline = require('readline');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('SimpleFIN Setup Helper');
console.log('======================\n');

rl.question('Please paste your SimpleFIN setup token: ', async (setupToken) => {
  try {
    // Step 1: Decode the setup token
    const claimUrl = Buffer.from(setupToken.trim(), 'base64').toString('utf-8');
    console.log('\n✓ Decoded claim URL:', claimUrl);
    
    // Step 2: Make POST request to claim URL
    console.log('\nExchanging setup token for access URL...');
    
    const url = new URL(claimUrl);
    const options = {
      hostname: url.hostname,
      port: url.port || 443,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'Content-Length': '0'
      }
    };
    
    const accessUrl = await new Promise((resolve, reject) => {
      const req = https.request(options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode === 200) {
            resolve(data.trim());
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });
      
      req.on('error', reject);
      req.end();
    });
    
    console.log('\n✅ SUCCESS! Your SimpleFIN access URL is:');
    console.log('\n' + accessUrl);
    
    console.log('\n📝 Add this to your .env file:');
    console.log(`SIMPLEFIN_TOKEN=${accessUrl}`);
    
    console.log('\n⚠️  IMPORTANT: Save this access URL now! The setup token can only be used once.');
    
    // Test the access URL
    console.log('\nTesting the access URL...');
    const testUrl = new URL(accessUrl + '/accounts');
    
    const testOptions = {
      hostname: testUrl.hostname,
      port: testUrl.port || 443,
      path: testUrl.pathname,
      method: 'GET',
      auth: testUrl.username + ':' + testUrl.password
    };
    
    https.get(testOptions, (res) => {
      if (res.statusCode === 200) {
        console.log('✅ Access URL is working! SimpleFIN is ready to use.');
      } else {
        console.log(`⚠️  Test returned status ${res.statusCode}`);
      }
      rl.close();
    }).on('error', (err) => {
      console.error('❌ Test failed:', err.message);
      rl.close();
    });
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    console.log('\nMake sure you pasted the complete setup token.');
    rl.close();
  }
});