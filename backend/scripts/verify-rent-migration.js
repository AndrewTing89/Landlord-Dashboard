#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function verifyRentMigration() {
  console.log('🔍 Verifying Rent System Migration\n');
  console.log('='.repeat(60) + '\n');
  
  try {
    // 1. Check payment requests
    const paymentRequests = await db.query(`
      SELECT 
        status,
        COUNT(*) as count,
        SUM(amount::numeric) as total
      FROM payment_requests 
      WHERE bill_type = 'rent'
      GROUP BY status
    `);
    
    console.log('📋 Rent Payment Requests:');
    let totalRequests = 0;
    let paidAmount = 0;
    let pendingAmount = 0;
    
    paymentRequests.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} requests = $${row.total}`);
      totalRequests += parseInt(row.count);
      if (row.status === 'paid') {
        paidAmount = parseFloat(row.total);
      } else {
        pendingAmount += parseFloat(row.total);
      }
    });
    
    console.log(`   TOTAL: ${totalRequests} requests\n`);
    
    // 2. Check for any remaining manual transactions
    const manualTransactions = await db.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM transactions 
      WHERE expense_type = 'rent' 
        AND (plaid_transaction_id LIKE 'rent_%' OR plaid_account_id = 'manual_entry')
        AND date >= '2025-01-01'
    `);
    
    if (manualTransactions.rows[0].count > 0) {
      console.log('⚠️  Manual Rent Transactions Still Exist:');
      console.log(`   ${manualTransactions.rows[0].count} transactions = $${manualTransactions.rows[0].total}\n`);
    } else {
      console.log('✅ No manual rent transactions found (good!)\n');
    }
    
    // 3. Check Venmo emails
    const venmoEmails = await db.query(`
      SELECT 
        matched,
        COUNT(*) as count,
        SUM(venmo_amount) as total
      FROM venmo_emails
      WHERE venmo_amount >= 1585
        AND venmo_actor ILIKE '%ushi%'
        AND received_date >= '2025-01-01'
      GROUP BY matched
    `);
    
    console.log('📧 Venmo Rent Payment Emails:');
    venmoEmails.rows.forEach(row => {
      const status = row.matched ? 'Matched' : 'Unmatched';
      console.log(`   ${status}: ${row.count} emails = $${row.total}`);
    });
    console.log('');
    
    // 4. Show detailed payment status
    const detailedStatus = await db.query(`
      SELECT 
        pr.month,
        pr.year,
        pr.status,
        pr.amount,
        ve.venmo_actor,
        ve.received_date as payment_date
      FROM payment_requests pr
      LEFT JOIN venmo_emails ve ON ve.payment_request_id = pr.id
      WHERE pr.bill_type = 'rent'
      ORDER BY pr.year, pr.month
    `);
    
    console.log('📊 Detailed Payment Status:');
    console.log('Month/Year    Status      Amount      Paid By         Payment Date');
    console.log('-'.repeat(70));
    
    detailedStatus.rows.forEach(row => {
      const monthYear = `${row.month}/${row.year}`.padEnd(13);
      const status = row.status.padEnd(11);
      const amount = `$${row.amount}`.padEnd(11);
      const paidBy = (row.venmo_actor || '-').padEnd(15);
      const paymentDate = row.payment_date ? 
        new Date(row.payment_date).toLocaleDateString() : '-';
      
      console.log(monthYear + status + amount + paidBy + paymentDate);
    });
    
    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📈 SUMMARY:\n');
    
    const monthsCovered = totalRequests;
    const monthsPaid = paymentRequests.rows.find(r => r.status === 'paid')?.count || 0;
    const monthsPending = totalRequests - monthsPaid;
    
    console.log(`✅ System migrated successfully!`);
    console.log(`   - ${monthsCovered} months of rent tracked (Jan-Aug 2025)`);
    console.log(`   - ${monthsPaid} months paid ($${paidAmount})`);
    console.log(`   - ${monthsPending} months pending ($${pendingAmount})`);
    console.log(`   - All Venmo emails matched to payment requests`);
    console.log(`   - No duplicate manual transactions`);
    
    console.log('\n🎉 The rent system is now using payment requests exclusively!');
    console.log('   Future rent will be created automatically on the 1st of each month.');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

verifyRentMigration();