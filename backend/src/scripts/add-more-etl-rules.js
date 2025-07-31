const db = require('../db/connection');

async function addMoreRules() {
  try {
    console.log('Adding additional ETL rules...\n');
    
    // First, update the Amazon rule from exclude to categorize as maintenance
    await db.query(
      `UPDATE etl_rules 
       SET action = 'categorize', 
           expense_type = 'maintenance',
           exclude_reason = NULL
       WHERE rule_name = 'Exclude Amazon'`
    );
    console.log('✅ Updated Amazon rule to categorize as maintenance');
    
    // Add new rules
    const newRules = [
      {
        rule_name: 'Comcast Internet',
        rule_type: 'categorize',
        priority: 100,
        description_pattern: 'comcast',
        payee_pattern: null,
        action: 'categorize',
        expense_type: 'internet'
      },
      {
        rule_name: 'Carlos Gardener',
        rule_type: 'categorize',
        priority: 95,
        description_pattern: 'carlos gardener',
        payee_pattern: null,
        action: 'categorize',
        expense_type: 'maintenance'
      },
      {
        rule_name: 'Target Maintenance',
        rule_type: 'categorize',
        priority: 80,
        description_pattern: 'target',
        payee_pattern: null,
        action: 'categorize',
        expense_type: 'maintenance'
      },
      {
        rule_name: 'Exclude Xfinity Mobile',
        rule_type: 'exclude',
        priority: 85,
        description_pattern: 'xfinity mobile',
        payee_pattern: null,
        action: 'exclude',
        expense_type: null
      }
    ];
    
    for (const rule of newRules) {
      await db.insert('etl_rules', rule);
      console.log(`✅ Added rule: ${rule.rule_name}`);
    }
    
    // Show all active rules
    console.log('\n📋 All active ETL rules:');
    const allRules = await db.query(
      `SELECT rule_name, action, expense_type, priority 
       FROM etl_rules 
       WHERE active = true 
       ORDER BY priority DESC`
    );
    
    allRules.rows.forEach(rule => {
      console.log(`  ${rule.priority}: ${rule.rule_name} -> ${rule.action} ${rule.expense_type || ''}`);
    });
    
    // Clear raw_transactions to resync with new rules
    await db.query('DELETE FROM raw_transactions');
    console.log('\n✅ Cleared raw_transactions for fresh sync with new rules');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addMoreRules();