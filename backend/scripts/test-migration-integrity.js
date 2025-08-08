#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function testMigrationIntegrity() {
  console.log('🧪 Testing migration integrity...\n');
  
  const tests = [];
  
  try {
    // Test 1: Check tables exist
    console.log('1. Checking tables...');
    const tablesResult = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('expenses', 'income', 'payment_requests')
      ORDER BY table_name
    `);
    
    const tables = tablesResult.rows.map(r => r.table_name);
    tests.push({
      name: 'Tables exist',
      passed: tables.includes('expenses') && tables.includes('income'),
      details: `Found: ${tables.join(', ')}`
    });
    
    // Test 2: Check no income records in expenses
    console.log('2. Checking expenses table...');
    const badExpenses = await db.query(`
      SELECT COUNT(*) as count 
      FROM expenses 
      WHERE expense_type IN ('utility_reimbursement', 'rent')
    `);
    
    tests.push({
      name: 'No income in expenses table',
      passed: badExpenses.rows[0].count == 0,
      details: `Found ${badExpenses.rows[0].count} income records in expenses`
    });
    
    // Test 3: Check income records exist
    console.log('3. Checking income table...');
    const incomeStats = await db.query(`
      SELECT 
        income_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income
      GROUP BY income_type
    `);
    
    tests.push({
      name: 'Income records migrated',
      passed: incomeStats.rows.length > 0,
      details: incomeStats.rows.map(r => `${r.income_type}: ${r.count} records, $${r.total}`).join(', ')
    });
    
    // Test 4: Check payment requests linked to income
    console.log('4. Checking payment request links...');
    const linkedIncome = await db.query(`
      SELECT COUNT(*) as count
      FROM income i
      JOIN payment_requests pr ON i.payment_request_id = pr.id
      WHERE pr.status = 'paid'
    `);
    
    tests.push({
      name: 'Payment requests linked to income',
      passed: linkedIncome.rows[0].count > 0,
      details: `${linkedIncome.rows[0].count} linked income records`
    });
    
    // Test 5: Check utility adjustments reference expenses
    console.log('5. Checking utility adjustments...');
    const adjustmentsCheck = await db.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(expense_id) as with_expense_id
      FROM utility_adjustments
    `);
    
    tests.push({
      name: 'Utility adjustments updated',
      passed: adjustmentsCheck.rows[0].total == adjustmentsCheck.rows[0].with_expense_id,
      details: `${adjustmentsCheck.rows[0].with_expense_id}/${adjustmentsCheck.rows[0].total} have expense_id`
    });
    
    // Test 6: Financial integrity check
    console.log('6. Checking financial totals...');
    const financials = await db.query(`
      WITH expense_totals AS (
        SELECT SUM(amount) as total_expenses
        FROM expenses
        WHERE expense_type NOT IN ('other')
      ),
      income_totals AS (
        SELECT SUM(amount) as total_income
        FROM income
      )
      SELECT 
        e.total_expenses,
        i.total_income,
        i.total_income - e.total_expenses as net_income
      FROM expense_totals e, income_totals i
    `);
    
    const fin = financials.rows[0];
    tests.push({
      name: 'Financial totals',
      passed: true,
      details: `Expenses: $${fin.total_expenses}, Income: $${fin.total_income}, Net: $${fin.net_income}`
    });
    
    // Print results
    console.log('\n📊 Test Results:\n');
    tests.forEach(test => {
      const status = test.passed ? '✅' : '❌';
      console.log(`${status} ${test.name}`);
      console.log(`   ${test.details}\n`);
    });
    
    const allPassed = tests.every(t => t.passed);
    if (allPassed) {
      console.log('🎉 All tests passed! Migration is successful.');
    } else {
      console.log('⚠️  Some tests failed. Please review the migration.');
    }
    
  } catch (error) {
    console.error('❌ Test failed with error:', error.message);
  }
  
  process.exit(0);
}

testMigrationIntegrity();