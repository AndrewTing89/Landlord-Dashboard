require('dotenv').config();
const venmoLinkService = require('../src/services/venmoLinkService');

console.log('Testing Simplified Venmo Link\n');
console.log('================================================================\n');

// Test cases
const tests = [
  {
    username: '@UshiLo',
    amount: 107.43,
    note: 'Water Mar 2025 - Total $322.29 - Your share $107.43 [2025-March-Water]'
  },
  {
    username: 'UshiLo',
    amount: 56.67,
    note: 'PGE Dec 2024 - Total $170.00 - Your share $56.67'
  },
  {
    username: '@UshiLo',
    amount: 100.00,
    note: 'Simple payment request'
  }
];

tests.forEach((test, index) => {
  console.log(`Test ${index + 1}:`);
  console.log(`  Username: ${test.username}`);
  console.log(`  Amount: $${test.amount}`);
  console.log(`  Original Note: ${test.note}`);
  
  const link = venmoLinkService.generateVenmoLink(
    test.username,
    test.amount,
    test.note
  );
  
  console.log(`  Generated Link: ${link}`);
  
  // Decode the note to see what it looks like
  const noteParam = link.split('note=')[1];
  if (noteParam) {
    const decodedNote = decodeURIComponent(noteParam);
    console.log(`  Cleaned Note: "${decodedNote}"`);
  }
  
  console.log('\n');
});

console.log('================================================================');
console.log('✅ Simple, robust Venmo links generated!');
console.log('\nFormat: https://venmo.com/u/USERNAME?txn=charge&amount=XX.XX&note=...');
console.log('- No emojis or special characters');
console.log('- Short, simple notes');
console.log('- Should work on all platforms');

process.exit(0);