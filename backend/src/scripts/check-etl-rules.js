const db = require('../db/connection');

async function checkRules() {
  try {
    // Check ETL rules
    const rules = await db.query(
      'SELECT * FROM etl_rules WHERE active = true ORDER BY priority DESC'
    );
    
    console.log('📋 Active ETL Rules:\n');
    rules.rows.forEach(rule => {
      console.log(`${rule.rule_name} (Priority: ${rule.priority})`);
      console.log(`  Pattern: ${rule.description_pattern || 'N/A'}`);
      console.log(`  Action: ${rule.action} -> ${rule.expense_type || rule.exclude_reason}`);
      console.log('');
    });
    
    // Test specific transactions
    console.log('\n🧪 Testing specific patterns:');
    
    const testCases = [
      { desc: 'GREAT OAKS WATER DES:WATER BILL', pattern: '(?i)(great oaks|water)' },
      { desc: 'PACIFIC GAS AND ELECTRIC', pattern: '(?i)(pg&e|pacific gas|pge)' },
      { desc: 'VENMO DES:CASHOUT', pattern: '(?i)venmo.*cashout' }
    ];
    
    for (const test of testCases) {
      const regex = new RegExp(test.pattern, 'i');
      console.log(`  "${test.desc}" matches "${test.pattern}": ${regex.test(test.desc)}`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkRules();