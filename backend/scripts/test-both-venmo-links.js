require('dotenv').config();
const venmoLinkService = require('../src/services/venmoLinkService');
const roommateConfig = require('../config/roommate.config');

console.log('Testing Venmo Link Generation with Both Mobile and Web Links\n');
console.log('================================================================\n');

// Test payment details
const testAmount = 56.67;
const testNote = `⚡ PG&E Electricity Bill - Dec 2024
📊 Total Bill: $170.00
💰 Your Share (1/3): $56.67
✅ Already paid in full to PG&E [202412electricity]`;

console.log('Test Parameters:');
console.log('- Username:', roommateConfig.roommate.venmoUsername);
console.log('- Amount: $' + testAmount.toFixed(2));
console.log('- Note:', testNote.split('\n')[0] + '...');
console.log('\n');

// Generate both links
const links = venmoLinkService.generateVenmoLinks(
  roommateConfig.roommate.venmoUsername,
  testAmount,
  testNote
);

console.log('Generated Links:');
console.log('================\n');

console.log('📱 Mobile Link (Deep Link for Venmo App):');
console.log(links.mobile);
console.log('\nThis link will:');
console.log('- Open directly in the Venmo app on mobile');
console.log('- Pre-fill the amount: $' + testAmount.toFixed(2));
console.log('- Pre-fill the note with bill details');
console.log('- Set the payment type to "charge" (request)');
console.log('\n');

console.log('💻 Web Link (Browser Link):');
console.log(links.web);
console.log('\nThis link will:');
console.log('- Open Venmo in a web browser');
console.log('- Navigate to the user\'s profile');
console.log('- Allow manual payment request creation');
console.log('\n');

console.log('Testing Link Components:');
console.log('========================\n');

// Parse mobile link
const mobileUrl = new URL(links.mobile);
console.log('Mobile Link Breakdown:');
console.log('- Scheme:', mobileUrl.protocol.replace(':', ''));
console.log('- Host:', mobileUrl.hostname);
console.log('- Path:', mobileUrl.pathname);

// Parse parameters
const params = new URLSearchParams(mobileUrl.search);
console.log('\nMobile Link Parameters:');
params.forEach((value, key) => {
  if (key === 'note') {
    console.log(`- ${key}: "${decodeURIComponent(value).substring(0, 50)}..."`);
  } else {
    console.log(`- ${key}: ${value}`);
  }
});

console.log('\n');
console.log('Web Link Breakdown:');
console.log('- URL:', links.web);
console.log('- Will redirect to:', `https://venmo.com/${roommateConfig.roommate.venmoUsername.replace('@', '')}`);

console.log('\n================================================================');
console.log('✅ Both links generated successfully!');
console.log('\nNext Steps:');
console.log('1. Try the mobile link on your phone to open in Venmo app');
console.log('2. Try the web link on desktop to open in browser');
console.log('3. Verify that the mobile link pre-fills amount and note');

process.exit(0);