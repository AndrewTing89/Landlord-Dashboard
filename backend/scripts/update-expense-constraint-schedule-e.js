#!/usr/bin/env node

/**
 * Update database constraint to allow IRS Schedule E expense categories
 */

require('dotenv').config();
const db = require('../src/db/connection');

async function updateConstraint() {
  try {
    console.log('📝 Updating expense_type constraint to match IRS Schedule E categories...\n');
    
    await db.query('BEGIN');
    
    // Drop the old constraint
    await db.query(`
      ALTER TABLE expenses 
      DROP CONSTRAINT IF EXISTS expenses_expense_type_check
    `);
    console.log('✅ Dropped old constraint');
    
    // Add new constraint with Schedule E categories
    await db.query(`
      ALTER TABLE expenses 
      ADD CONSTRAINT expenses_expense_type_check 
      CHECK (expense_type IN (
        'advertising',           -- Line 5
        'auto_travel',          -- Line 6  
        'cleaning_maintenance',  -- Line 7 (was landscape)
        'commissions',          -- Line 8
        'insurance',            -- Line 9
        'legal_professional',   -- Line 10
        'management_fees',      -- Line 11
        'mortgage_interest',    -- Line 12
        'other_interest',       -- Line 13
        'repairs',              -- Line 14 (was maintenance for services)
        'supplies',             -- Line 15 (was maintenance for retail)
        'property_tax',         -- Line 16
        'electricity',          -- Line 17 (utilities)
        'water',                -- Line 17 (utilities)
        'internet',             -- Line 17 (utilities)
        'utilities',            -- Line 17 (general)
        'depreciation',         -- Line 18
        'other',                -- Line 19
        'landscape',            -- Keep for backward compatibility temporarily
        'maintenance'           -- Keep for backward compatibility temporarily
      ))
    `);
    console.log('✅ Added new constraint with Schedule E categories');
    
    await db.query('COMMIT');
    console.log('\n✅ Constraint updated successfully!');
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Failed to update constraint:', error);
    throw error;
  }
}

// Run update
updateConstraint()
  .then(() => process.exit(0))
  .catch(error => {
    console.error(error);
    process.exit(1);
  });