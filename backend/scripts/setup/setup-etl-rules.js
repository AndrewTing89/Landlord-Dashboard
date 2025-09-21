require('dotenv').config({ path: './Landlord-Dashboard/backend/.env' });
const db = require('./Landlord-Dashboard/backend/src/db/connection');

async function setupETLRules() {
  console.log('🔧 Setting up ETL rules for auto-approval...\n');
  
  try {
    // First check the schema
    const columns = await db.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'etl_rules' 
      ORDER BY ordinal_position
    `);
    
    console.log('ETL Rules table columns:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type}`);
    });
    
    // Clear existing rules
    await db.query('DELETE FROM etl_rules');
    
    // Define basic auto-approval rules
    const rules = [
      {
        rule_name: 'Auto-approve PG&E',
        description_pattern: '.*PG&E.*',
        payee_pattern: 'PG&E',
        expense_type: 'electricity',
        merchant_name: 'PG&E',
        action: 'approve',
        priority: 100,
        active: true
      },
      {
        rule_name: 'Auto-approve Great Oaks Water',
        description_pattern: '.*GREAT.*OAKS.*',
        payee_pattern: 'GREAT OAKS',
        expense_type: 'water',
        merchant_name: 'Great Oaks Water Company',
        action: 'approve',
        priority: 100,
        active: true
      },
      {
        rule_name: 'Auto-approve Comcast',
        description_pattern: '.*COMCAST.*',
        payee_pattern: 'COMCAST',
        expense_type: 'internet',
        merchant_name: 'Comcast',
        action: 'approve',
        priority: 100,
        active: true
      },
      {
        rule_name: 'Auto-approve Home Depot',
        description_pattern: '.*HOME DEPOT.*',
        payee_pattern: 'HOME DEPOT',
        expense_type: 'supplies',
        merchant_name: 'Home Depot',
        action: 'approve',
        priority: 100,
        active: true
      },
      {
        rule_name: 'Auto-approve Lowes',
        description_pattern: '.*LOWE.*',
        payee_pattern: 'LOWE',
        expense_type: 'supplies',
        merchant_name: 'Lowes',
        action: 'approve',
        priority: 100,
        active: true
      },
      {
        rule_name: 'Exclude Property Tax Payments',
        description_pattern: '.*(PROPERTY TAX|TAX COLLECTOR|COUNTY TAX).*',
        payee_pattern: 'TAX',
        expense_type: 'property_tax',
        merchant_name: 'Property Tax Authority',
        action: 'exclude',
        priority: 150,
        active: true
      }
    ];
    
    for (const rule of rules) {
      await db.query(`
        INSERT INTO etl_rules (
          rule_name, description_pattern, payee_pattern, 
          expense_type, merchant_name, action, priority, active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        rule.rule_name,
        rule.description_pattern,
        rule.payee_pattern,
        rule.expense_type,
        rule.merchant_name,
        rule.action,
        rule.priority,
        rule.active
      ]);
      
      console.log(`✅ Created rule: ${rule.rule_name}`);
    }
    
    console.log(`\n🎉 Successfully created ${rules.length} ETL rules!`);
    console.log('📋 Rules with priority >= 100 will auto-approve transactions');
    
  } catch (error) {
    console.error('❌ Error setting up ETL rules:', error.message);
  }
  
  process.exit(0);
}

setupETLRules();