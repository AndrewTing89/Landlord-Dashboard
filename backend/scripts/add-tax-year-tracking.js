#!/usr/bin/env node

/**
 * Add tax_year field to expenses table to track what year property taxes apply to
 * This is for informational purposes - cash basis accounting still reports when paid
 */

require('dotenv').config();
const db = require('../src/db/connection');

async function addTaxYearTracking() {
  try {
    console.log('📊 Adding tax year tracking to expenses table...\n');
    
    await db.query('BEGIN');
    
    // Add tax_year column
    await db.query(`
      ALTER TABLE expenses 
      ADD COLUMN IF NOT EXISTS tax_year INTEGER
    `);
    console.log('✅ Added tax_year column');
    
    // Add notes column if it doesn't exist
    await db.query(`
      ALTER TABLE expenses 
      ADD COLUMN IF NOT EXISTS notes TEXT
    `);
    console.log('✅ Added notes column');
    
    // Update existing property tax records with the tax year they apply to
    await db.query(`
      UPDATE expenses 
      SET tax_year = 2023,
          notes = COALESCE(notes || E'\n', '') || 'Property tax for tax year 2023 (paid in 2024)'
      WHERE id IN (
        SELECT id FROM expenses 
        WHERE expense_type = 'property_tax' 
        AND date >= '2024-01-01' 
        AND date < '2025-01-01'
      )
    `);
    
    await db.query(`
      UPDATE expenses 
      SET tax_year = 2024,
          notes = COALESCE(notes || E'\n', '') || 'Property tax for tax year 2024 (paid in 2025)'
      WHERE id IN (
        SELECT id FROM expenses 
        WHERE expense_type = 'property_tax' 
        AND date >= '2025-01-01' 
        AND date < '2026-01-01'
      )
    `);
    
    console.log('✅ Updated existing property tax records with tax years');
    
    // Show summary
    const summary = await db.query(`
      SELECT 
        EXTRACT(YEAR FROM date) as payment_year,
        tax_year,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      WHERE expense_type = 'property_tax'
      GROUP BY EXTRACT(YEAR FROM date), tax_year
      ORDER BY payment_year, tax_year
    `);
    
    console.log('\n📊 Property Tax Summary:');
    console.log('For cash basis accounting (what you report to IRS):');
    summary.rows.forEach(row => {
      console.log(`  Payment Year ${row.payment_year}: $${parseFloat(row.total).toFixed(2)} (for tax year ${row.tax_year || 'unknown'})`);
    });
    
    console.log('\n💡 Note: For Schedule E reporting, use the payment year (when you paid it).');
    console.log('   The tax_year field is just for your reference.\n');
    
    await db.query('COMMIT');
    console.log('✅ Tax year tracking added successfully!');
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Failed to add tax year tracking:', error);
    throw error;
  }
}

// Run update
addTaxYearTracking()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });