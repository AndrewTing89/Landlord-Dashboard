const db = require('../db/connection');

async function addVenmoRule() {
  try {
    console.log('🔄 Adding Venmo ETL rule...\n');
    
    // Check if Venmo rule already exists
    const existingRule = await db.getOne(
      `SELECT id FROM etl_rules 
       WHERE rule_name ILIKE '%venmo%' 
          OR description_pattern ILIKE '%venmo%'`
    );
    
    if (existingRule) {
      // Update existing rule
      await db.query(
        `UPDATE etl_rules 
         SET expense_type = 'other',
             action = 'categorize',
             priority = 90,
             updated_at = NOW()
         WHERE id = $1`,
        [existingRule.id]
      );
      console.log('✅ Updated existing Venmo ETL rule to categorize as "other"');
    } else {
      // Insert new rule
      await db.insert('etl_rules', {
        rule_name: 'Venmo Transfers',
        rule_type: 'categorize',
        priority: 90,
        description_pattern: 'venmo',
        payee_pattern: null,
        action: 'categorize',
        expense_type: 'other'
      });
      console.log('✅ Created new ETL rule for Venmo transactions');
    }
    
    // Verify the rule
    const rule = await db.getOne(
      `SELECT * FROM etl_rules 
       WHERE description_pattern ILIKE '%venmo%'`
    );
    
    console.log('\n📋 Venmo ETL Rule:');
    console.log(`   Name: ${rule.rule_name}`);
    console.log(`   Pattern: ${rule.description_pattern}`);
    console.log(`   Expense Type: ${rule.expense_type}`);
    console.log(`   Priority: ${rule.priority}`);
    
    console.log('\n✨ Venmo ETL rule configured successfully!');
    console.log('   All future Venmo transactions will be categorized as "other"');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addVenmoRule();