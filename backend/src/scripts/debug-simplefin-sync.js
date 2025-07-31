const axios = require('axios');
const moment = require('moment');

async function debugSync() {
  try {
    console.log('🔍 Debugging SimpleFIN sync...\n');
    
    const accessUrl = process.env.SIMPLEFIN_TOKEN;
    
    // Test different date ranges
    const tests = [
      { start: '2025-01-01', end: '2025-07-30', label: 'Full 2025' },
      { start: '2025-01-01', end: '2025-03-31', label: 'Q1 2025' },
      { start: '2025-04-01', end: '2025-06-30', label: 'Q2 2025' },
      { start: '2024-01-01', end: '2024-12-31', label: 'Full 2024' }
    ];
    
    for (const test of tests) {
      const startUnix = moment(test.start).unix();
      const endUnix = moment(test.end).unix();
      
      const url = `${accessUrl}/accounts?start-date=${startUnix}&end-date=${endUnix}`;
      
      try {
        const response = await axios.get(url);
        const accounts = response.data.accounts;
        let totalTransactions = 0;
        
        for (const account of accounts) {
          totalTransactions += (account.transactions || []).length;
        }
        
        console.log(`${test.label}: ${totalTransactions} transactions`);
        
        // Check for PG&E in this range
        let pgeCount = 0;
        for (const account of accounts) {
          for (const tx of (account.transactions || [])) {
            if (tx.description && tx.description.toLowerCase().includes('pgande')) {
              pgeCount++;
            }
          }
        }
        console.log(`  - PG&E transactions: ${pgeCount}`);
        
      } catch (error) {
        console.log(`${test.label}: Error - ${error.message}`);
      }
    }
    
    // Check if SimpleFIN has pagination or limits
    console.log('\n📖 SimpleFIN API notes:');
    console.log('- SimpleFIN may limit transactions based on what the bank provides');
    console.log('- Bank of America might only provide recent transactions via API');
    console.log('- For older transactions, you may need to manually import them');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Load environment variables
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
debugSync();