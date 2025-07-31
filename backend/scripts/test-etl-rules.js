const db = require('../src/db/connection');
const simplefinService = require('../src/services/simplefinService');

async function testETLRules() {
  try {
    console.log('=== Testing ETL Rules ===\n');
    
    // Test transactions
    const testTransactions = [
      {
        id: 'test1',
        description: 'COMCAST CALIFORNIA 06/09 PURCHASE 800-COMCAST CA',
        payee: 'COMCAST',
        amount: -144.78,
        category: 'Cable'
      },
      {
        id: 'test2',
        description: 'PGANDE WEB ONLINE',
        payee: 'PG&E',
        amount: -289.09,
        category: 'Utilities'
      },
      {
        id: 'test3',
        description: 'GREAT OAKS WATER',
        payee: 'Great Oaks Water Company',
        amount: -235.00,
        category: 'Utilities'
      },
      {
        id: 'test4',
        description: 'Zelle payment to Carlos Gardener',
        payee: 'Carlos Gardener',
        amount: -150.00,
        category: 'Transfer'
      }
    ];
    
    // Test each transaction
    for (const tx of testTransactions) {
      console.log(`\nTesting: ${tx.description}`);
      console.log(`Payee: ${tx.payee}, Amount: ${tx.amount}`);
      
      const result = await simplefinService.applyETLRules(tx);
      
      console.log('Result:');
      console.log(`  - Expense Type: ${result.expense_type}`);
      console.log(`  - Auto-approve: ${result.auto_approve}`);
      console.log(`  - Confidence: ${result.confidence}`);
      console.log(`  - Excluded: ${result.excluded}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

testETLRules();