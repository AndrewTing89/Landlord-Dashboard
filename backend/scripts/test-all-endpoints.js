#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3002';

async function testEndpoints() {
  console.log('🧪 Testing all endpoints...\n');
  
  const tests = [];
  
  // Test 1: Ledger endpoint
  try {
    const ledger = await axios.get(`${API_BASE}/api/ledger?limit=5`);
    tests.push({
      endpoint: 'GET /api/ledger',
      status: '✅',
      details: `Got ${ledger.data.entries.length} entries, Income: $${ledger.data.totals.total_income}, Expenses: $${ledger.data.totals.total_expenses}`
    });
  } catch (err) {
    tests.push({
      endpoint: 'GET /api/ledger',
      status: '❌',
      details: err.message
    });
  }
  
  // Test 2: Summary endpoint
  try {
    const summary = await axios.get(`${API_BASE}/api/summary?year=2025`);
    tests.push({
      endpoint: 'GET /api/summary',
      status: '✅',
      details: `Total expenses: $${summary.data.ytdTotals.totalExpenses}, Rent income: $${summary.data.ytdTotals.rentIncome}`
    });
  } catch (err) {
    tests.push({
      endpoint: 'GET /api/summary',
      status: '❌',
      details: err.message
    });
  }
  
  // Test 3: Transactions endpoint (now expenses)
  try {
    const transactions = await axios.get(`${API_BASE}/api/transactions?limit=5`);
    tests.push({
      endpoint: 'GET /api/transactions',
      status: '✅',
      details: `Got ${transactions.data.length} transactions`
    });
  } catch (err) {
    tests.push({
      endpoint: 'GET /api/transactions',
      status: '❌',
      details: err.message
    });
  }
  
  // Test 4: Payment requests endpoint
  try {
    const payments = await axios.get(`${API_BASE}/api/payment-requests?status=pending`);
    tests.push({
      endpoint: 'GET /api/payment-requests',
      status: '✅',
      details: `Got ${payments.data.length} pending payment requests`
    });
  } catch (err) {
    tests.push({
      endpoint: 'GET /api/payment-requests',
      status: '❌',
      details: err.message
    });
  }
  
  // Test 5: Monthly comparison endpoint
  try {
    const comparison = await axios.get(`${API_BASE}/api/monthly-comparison?year=2025`);
    tests.push({
      endpoint: 'GET /api/monthly-comparison',
      status: '✅',
      details: `Got ${comparison.data.length} months of data`
    });
  } catch (err) {
    tests.push({
      endpoint: 'GET /api/monthly-comparison',
      status: '❌',
      details: err.message
    });
  }
  
  // Test 6: Ledger summary endpoint
  try {
    const ledgerSummary = await axios.get(`${API_BASE}/api/ledger/summary?group_by=month`);
    tests.push({
      endpoint: 'GET /api/ledger/summary',
      status: '✅',
      details: `Got ${ledgerSummary.data.summary.length} period summaries`
    });
  } catch (err) {
    tests.push({
      endpoint: 'GET /api/ledger/summary',
      status: '❌',
      details: err.message
    });
  }
  
  // Print results
  console.log('📊 Test Results:\n');
  console.log('%-30s %-6s %s', 'Endpoint', 'Status', 'Details');
  console.log('-'.repeat(80));
  
  tests.forEach(test => {
    console.log('%-30s %-6s %s', test.endpoint, test.status, test.details);
  });
  
  const allPassed = tests.every(t => t.status === '✅');
  console.log('\n' + (allPassed ? '🎉 All tests passed!' : '⚠️  Some tests failed'));
  
  process.exit(allPassed ? 0 : 1);
}

testEndpoints().catch(err => {
  console.error('Fatal error:', err.message);
  process.exit(1);
});