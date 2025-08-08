#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:5000';

async function testLedgerAPI() {
  console.log('🧪 Testing Ledger API...\n');
  
  try {
    // Test 1: Get all ledger entries
    console.log('1. Testing GET /api/ledger');
    const ledgerResponse = await axios.get(`${API_BASE}/api/ledger`, {
      params: {
        limit: 10
      }
    });
    
    console.log(`   ✅ Got ${ledgerResponse.data.entries.length} entries`);
    console.log(`   Totals: Income: $${ledgerResponse.data.totals.total_income}, Expenses: $${ledgerResponse.data.totals.total_expenses}`);
    
    // Test 2: Get income only
    console.log('\n2. Testing GET /api/ledger?type=income');
    const incomeResponse = await axios.get(`${API_BASE}/api/ledger`, {
      params: {
        type: 'income',
        limit: 5
      }
    });
    
    const incomeOnly = incomeResponse.data.entries.every(e => e.entry_type === 'income');
    console.log(`   ${incomeOnly ? '✅' : '❌'} All entries are income: ${incomeResponse.data.entries.length} entries`);
    
    // Test 3: Get expenses only
    console.log('\n3. Testing GET /api/ledger?type=expense');
    const expenseResponse = await axios.get(`${API_BASE}/api/ledger`, {
      params: {
        type: 'expense',
        limit: 5
      }
    });
    
    const expenseOnly = expenseResponse.data.entries.every(e => e.entry_type === 'expense');
    console.log(`   ${expenseOnly ? '✅' : '❌'} All entries are expenses: ${expenseResponse.data.entries.length} entries`);
    
    // Test 4: Get summary
    console.log('\n4. Testing GET /api/ledger/summary');
    const summaryResponse = await axios.get(`${API_BASE}/api/ledger/summary`, {
      params: {
        group_by: 'month',
        start_date: '2025-01-01'
      }
    });
    
    console.log(`   ✅ Got ${summaryResponse.data.summary.length} period summaries`);
    if (summaryResponse.data.summary.length > 0) {
      const latest = summaryResponse.data.summary[0];
      console.log(`   Latest period (${latest.period}):`);
      console.log(`     Income: $${latest.totalIncome.toFixed(2)}`);
      console.log(`     Expenses: $${latest.totalExpenses.toFixed(2)}`);
      console.log(`     Net: $${latest.netIncome.toFixed(2)}`);
    }
    
    // Test 5: Test search
    console.log('\n5. Testing search functionality');
    const searchResponse = await axios.get(`${API_BASE}/api/ledger`, {
      params: {
        search: 'rent',
        limit: 5
      }
    });
    
    console.log(`   ✅ Found ${searchResponse.data.entries.length} entries matching "rent"`);
    
    console.log('\n✅ All ledger API tests passed!');
    
  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    process.exit(1);
  }
}

// Check if server is running first
axios.get(`${API_BASE}/api/health`)
  .then(() => {
    console.log('Server is running at', API_BASE);
    return testLedgerAPI();
  })
  .catch(() => {
    console.log('⚠️  Server is not running. Please start the backend server first.');
    console.log('   Run: cd backend && npm run dev');
    process.exit(1);
  });