require('dotenv').config();
const fs = require('fs');

// Test CSV parsing for water bills
const fileContent = fs.readFileSync('../bofa history.csv', 'utf-8');
const lines = fileContent.split('\n');
let isTransactionSection = false;

console.log('=== Checking Water Bill Parsing ===\n');

for (const line of lines) {
  if (!line.trim()) continue;
  
  if (line.startsWith('Date,Description,Amount,Running Bal.')) {
    isTransactionSection = true;
    continue;
  }
  
  if (!isTransactionSection) continue;
  
  // Look for water bills
  if (line.toLowerCase().includes('great oaks')) {
    console.log('Raw line:', line);
    
    const parts = line.split(',');
    console.log('Parts:', parts);
    
    if (parts.length >= 4) {
      const date = parts[0];
      const description = parts[1].replace(/"/g, '');
      const amountRaw = parts[2];
      const amount = parts[2].replace(/"/g, '').replace(/,/g, '');
      
      console.log('Date:', date);
      console.log('Description:', description);
      console.log('Amount raw:', amountRaw);
      console.log('Amount cleaned:', amount);
      console.log('parseFloat result:', parseFloat(amount));
      console.log('Math.abs result:', Math.abs(parseFloat(amount)));
      console.log('---');
    }
  }
}