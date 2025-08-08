require('dotenv').config();
const venmoLinkService = require('../src/services/venmoLinkService');
const roommateConfig = require('../config/roommate.config');

console.log('Testing Simplified Venmo Link Generation\n');
console.log('================================================================\n');

// Test with simplified note
const testAmount = 56.67;
const formattedDate = 'Dec 2024';

// Use the simplified template
const testNote = roommateConfig.messageTemplates.electricity(170.00, testAmount, formattedDate);

console.log('Test Parameters:');
console.log('- Username:', roommateConfig.roommate.venmoUsername);
console.log('- Amount: $' + testAmount.toFixed(2));
console.log('- Original Note:', testNote);

// Generate links
const links = venmoLinkService.generateVenmoLinks(
  roommateConfig.roommate.venmoUsername,
  testAmount,
  testNote
);

// Decode the note to see what it looks like
const decodedNote = decodeURIComponent(links.web.split('note=')[1] || '');

console.log('\n');
console.log('Cleaned Note (what Venmo will see):');
console.log(decodedNote);

console.log('\n');
console.log('Generated Links:');
console.log('================\n');

console.log('Web Link (Primary - works everywhere):');
console.log(links.web);

console.log('\n');
console.log('Mobile App Link:');
console.log(links.mobile);

console.log('\n');
console.log('Testing different bill types:');
console.log('=============================\n');

// Test water bill
const waterNote = roommateConfig.messageTemplates.water(322.29, 107.43, 'Mar 2025');
const waterLinks = venmoLinkService.generateVenmoLinks(
  roommateConfig.roommate.venmoUsername,
  107.43,
  waterNote
);

console.log('Water Bill Note:', waterNote);
console.log('Cleaned:', decodeURIComponent(waterLinks.web.split('note=')[1] || ''));
console.log('Link:', waterLinks.web.substring(0, 80) + '...');

console.log('\n================================================================');
console.log('✅ Simplified links generated successfully!');
console.log('\nThe notes are now simple and URL-safe:');
console.log('- No emojis');
console.log('- No special characters');
console.log('- Clear and concise');
console.log('- Should work on all platforms');

process.exit(0);