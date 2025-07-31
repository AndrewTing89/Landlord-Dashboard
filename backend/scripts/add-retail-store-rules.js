#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function addRetailStoreRules() {
  try {
    console.log('=== Adding Retail Store ETL Rules ===\n');
    
    // Define retail store rules
    const retailRules = [
      {
        rule_name: 'Auto-categorize Home Depot',
        rule_type: 'classification',
        description_pattern: '(home depot|homedepot)',
        expense_type: 'maintenance',
        merchant_name: 'Home Depot',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Lowes',
        rule_type: 'classification',
        description_pattern: "(lowe's|lowes)",
        expense_type: 'maintenance',
        merchant_name: 'Lowes',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Target',
        rule_type: 'classification',
        description_pattern: 'target( store|\\s+#|$)',
        expense_type: 'maintenance',
        merchant_name: 'Target',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Walmart',
        rule_type: 'classification',
        description_pattern: '(walmart|wal-mart|wmt\\*|wm supercenter)',
        expense_type: 'maintenance',
        merchant_name: 'Walmart',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Costco',
        rule_type: 'classification',
        description_pattern: 'costco',
        expense_type: 'maintenance',
        merchant_name: 'Costco',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Ross',
        rule_type: 'classification',
        description_pattern: 'ross stores',
        expense_type: 'maintenance',
        merchant_name: 'Ross',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Amazon',
        rule_type: 'classification',
        description_pattern: '(amazon|amzn)',
        expense_type: 'maintenance',
        merchant_name: 'Amazon',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Harbor Freight',
        rule_type: 'classification',
        description_pattern: 'harbor freight',
        expense_type: 'maintenance',
        merchant_name: 'Harbor Freight',
        action: 'categorize',
        priority: 85,
        active: true
      },
      {
        rule_name: 'Auto-categorize Ace Hardware',
        rule_type: 'classification',
        description_pattern: 'ace hardware',
        expense_type: 'maintenance',
        merchant_name: 'Ace Hardware',
        action: 'categorize',
        priority: 85,
        active: true
      }
    ];
    
    // Insert or update each rule
    for (const rule of retailRules) {
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
    
    // Update existing transactions in raw_transactions
    console.log('\n=== Updating Existing Transactions ===');
    
    for (const rule of retailRules) {
      const updateResult = await db.query(
        `UPDATE raw_transactions 
         SET suggested_expense_type = $1,
             suggested_merchant = $2,
             confidence_score = 0.85
         WHERE description ~* $3
         AND suggested_expense_type = 'other'`,
        [rule.expense_type, rule.merchant_name, rule.description_pattern]
      );
      
      if (updateResult.rowCount > 0) {
        console.log(`✓ Updated ${updateResult.rowCount} ${rule.merchant_name} transactions`);
      }
    }
    
    // Show all active ETL rules
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

addRetailStoreRules();