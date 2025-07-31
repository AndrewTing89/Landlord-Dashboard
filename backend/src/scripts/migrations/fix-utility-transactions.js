#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function fixUtilityTransactions() {
  try {
    console.log('Fixing utility transaction categorization...\n');
    
    // Fix PG&E transactions
    const pgResult = await db.query(
      `UPDATE transactions 
       SET expense_type = 'electricity', 
           category = 'Utilities',
           merchant_name = 'Pacific Gas and Electric Company'
       WHERE (LOWER(name) LIKE '%pgande%' OR LOWER(name) LIKE '%pg&e%')
       AND expense_type IS NULL
       RETURNING id, date, name, amount`
    );
    
    console.log(`✅ Fixed ${pgResult.rowCount} PG&E transactions`);
    pgResult.rows.forEach(tx => {
      console.log(`  - ${new Date(tx.date).toLocaleDateString()}: $${tx.amount}`);
    });
    
    // Fix water transactions
    const waterResult = await db.query(
      `UPDATE transactions 
       SET expense_type = 'water', 
           category = 'Utilities',
           merchant_name = 'Great Oaks Water'
       WHERE (LOWER(name) LIKE '%great oaks%' OR LOWER(name) LIKE '%water%')
       AND expense_type IS NULL
       RETURNING id, date, name, amount`
    );
    
    console.log(`\n✅ Fixed ${waterResult.rowCount} water transactions`);
    waterResult.rows.forEach(tx => {
      console.log(`  - ${new Date(tx.date).toLocaleDateString()}: $${tx.amount}`);
    });
    
    // Add/update ETL rules for future processing
    console.log('\nUpdating ETL rules for future imports...');
    
    // PG&E rule
    await db.query(
      `INSERT INTO etl_rules (pattern, expense_type, category, merchant_name, priority, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (pattern) 
       DO UPDATE SET expense_type = $2, category = $3, merchant_name = $4, active = $6`,
      ['PGANDE.*WEB ONLINE', 'electricity', 'Utilities', 'Pacific Gas and Electric Company', 1, true]
    );
    
    // Water rule
    await db.query(
      `INSERT INTO etl_rules (pattern, expense_type, category, merchant_name, priority, active)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (pattern) 
       DO UPDATE SET expense_type = $2, category = $3, merchant_name = $4, active = $6`,
      ['GREAT OAKS WATER.*WATER BILL', 'water', 'Utilities', 'Great Oaks Water', 2, true]
    );
    
    console.log('✅ ETL rules updated');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

fixUtilityTransactions();