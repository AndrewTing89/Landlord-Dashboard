const readline = require('readline');
const fs = require('fs').promises;
const path = require('path');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const question = (query) => new Promise((resolve) => rl.question(query, resolve));

async function configureTwilio() {
  console.log('🔧 Twilio Configuration Helper\n');
  console.log('This will help you set up Twilio for SMS notifications.\n');
  
  console.log('First, you need to:');
  console.log('1. Sign up at https://www.twilio.com/try-twilio');
  console.log('2. Get your Account SID and Auth Token from the dashboard');
  console.log('3. Buy or get a trial phone number\n');
  
  const proceed = await question('Have you completed these steps? (y/n): ');
  
  if (proceed.toLowerCase() !== 'y') {
    console.log('\nPlease complete the Twilio signup first, then run this script again.');
    rl.close();
    return;
  }
  
  console.log('\nGreat! Let\'s configure your credentials.\n');
  
  // Get credentials
  const accountSid = await question('Enter your Twilio Account SID (starts with AC): ');
  const authToken = await question('Enter your Twilio Auth Token: ');
  const fromNumber = await question('Enter your Twilio phone number (with country code, e.g., +14155551234): ');
  
  // Validate
  if (!accountSid.startsWith('AC') || accountSid.length !== 34) {
    console.log('\n❌ Invalid Account SID. It should start with AC and be 34 characters long.');
    rl.close();
    return;
  }
  
  if (authToken.length !== 32) {
    console.log('\n❌ Invalid Auth Token. It should be 32 characters long.');
    rl.close();
    return;
  }
  
  if (!fromNumber.match(/^\+1\d{10}$/)) {
    console.log('\n❌ Invalid phone number. Use format: +14155551234');
    rl.close();
    return;
  }
  
  // Read current .env
  const envPath = path.join(__dirname, '../../.env');
  let envContent = '';
  
  try {
    envContent = await fs.readFile(envPath, 'utf-8');
  } catch (error) {
    console.log('Creating new .env file...');
  }
  
  // Update or add Twilio settings
  const lines = envContent.split('\n');
  const newLines = [];
  let foundTwilio = false;
  
  for (const line of lines) {
    if (line.startsWith('TWILIO_ACCOUNT_SID=')) {
      newLines.push(`TWILIO_ACCOUNT_SID=${accountSid}`);
      foundTwilio = true;
    } else if (line.startsWith('TWILIO_AUTH_TOKEN=')) {
      newLines.push(`TWILIO_AUTH_TOKEN=${authToken}`);
    } else if (line.startsWith('TWILIO_FROM_NUMBER=')) {
      newLines.push(`TWILIO_FROM_NUMBER=${fromNumber}`);
    } else {
      newLines.push(line);
    }
  }
  
  // Add if not found
  if (!foundTwilio) {
    newLines.push('');
    newLines.push('# Twilio Configuration');
    newLines.push(`TWILIO_ACCOUNT_SID=${accountSid}`);
    newLines.push(`TWILIO_AUTH_TOKEN=${authToken}`);
    newLines.push(`TWILIO_FROM_NUMBER=${fromNumber}`);
  }
  
  // Write back
  await fs.writeFile(envPath, newLines.join('\n'));
  
  console.log('\n✅ Twilio configuration saved to .env file!');
  
  // Test
  const testNow = await question('\nWould you like to send a test SMS now? (y/n): ');
  
  if (testNow.toLowerCase() === 'y') {
    console.log('\nSending test SMS to +19298884132...\n');
    
    // Restart the environment
    require('dotenv').config();
    
    const { exec } = require('child_process');
    exec('node src/scripts/test-twilio-sms.js', (error, stdout, stderr) => {
      if (error) {
        console.error('Error:', error);
      }
      console.log(stdout);
      if (stderr) console.error(stderr);
      rl.close();
    });
  } else {
    console.log('\nYou can test later by running:');
    console.log('  node src/scripts/test-twilio-sms.js');
    rl.close();
  }
}

configureTwilio();