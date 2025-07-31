const db = require('../db/connection');

async function checkPGE() {
  try {
    console.log('🔍 Searching for PG&E transactions...\n');
    
    // Search raw transactions for anything that might be PG&E
    const pgeTransactions = await db.query(
      `SELECT description, amount, posted_date, suggested_expense_type, processed, excluded
       FROM raw_transactions 
       WHERE LOWER(description) LIKE '%pg%' 
          OR LOWER(description) LIKE '%pacific%' 
          OR LOWER(description) LIKE '%electric%'
          OR LOWER(description) LIKE '%pge%'
          OR LOWER(payee) LIKE '%pg%'
       ORDER BY posted_date DESC`
    );
    
    console.log(`Found ${pgeTransactions.rows.length} potential PG&E transactions:`);
    pgeTransactions.rows.forEach(t => {
      console.log(`\n  Date: ${t.posted_date}`);
      console.log(`  Description: "${t.description}"`);
      console.log(`  Amount: $${Math.abs(t.amount)}`);
      console.log(`  Suggested: ${t.suggested_expense_type || 'none'}`);
      console.log(`  Processed: ${t.processed}, Excluded: ${t.excluded}`);
    });
    
    // Check the PG&E rule
    const pgeRule = await db.getOne(
      `SELECT * FROM etl_rules WHERE rule_name = 'PG&E Electricity'`
    );
    
    console.log('\n📋 PG&E Rule:');
    console.log(`  Pattern: "${pgeRule.description_pattern}"`);
    console.log(`  Priority: ${pgeRule.priority}`);
    console.log(`  Action: ${pgeRule.action} -> ${pgeRule.expense_type}`);
    
    // Test pattern matching
    console.log('\n🧪 Testing PG&E pattern:');
    const testStrings = [
      'PACIFIC GAS AND ELECTRIC',
      'PG&E ENERGY STATEMENT',
      'PGE AUTOPAY',
      'CHECKCARD 0610 PG&E'
    ];
    
    const regex = new RegExp(pgeRule.description_pattern, 'i');
    testStrings.forEach(str => {
      console.log(`  "${str}" matches: ${regex.test(str)}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPGE();