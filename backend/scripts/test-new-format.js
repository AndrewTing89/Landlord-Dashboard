require('dotenv').config();
const venmoLinkService = require('../src/services/venmoLinkService');
const roommateConfig = require('../config/roommate.config');

console.log('Testing New Venmo Link Format\n');
console.log('================================================================\n');

// Test with the new message format
const tests = [
  {
    type: 'electricity',
    totalAmount: 288.15,
    splitAmount: 95.09,
    date: 'Aug 2025'
  },
  {
    type: 'water',
    totalAmount: 322.29,
    splitAmount: 107.43,
    date: 'Mar 2025'
  }
];

tests.forEach((test, index) => {
  console.log(`Test ${index + 1}: ${test.type === 'electricity' ? 'PG&E' : 'Water'} Bill`);
  console.log('─'.repeat(60));
  
  // Generate the note using the template
  const note = test.type === 'electricity' 
    ? roommateConfig.messageTemplates.electricity(test.totalAmount, test.splitAmount, test.date)
    : roommateConfig.messageTemplates.water(test.totalAmount, test.splitAmount, test.date);
  
  console.log(`Note: ${note}`);
  
  // Generate the link
  const link = venmoLinkService.generateVenmoLink(
    '@UshiLo',
    test.splitAmount,
    note
  );
  
  console.log(`\nFormatted Output (like your example):`);
  const company = test.type === 'electricity' ? 'PG&E' : 'Great Oaks Water';
  console.log(`${company} ${test.date}`);
  console.log(`Total: $${test.totalAmount.toFixed(2)}`);
  console.log(`Pay: $${test.splitAmount.toFixed(2)}`);
  console.log(link);
  
  // Show what the decoded note looks like
  const noteParam = link.split('note=')[1];
  if (noteParam) {
    console.log(`\nDecoded note: "${decodeURIComponent(noteParam)}"`);
  }
  
  console.log('\n');
});

console.log('================================================================');
console.log('✅ Links generated in the working format!');
console.log('\nFormat: https://venmo.com/USERNAME?txn=charge&amount=XX.XX&note=...');
console.log('- No /u/ in the path');
console.log('- Includes company name, total, 1/3 split, and paid date');
console.log('- Should work on both web and mobile');

process.exit(0);