const db = require('../src/db/connection');

async function checkETLRules() {
  try {
    console.log('🔧 ETL Rules:');
    const rules = await db.query('SELECT * FROM etl_rules ORDER BY priority ASC');
    
    console.log('Rules configuration:');
    rules.rows.forEach(rule => {
      console.log(`  Priority ${rule.priority}: ${rule.pattern} -> ${rule.expense_type} (min confidence: ${rule.min_confidence}, auto-approve: ${rule.priority >= 100 ? 'YES' : 'NO'})`);
    });
    
    console.log('\n🔍 Sample transaction analysis:');
    const samples = await db.query('SELECT * FROM raw_transactions WHERE processed = false LIMIT 3');
    
    for (const tx of samples.rows) {
      console.log(`\nTransaction: ${tx.description}`);
      console.log(`  Amount: $${tx.amount}`);
      console.log(`  Suggested: ${tx.suggested_expense_type}`);
      console.log(`  Confidence: ${tx.confidence_score}`);
      
      // Check which rule would match
      for (const rule of rules.rows) {
        const pattern = new RegExp(rule.pattern, 'i');
        const textToMatch = tx.description + ' ' + (tx.payee || '');
        
        if (pattern.test(textToMatch)) {
          console.log(`  ✅ Matches rule: ${rule.pattern} -> ${rule.expense_type} (priority: ${rule.priority})`);
          console.log(`     Would auto-approve: ${rule.priority >= 100 && tx.confidence_score >= rule.min_confidence ? 'YES' : 'NO'}`);
          break;
        }
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkETLRules();