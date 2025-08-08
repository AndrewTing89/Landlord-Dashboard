#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function completeMigration019() {
  console.log('🔄 Completing migration 019: Renaming transactions to expenses...\n');
  
  try {
    await db.query('BEGIN');
    
    // Step 1: Delete income-related records from transactions
    console.log('1. Deleting utility reimbursements from transactions...');
    const deleteReimburse = await db.query(`
      DELETE FROM transactions
      WHERE expense_type = 'utility_reimbursement'
    `);
    console.log(`   ✅ Deleted ${deleteReimburse.rowCount} utility reimbursement records`);
    
    console.log('2. Deleting rent income from transactions...');
    const deleteRent = await db.query(`
      DELETE FROM transactions  
      WHERE expense_type = 'rent'
    `);
    console.log(`   ✅ Deleted ${deleteRent.rowCount} rent income records`);
    
    // Step 2: Rename table
    console.log('3. Renaming transactions table to expenses...');
    await db.query('ALTER TABLE transactions RENAME TO expenses');
    console.log('   ✅ Table renamed');
    
    // Step 3: Rename column
    console.log('4. Renaming expense_type column to category...');
    await db.query('ALTER TABLE expenses RENAME COLUMN expense_type TO category');
    console.log('   ✅ Column renamed');
    
    // Step 4: Update check constraint
    console.log('5. Updating check constraint...');
    await db.query('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS transactions_expense_type_check');
    await db.query(`
      ALTER TABLE expenses ADD CONSTRAINT expenses_category_check 
      CHECK (category IN ('electricity', 'water', 'internet', 'maintenance', 'landscape', 'property_tax', 'insurance', 'other'))
    `);
    console.log('   ✅ Constraint updated');
    
    // Step 5: Rename indexes
    console.log('6. Renaming indexes...');
    await db.query('ALTER INDEX IF EXISTS idx_transactions_date RENAME TO idx_expenses_date');
    await db.query('ALTER INDEX IF EXISTS idx_transactions_expense_type RENAME TO idx_expenses_category');
    await db.query('ALTER INDEX IF EXISTS idx_transactions_plaid RENAME TO idx_expenses_plaid');
    console.log('   ✅ Indexes renamed');
    
    // Step 6: Update utility_adjustments foreign key column name
    console.log('7. Updating utility_adjustments table...');
    const checkUtilityAdjustments = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'utility_adjustments'
      ) as exists
    `);
    
    if (checkUtilityAdjustments.rows[0].exists) {
      const checkColumn = await db.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_schema = 'public' 
          AND table_name = 'utility_adjustments'
          AND column_name = 'transaction_id'
        ) as exists
      `);
      
      if (checkColumn.rows[0].exists) {
        await db.query('ALTER TABLE utility_adjustments RENAME COLUMN transaction_id TO expense_id');
        console.log('   ✅ utility_adjustments column renamed');
      } else {
        console.log('   ⚠️  transaction_id column not found or already renamed');
      }
    } else {
      console.log('   ⚠️  utility_adjustments table not found');
    }
    
    // Step 7: Update trigger name
    console.log('8. Updating trigger name...');
    try {
      await db.query(`
        ALTER TRIGGER IF EXISTS update_transactions_updated_at ON expenses 
        RENAME TO update_expenses_updated_at
      `);
      console.log('   ✅ Trigger renamed');
    } catch (err) {
      console.log('   ⚠️  Trigger not found or already renamed');
    }
    
    await db.query('COMMIT');
    
    // Show summary
    console.log('\n✅ Migration 019 completed successfully!\n');
    
    const expensesSummary = await db.query(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      GROUP BY category
      ORDER BY category
    `);
    
    console.log('📊 Expenses Table Summary:');
    expensesSummary.rows.forEach(row => {
      console.log(`   - ${row.category}: ${row.count} records, total: $${row.total}`);
    });
    
    const incomeSummary = await db.query(`
      SELECT 
        income_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income
      GROUP BY income_type
      ORDER BY income_type
    `);
    
    console.log('\n📊 Income Table Summary:');
    incomeSummary.rows.forEach(row => {
      console.log(`   - ${row.income_type}: ${row.count} records, total: $${row.total}`);
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
  
  process.exit(0);
}

completeMigration019();