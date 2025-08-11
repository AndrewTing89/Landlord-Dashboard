const db = require('../src/db/connection');

async function testETLMatching() {
  try {
    console.log('🧪 Testing ETL matching...');
    
    // Get ETL rules
    const rules = await db.query('SELECT * FROM etl_rules WHERE active = true ORDER BY priority ASC');
    
    // Get a few sample transactions
    const samples = await db.query('SELECT * FROM raw_transactions WHERE processed = false LIMIT 3');
    
    for (const tx of samples.rows) {
      console.log(`\n📋 Transaction: ${tx.description}`);
      console.log(`   Amount: $${tx.amount}, Payee: ${tx.payee}`);
      console.log(`   Suggested: ${tx.suggested_expense_type}, Confidence: ${tx.confidence_score}`);
      
      let matched = false;
      
      for (const rule of rules.rows) {
        if (!rule.description_pattern) continue;
        
        const pattern = new RegExp(rule.description_pattern, 'i');
        const textToMatch = tx.description + ' ' + (tx.payee || '');
        
        if (pattern.test(textToMatch)) {
          console.log(`   ✅ MATCHED rule: "${rule.rule_name}"`);
          console.log(`      Pattern: ${rule.description_pattern}`);
          console.log(`      Action: ${rule.action}, Type: ${rule.expense_type}`);
          console.log(`      Priority: ${rule.priority} (auto-approve: ${rule.priority >= 100 ? 'YES' : 'NO'})`);
          
          // Simulate processing this transaction
          if (rule.action === 'approve' && rule.priority >= 100) {
            console.log(`   🚀 Would auto-approve and create expense record`);
          } else if (rule.action === 'exclude') {
            console.log(`   🚫 Would exclude from processing`);  
          } else {
            console.log(`   👀 Would classify but require manual review`);
          }
          
          matched = true;
          break;
        }
      }
      
      if (!matched) {
        console.log(`   ❌ No matching ETL rule found - would require manual review`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

testETLMatching();