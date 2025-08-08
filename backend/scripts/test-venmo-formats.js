console.log('Testing Different Venmo URL Formats\n');
console.log('================================================================\n');

const username = 'UshiLo';
const amount = '107.43';
const note = encodeURIComponent('Water Mar 2025 - Total $322.29 - Your share $107.43');

console.log('Test Parameters:');
console.log('- Username:', username);
console.log('- Amount: $' + amount);
console.log('- Note (decoded):', decodeURIComponent(note));
console.log('\n');

console.log('Different URL Formats to Try:\n');
console.log('================================================================\n');

// Format 1: /u/ format with parameters
const format1 = `https://venmo.com/u/${username}?txn=charge&amount=${amount}&note=${note}`;
console.log('Format 1 - /u/ with parameters:');
console.log(format1);
console.log('');

// Format 2: Direct username format
const format2 = `https://venmo.com/${username}?txn=charge&amount=${amount}&note=${note}`;
console.log('Format 2 - Direct username:');
console.log(format2);
console.log('');

// Format 3: Just username and amount (minimal)
const format3 = `https://venmo.com/u/${username}?txn=charge&amount=${amount}`;
console.log('Format 3 - /u/ with just amount (no note):');
console.log(format3);
console.log('');

// Format 4: Mobile deep link
const format4 = `venmo://paycharge?txn=charge&recipients=${username}&amount=${amount}&note=${note}`;
console.log('Format 4 - Mobile deep link:');
console.log(format4);
console.log('');

// Format 5: Simple profile link (no parameters)
const format5 = `https://venmo.com/${username}`;
console.log('Format 5 - Simple profile link (manual request):');
console.log(format5);
console.log('');

console.log('================================================================\n');
console.log('Try each format to see which works best:\n');
console.log('1. Format 1 & 2 should pre-fill the charge request on web');
console.log('2. Format 3 tests if the note is causing issues');
console.log('3. Format 4 is for mobile app deep linking');
console.log('4. Format 5 is fallback - just goes to profile');
console.log('\nIf formats 1-3 don\'t work, we might need to use Format 5');
console.log('and rely on manual entry of the amount.');

process.exit(0);