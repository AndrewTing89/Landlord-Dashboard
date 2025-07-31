#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function updateAutoApproveRules() {
  console.log('=== Updating ETL Rules for Auto-Approval ===\n');
  
  try {
    // Update property_tax rules to auto-approve (priority >= 100)
    console.log('Updating property tax rules...');
    const propertyTaxUpdate = await db.query(
      `UPDATE etl_rules 
       SET priority = 100 
       WHERE expense_type = 'property_tax' 
       AND priority < 100`
    );
    console.log(`✓ Updated ${propertyTaxUpdate.rowCount} property tax rules to auto-approve\n`);
    
    // Update maintenance rules to auto-approve (priority >= 100)
    console.log('Updating maintenance rules...');
    const maintenanceUpdate = await db.query(
      `UPDATE etl_rules 
       SET priority = 100 
       WHERE expense_type = 'maintenance' 
       AND priority < 100`
    );
    console.log(`✓ Updated ${maintenanceUpdate.rowCount} maintenance rules to auto-approve\n`);
    
    // Show updated rules
    const updatedRules = await db.query(
      `SELECT rule_name, expense_type, priority, description_pattern 
       FROM etl_rules 
       WHERE expense_type IN ('property_tax', 'maintenance') 
       ORDER BY expense_type, rule_name`
    );
    
    console.log('Updated Rules:');
    console.log('==============');
    updatedRules.rows.forEach(rule => {
      console.log(`${rule.rule_name}:`);
      console.log(`  Type: ${rule.expense_type}`);
      console.log(`  Priority: ${rule.priority} (${rule.priority >= 100 ? 'AUTO-APPROVE' : 'Manual Review'})`);
      console.log(`  Pattern: ${rule.description_pattern || 'N/A'}`);
      console.log('');
    });
    
    // Also update any pending transactions that match these rules
    console.log('Checking for pending transactions that can now be auto-approved...\n');
    
    // Get pending transactions that match our rules
    const pendingTransactions = await db.query(
      `SELECT rt.* FROM raw_transactions rt
       WHERE rt.processed = false 
       AND rt.excluded = false
       AND rt.suggested_expense_type IN ('property_tax', 'maintenance')`
    );
    
    console.log(`Found ${pendingTransactions.rows.length} pending transactions that might be auto-approved`);
    
    let autoApproved = 0;
    for (const tx of pendingTransactions.rows) {
      // Check if it matches any auto-approve rule
      const matchingRule = await db.getOne(
        `SELECT * FROM etl_rules 
         WHERE expense_type = $1 
         AND priority >= 100 
         AND active = true
         AND ($2 ~* description_pattern OR description_pattern IS NULL)
         LIMIT 1`,
        [tx.suggested_expense_type, tx.description]
      );
      
      if (matchingRule) {
        // Auto-approve this transaction
        await db.insert('transactions', {
          plaid_transaction_id: `simplefin_${tx.simplefin_id}`,
          plaid_account_id: tx.simplefin_account_id,
          amount: Math.abs(tx.amount),
          date: tx.posted_date,
          name: tx.description,
          merchant_name: tx.suggested_merchant || tx.payee || tx.description.split(' ')[0],
          expense_type: tx.suggested_expense_type,
          category: tx.category || 'Other',
          subcategory: null
        });
        
        // Mark as processed
        await db.query(
          'UPDATE raw_transactions SET processed = true WHERE id = $1',
          [tx.id]
        );
        
        console.log(`✓ Auto-approved: ${tx.description} -> ${tx.suggested_expense_type}`);
        autoApproved++;
      }
    }
    
    if (autoApproved > 0) {
      console.log(`\n✅ Auto-approved ${autoApproved} pending transactions!`);
    } else {
      console.log('\nNo pending transactions were auto-approved.');
    }
    
    console.log('\n✅ ETL rules updated successfully!');
    console.log('\nFrom now on:');
    console.log('- Property tax transactions will be auto-approved');
    console.log('- Maintenance transactions (Home Depot, Lowe\'s, etc.) will be auto-approved');
    
    process.exit(0);
  } catch (error) {
    console.error('Error updating rules:', error);
    process.exit(1);
  }
}

updateAutoApproveRules();