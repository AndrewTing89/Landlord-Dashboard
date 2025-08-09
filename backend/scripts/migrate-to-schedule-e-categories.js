#!/usr/bin/env node

/**
 * Migrate expense categories to match IRS Schedule E form classifications
 * 
 * Changes:
 * - landscape -> cleaning_maintenance (Line 7)
 * - maintenance from retail stores -> supplies (Line 15) 
 * - maintenance from service providers -> repairs (Line 14)
 * - electricity/water/internet -> utilities (Line 17)
 */

require('dotenv').config();
const db = require('../src/db/connection');

async function migrateCategories() {
  try {
    await db.query('BEGIN');
    
    console.log('🔄 Starting expense category migration to match IRS Schedule E...\n');
    
    // 1. Rename landscape to cleaning_maintenance
    const landscapeResult = await db.query(`
      UPDATE expenses 
      SET expense_type = 'cleaning_maintenance',
          updated_at = NOW()
      WHERE expense_type = 'landscape'
      RETURNING id
    `);
    console.log(`✅ Migrated ${landscapeResult.rowCount} landscape expenses to cleaning_maintenance`);
    
    // 2. Move retail maintenance purchases to supplies
    const suppliesResult = await db.query(`
      UPDATE expenses 
      SET expense_type = 'supplies',
          updated_at = NOW()
      WHERE expense_type = 'maintenance'
        AND (
          LOWER(merchant_name) LIKE '%home depot%' OR
          LOWER(merchant_name) LIKE '%lowes%' OR
          LOWER(merchant_name) LIKE '%lowe%' OR
          LOWER(merchant_name) LIKE '%amazon%' OR
          LOWER(merchant_name) LIKE '%costco%' OR
          LOWER(name) LIKE '%home depot%' OR
          LOWER(name) LIKE '%lowes%' OR
          LOWER(name) LIKE '%amazon%' OR
          LOWER(name) LIKE '%costco%'
        )
      RETURNING id
    `);
    console.log(`✅ Migrated ${suppliesResult.rowCount} retail maintenance purchases to supplies`);
    
    // 3. Rename remaining maintenance to repairs
    const repairsResult = await db.query(`
      UPDATE expenses 
      SET expense_type = 'repairs',
          updated_at = NOW()
      WHERE expense_type = 'maintenance'
      RETURNING id
    `);
    console.log(`✅ Migrated ${repairsResult.rowCount} maintenance expenses to repairs`);
    
    // 4. Consolidate utilities (keep as separate for detailed tracking, but note they're all Line 17)
    console.log(`ℹ️  Utilities (electricity, water, internet) remain separate for tracking but map to Schedule E Line 17`);
    
    // 5. Update ETL rules to use new categories
    console.log('\n📝 Updating ETL rules...');
    
    // Update landscape rules to cleaning_maintenance
    await db.query(`
      UPDATE etl_rules 
      SET expense_type = 'cleaning_maintenance'
      WHERE expense_type = 'landscape'
    `);
    
    // Update maintenance rules based on merchant
    await db.query(`
      UPDATE etl_rules 
      SET expense_type = 'supplies'
      WHERE expense_type = 'maintenance'
        AND (
          LOWER(description_pattern) LIKE '%home depot%' OR
          LOWER(description_pattern) LIKE '%lowes%' OR
          LOWER(description_pattern) LIKE '%amazon%' OR
          LOWER(description_pattern) LIKE '%costco%' OR
          LOWER(payee_pattern) LIKE '%home depot%' OR
          LOWER(payee_pattern) LIKE '%lowes%' OR
          LOWER(payee_pattern) LIKE '%amazon%' OR
          LOWER(payee_pattern) LIKE '%costco%'
        )
    `);
    
    // Update remaining maintenance rules to repairs
    await db.query(`
      UPDATE etl_rules 
      SET expense_type = 'repairs'
      WHERE expense_type = 'maintenance'
    `);
    
    console.log('✅ ETL rules updated');
    
    // Show summary of new categories
    const summary = await db.query(`
      SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      WHERE expense_type IS NOT NULL
        AND expense_type != 'other'
      GROUP BY expense_type
      ORDER BY expense_type
    `);
    
    console.log('\n📊 New expense categories summary:');
    console.table(summary.rows.map(row => ({
      Category: row.expense_type,
      'Schedule E Line': getScheduleELine(row.expense_type),
      Count: row.count,
      Total: `$${parseFloat(row.total).toFixed(2)}`
    })));
    
    await db.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

function getScheduleELine(expenseType) {
  const mapping = {
    'advertising': 'Line 5',
    'auto_travel': 'Line 6',
    'cleaning_maintenance': 'Line 7',
    'commissions': 'Line 8',
    'insurance': 'Line 9',
    'legal_professional': 'Line 10',
    'management_fees': 'Line 11',
    'mortgage_interest': 'Line 12',
    'other_interest': 'Line 13',
    'repairs': 'Line 14',
    'supplies': 'Line 15',
    'property_tax': 'Line 16',
    'electricity': 'Line 17 (Utilities)',
    'water': 'Line 17 (Utilities)',
    'internet': 'Line 17 (Utilities)',
    'depreciation': 'Line 18',
    'other': 'Line 19'
  };
  return mapping[expenseType] || 'N/A';
}

// Run migration
migrateCategories()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });