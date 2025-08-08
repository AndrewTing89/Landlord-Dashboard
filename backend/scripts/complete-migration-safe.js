#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function safeMigration() {
  console.log('🔄 Safely completing migration to expenses table...\n');
  
  try {
    // Check current state
    const tablesCheck = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('transactions', 'expenses')
    `);
    
    const existingTables = tablesCheck.rows.map(r => r.table_name);
    console.log('Current tables:', existingTables.join(', '));
    
    if (existingTables.includes('expenses')) {
      console.log('✅ Expenses table already exists. Migration may be partially complete.');
      
      // Check if it has the right columns
      const columnsCheck = await db.query(`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'expenses'
        AND column_name IN ('expense_type', 'category')
      `);
      
      const columns = columnsCheck.rows.map(r => r.column_name);
      console.log('Expenses table has columns:', columns.join(', '));
      
      process.exit(0);
    }
    
    if (!existingTables.includes('transactions')) {
      console.log('⚠️  Transactions table not found. Migration may already be complete.');
      process.exit(0);
    }
    
    // Now do the migration
    await db.query('BEGIN');
    
    // Step 1: Delete income-related records
    console.log('\n1. Cleaning income records from transactions...');
    const deleteResult = await db.query(`
      DELETE FROM transactions
      WHERE expense_type IN ('utility_reimbursement', 'rent')
    `);
    console.log(`   ✅ Deleted ${deleteResult.rowCount} income records`);
    
    // Step 2: Check if category column exists
    const categoryCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
        AND column_name = 'category'
      ) as exists
    `);
    
    if (!categoryCheck.rows[0].exists) {
      // Step 3: Add category column and copy data
      console.log('2. Adding category column...');
      await db.query('ALTER TABLE transactions ADD COLUMN category VARCHAR(100)');
      await db.query('UPDATE transactions SET category = expense_type');
      console.log('   ✅ Category column added and populated');
    } else {
      console.log('2. Category column already exists');
    }
    
    // Step 4: Rename table
    console.log('3. Renaming transactions table to expenses...');
    await db.query('ALTER TABLE transactions RENAME TO expenses');
    console.log('   ✅ Table renamed');
    
    // Step 5: Drop expense_type column if both exist
    const bothColumnsCheck = await db.query(`
      SELECT 
        SUM(CASE WHEN column_name = 'expense_type' THEN 1 ELSE 0 END) as has_expense_type,
        SUM(CASE WHEN column_name = 'category' THEN 1 ELSE 0 END) as has_category
      FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'expenses'
      AND column_name IN ('expense_type', 'category')
    `);
    
    if (bothColumnsCheck.rows[0].has_expense_type > 0 && bothColumnsCheck.rows[0].has_category > 0) {
      console.log('4. Dropping old expense_type column...');
      await db.query('ALTER TABLE expenses DROP COLUMN expense_type');
      console.log('   ✅ Old column dropped');
    }
    
    // Step 6: Update constraint
    console.log('5. Updating constraints...');
    await db.query('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS transactions_expense_type_check');
    await db.query('ALTER TABLE expenses DROP CONSTRAINT IF EXISTS expenses_category_check');
    await db.query(`
      ALTER TABLE expenses ADD CONSTRAINT expenses_category_check 
      CHECK (category IN ('electricity', 'water', 'internet', 'maintenance', 'landscape', 'property_tax', 'insurance', 'other'))
    `);
    console.log('   ✅ Constraints updated');
    
    // Step 7: Rename indexes
    console.log('6. Updating indexes...');
    try {
      await db.query('DROP INDEX IF EXISTS idx_transactions_date');
      await db.query('DROP INDEX IF EXISTS idx_transactions_expense_type');
      await db.query('DROP INDEX IF EXISTS idx_transactions_plaid');
      await db.query('CREATE INDEX IF NOT EXISTS idx_expenses_date ON expenses(date)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_expenses_category ON expenses(category)');
      await db.query('CREATE INDEX IF NOT EXISTS idx_expenses_plaid ON expenses(plaid_transaction_id)');
      console.log('   ✅ Indexes updated');
    } catch (err) {
      console.log('   ⚠️  Some indexes may already exist');
    }
    
    await db.query('COMMIT');
    
    // Show summary
    console.log('\n✅ Migration completed successfully!\n');
    
    const expensesSummary = await db.query(`
      SELECT 
        category,
        COUNT(*) as count,
        SUM(amount) as total
      FROM expenses
      WHERE category != 'other'
      GROUP BY category
      ORDER BY total DESC
    `);
    
    console.log('📊 Expenses Table Summary:');
    let totalExpenses = 0;
    expensesSummary.rows.forEach(row => {
      console.log(`   - ${row.category}: ${row.count} records, total: $${parseFloat(row.total).toFixed(2)}`);
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
    console.error('Details:', error);
    throw error;
  }
  
  process.exit(0);
}

safeMigration();