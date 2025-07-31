#!/usr/bin/env node

// Test CSV parsing for amounts with commas
const testLines = [
  '03/25/2025,"Santa Clara DTAC DES:SantaClara ID:XXXXX41875 INDN:Andrew Ting CO ID:XXXXX79161 WEB","-5,324.73","4,147.65"',
  '03/20/2024,"GREAT OAKS WATER DES:WATER BILL ID:092_006_2 INDN:TING, ANDREW CO ID:XXXXX50419 PPD","-235.00","3,196.41"',
  '01/01/2025,"Test simple transaction",-100.50,5000.00',
  '07/23/2024,"GREAT OAKS WATER DES:WATER BILL ID:092_006_2 INDN:TING, ANDREW CO ID:XXXXX50419 PPD","-657.87","4,479.76"'
];

console.log('Testing CSV parsing for amounts with commas:\n');

testLines.forEach(line => {
  console.log('Original line:', line);
  
  // Parse transaction line - handle quoted fields with commas
  const dateMatch = line.match(/^(\d{2}\/\d{2}\/\d{4}),/);
  if (dateMatch) {
    const date = dateMatch[1];
    
    // Extract the rest after the date
    const restOfLine = line.substring(date.length + 1);
    
    // Find the description (quoted field)
    let description = '';
    let amountStr = '';
    let balanceStr = '';
    
    if (restOfLine.startsWith('"')) {
      // Find the closing quote for description
      const endQuoteIndex = restOfLine.indexOf('",', 1);
      if (endQuoteIndex > -1) {
        description = restOfLine.substring(1, endQuoteIndex);
        const afterDescription = restOfLine.substring(endQuoteIndex + 2);
        
        // Now parse amount and balance which may also be quoted
        // Look for quoted amount first
        if (afterDescription.startsWith('"')) {
          const amountEndQuote = afterDescription.indexOf('"', 1);
          if (amountEndQuote > -1) {
            amountStr = afterDescription.substring(1, amountEndQuote);
            // Balance should be after the comma
            const afterAmount = afterDescription.substring(amountEndQuote + 1);
            const balanceMatch = afterAmount.match(/,"([^"]+)"/);
            if (balanceMatch) {
              balanceStr = balanceMatch[1];
            }
          }
        } else {
          // Amount not quoted, split by comma
          const parts = afterDescription.split(',');
          amountStr = parts[0];
          balanceStr = parts[1] || '';
        }
      }
    } else {
      // No quotes, simple split
      const parts = restOfLine.split(',');
      description = parts[0];
      amountStr = parts[1] || '0';
      balanceStr = parts[2] || '0';
    }
    
    // Clean and parse amount and balance (remove quotes and commas)
    const amount = amountStr.replace(/[",]/g, '');
    const runningBalance = balanceStr.replace(/[",]/g, '');
    
    console.log('Parsed:');
    console.log('  Date:', date);
    console.log('  Description:', description);
    console.log('  Amount string:', amountStr, '→', amount, '→ $' + parseFloat(amount));
    console.log('  Balance string:', balanceStr, '→', runningBalance, '→ $' + parseFloat(runningBalance));
    console.log('---\n');
  }
});