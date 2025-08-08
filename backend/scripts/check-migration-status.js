#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function checkMigrationStatus() {
  console.log('🔍 Checking migration status...\n');
  
  try {
    // Check if income table exists
    const incomeCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'income'
      ) as exists
    `);
    console.log(`✅ Income table exists: ${incomeCheck.rows[0].exists}`);
    
    if (incomeCheck.rows[0].exists) {
      const incomeCount = await db.query('SELECT COUNT(*) FROM income');
      console.log(`   - Income records: ${incomeCount.rows[0].count}`);
    }
    
    // Check if transactions table exists
    const transactionsCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      ) as exists
    `);
    console.log(`✅ Transactions table exists: ${transactionsCheck.rows[0].exists}`);
    
    if (transactionsCheck.rows[0].exists) {
      const transCount = await db.query('SELECT COUNT(*) FROM transactions');
      console.log(`   - Transaction records: ${transCount.rows[0].count}`);
      
      // Check for utility_reimbursement and rent records
      const reimburseCount = await db.query(`
        SELECT COUNT(*) FROM transactions 
        WHERE expense_type = 'utility_reimbursement'
      `);
      console.log(`   - Utility reimbursement records: ${reimburseCount.rows[0].count}`);
      
      const rentCount = await db.query(`
        SELECT COUNT(*) FROM transactions 
        WHERE expense_type = 'rent'
      `);
      console.log(`   - Rent records in transactions: ${rentCount.rows[0].count}`);
    }
    
    // Check if expenses table exists
    const expensesCheck = await db.query(`
      SELECT EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'expenses'
      ) as exists
    `);
    console.log(`✅ Expenses table exists: ${expensesCheck.rows[0].exists}`);
    
    console.log('\n📊 Migration Status Summary:');
    if (incomeCheck.rows[0].exists && !expensesCheck.rows[0].exists) {
      console.log('   - Migration 017 (income table): ✅ Complete');
      console.log('   - Migration 018 (data migration): ✅ Complete');
      console.log('   - Migration 019 (rename to expenses): ❌ Pending');
    } else if (expensesCheck.rows[0].exists) {
      console.log('   - All migrations complete! ✅');
    } else {
      console.log('   - Migrations not yet started');
    }
    
  } catch (error) {
    console.error('Error checking migration status:', error.message);
  }
  
  process.exit(0);
}

checkMigrationStatus();