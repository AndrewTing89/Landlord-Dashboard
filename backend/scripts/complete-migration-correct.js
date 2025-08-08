#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function correctMigration() {
  console.log('🔄 Correctly completing migration to expenses table...\n');
  
  try {
    await db.query('BEGIN');
    
    // Step 1: Clean up income records
    console.log('1. Cleaning income records from transactions...');
    const deleteResult = await db.query(`
      DELETE FROM transactions
      WHERE expense_type IN ('utility_reimbursement', 'rent')
    `);
    console.log(`   ✅ Deleted ${deleteResult.rowCount} income records`);
    
    // Step 2: Rename table
    console.log('2. Renaming transactions table to expenses...');
    await db.query('ALTER TABLE transactions RENAME TO expenses');
    console.log('   ✅ Table renamed');
    
    // Step 3: Don't rename the column - keep expense_type as is
    // The 'category' column is for something else (Plaid categories)
    
    // Step 4: Update constraint to only allow expense categories
    console.log('3. Updating constraints...');
    await db.query('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS transactions_expense_type_check');
    await db.query(`
      ALTER TABLE expenses ADD CONSTRAINT expenses_expense_type_check 
      CHECK (expense_type IN ('electricity', 'water', 'internet', 'maintenance', 'landscape', 'property_tax', 'insurance', 'other'))
    `);
    console.log('   ✅ Constraints updated');
    
    // Step 5: Update indexes
    console.log('4. Updating indexes...');
    try {
      await db.query('ALTER INDEX IF EXISTS idx_transactions_date RENAME TO idx_expenses_date');
      await db.query('ALTER INDEX IF EXISTS idx_transactions_expense_type RENAME TO idx_expenses_expense_type');
      await db.query('ALTER INDEX IF EXISTS idx_transactions_plaid RENAME TO idx_expenses_plaid');
      console.log('   ✅ Indexes renamed');
    } catch (err) {
      console.log('   ⚠️  Some indexes may already be renamed');
    }
    
    // Step 6: Update utility_adjustments if it exists
    console.log('5. Checking utility_adjustments table...');
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
    
    await db.query('COMMIT');
    
    // Show summary
    console.log('\n✅ Migration completed successfully!\n');
    
    const expensesSummary = await db.query(`
      SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      WHERE expense_type != 'other'
      GROUP BY expense_type
      ORDER BY total DESC
    `);
    
    console.log('📊 Expenses Table Summary:');
    let totalExpenses = 0;
    expensesSummary.rows.forEach(row => {
      console.log(`   - ${row.expense_type}: ${row.count} records, total: $${parseFloat(row.total).toFixed(2)}`);
      totalExpenses += parseFloat(row.total);
    });
    console.log(`   Total: $${totalExpenses.toFixed(2)}`);
    
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
    let totalIncome = 0;
    incomeSummary.rows.forEach(row => {
      console.log(`   - ${row.income_type}: ${row.count} records, total: $${parseFloat(row.total).toFixed(2)}`);
      totalIncome += parseFloat(row.total);
    });
    console.log(`   Total: $${totalIncome.toFixed(2)}`);
    
    console.log('\n💰 Net Income: $' + (totalIncome - totalExpenses).toFixed(2));
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
  
  process.exit(0);
}

correctMigration();