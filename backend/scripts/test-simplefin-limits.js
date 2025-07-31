#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');
const moment = require('moment');

async function testSimpleFINLimits() {
  const accessUrl = process.env.SIMPLEFIN_TOKEN;
  
  if (!accessUrl) {
    console.error('SIMPLEFIN_TOKEN not configured');
    process.exit(1);
  }
  
  console.log('=== Testing SimpleFIN Date Limits ===\n');
  
  const testCases = [
    { days: 30, label: '30 days' },
    { days: 90, label: '90 days' },
    { days: 180, label: '180 days (6 months)' },
    { days: 365, label: '365 days (1 year)' },
    { days: 730, label: '730 days (2 years)' }
  ];
  
  for (const test of testCases) {
    console.log(`\nTesting ${test.label}...`);
    
    const startDate = moment().subtract(test.days, 'days').unix();
    const endDate = moment().unix();
    
    const separator = accessUrl.includes('?') ? '&' : '?';
    const url = `${accessUrl}/accounts${separator}start-date=${startDate}&end-date=${endDate}`;
    
    console.log(`Requesting from ${moment.unix(startDate).format('YYYY-MM-DD')} to ${moment.unix(endDate).format('YYYY-MM-DD')}`);
    
    try {
      const response = await axios.get(url, {
        timeout: 60000,
        headers: {
          'User-Agent': 'LandlordDashboard/1.0'
        }
      });
      
      const accounts = response.data.accounts;
      let totalTransactions = 0;
      let oldestDate = null;
      let newestDate = null;
      
      for (const account of accounts) {
        if (account.transactions && account.transactions.length > 0) {
          totalTransactions += account.transactions.length;
          
          const dates = account.transactions.map(t => new Date(t.posted * 1000));
          const accountOldest = new Date(Math.min(...dates));
          const accountNewest = new Date(Math.max(...dates));
          
          if (!oldestDate || accountOldest < oldestDate) oldestDate = accountOldest;
          if (!newestDate || accountNewest > newestDate) newestDate = accountNewest;
        }
      }
      
      if (oldestDate && newestDate) {
        const actualDays = Math.round((newestDate - oldestDate) / (1000 * 60 * 60 * 24));
        console.log(`✅ Success! Got ${totalTransactions} transactions`);
        console.log(`   Actual range: ${oldestDate.toISOString().split('T')[0]} to ${newestDate.toISOString().split('T')[0]}`);
        console.log(`   That's ${actualDays} days of data (requested ${test.days})`);
        
        if (actualDays < test.days - 1) {
          console.log(`   ⚠️  Bank only provided ${actualDays} days instead of requested ${test.days}`);
        }
      } else {
        console.log(`❌ No transactions returned`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    // Small delay between requests
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n=== Test Complete ===');
  console.log('\nNote: Banks may limit the amount of historical data they provide.');
  console.log('Bank of America typically provides ~90 days of transaction history.');
}

testSimpleFINLimits();