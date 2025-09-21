const db = require('../src/db/connection');

async function setupAutoApproval() {
  try {
    console.log('=== Setting up auto-approval ETL rules ===\n');
    
    // Check if etl_rules table has the right columns
    const columns = await db.query(
      "SELECT column_name FROM information_schema.columns WHERE table_name = 'etl_rules'"
    );
    console.log('ETL Rules columns:', columns.rows.map(r => r.column_name).join(', '));
    
    // Define auto-approval rules for utilities
    const autoApprovalRules = [
      {
        rule_name: 'Auto-approve Comcast Internet',
        rule_type: 'classification',
        description_pattern: '(?i)(comcast|xfinity)(?!.*mobile)',
        expense_type: 'internet',
        merchant_name: 'Comcast',
        action: 'categorize',
        priority: 100,
        active: true,
        auto_approve: true
      },
      {
        rule_name: 'Auto-approve PG&E Electricity',
        rule_type: 'classification',
        description_pattern: '(?i)(pg&e|pge|pacific gas)',
        expense_type: 'electricity',
        merchant_name: 'PG&E',
        action: 'categorize',
        priority: 100,
        active: true,
        auto_approve: true
      },
      {
        rule_name: 'Auto-approve Great Oaks Water',
        rule_type: 'classification',
        description_pattern: '(?i)(great oaks|water)',
        expense_type: 'water',
        merchant_name: 'Great Oaks Water',
        action: 'categorize',
        priority: 100,
        active: true,
        auto_approve: true
      },
      {
        rule_name: 'Auto-approve Carlos Gardener',
        rule_type: 'classification',
        description_pattern: '(?i)zelle.*carlos.*garden',
        expense_type: 'landscape',
        merchant_name: 'Carlos Gardener',
        action: 'categorize',
        priority: 100,
        active: true,
        auto_approve: true
      }
    ];
    
    // Insert rules
    for (const rule of autoApprovalRules) {
      try {
        // Check if rule already exists
        const existing = await db.query(
          'SELECT id FROM etl_rules WHERE rule_name = $1',
          [rule.rule_name]
        );
        
        if (existing.rows.length > 0) {
          // Update existing rule
          await db.query(
            `UPDATE etl_rules 
             SET rule_type = $2,
                 description_pattern = $3, 
                 expense_type = $4,
                 merchant_name = $5,
                 action = $6,
                 priority = $7,
                 active = $8
             WHERE rule_name = $1`,
            [rule.rule_name, rule.rule_type, rule.description_pattern, rule.expense_type, 
             rule.merchant_name, rule.action, rule.priority, rule.active]
          );
          console.log(`✓ Updated rule: ${rule.rule_name}`);
        } else {
          // Insert new rule
          await db.query(
            `INSERT INTO etl_rules 
             (rule_name, rule_type, description_pattern, expense_type, merchant_name, 
              action, priority, active) 
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
            [rule.rule_name, rule.rule_type, rule.description_pattern, rule.expense_type,
             rule.merchant_name, rule.action, rule.priority, rule.active]
          );
          console.log(`✓ Created rule: ${rule.rule_name}`);
        }
      } catch (err) {
        console.error(`Error with rule ${rule.rule_name}:`, err.message);
      }
    }
    
    // Show all active rules
    console.log('\n=== All Active ETL Rules ===');
    const allRules = await db.query(
      'SELECT * FROM etl_rules WHERE active = true ORDER BY priority DESC, id'
    );
    
    allRules.rows.forEach(rule => {
      console.log(`\nRule: ${rule.rule_name}`);
      console.log(`  Pattern: ${rule.description_pattern}`);
      console.log(`  Type: ${rule.expense_type}`);
      console.log(`  Priority: ${rule.priority}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

setupAutoApproval();