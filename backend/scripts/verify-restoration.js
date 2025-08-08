#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function verifyRestoration() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🎯 RENT INCOME RESTORATION - VERIFICATION REPORT');
    console.log('='.repeat(60));
    
    // 1. Check payment request count
    const totalPaymentRequests = await pool.query(`
      SELECT COUNT(*) as total_count
      FROM payment_requests 
      WHERE bill_type = 'rent' AND year = 2025
    `);
    
    console.log(`\n📋 PAYMENT REQUESTS:`);
    console.log(`  Total rent payment requests for 2025: ${totalPaymentRequests.rows[0].total_count}`);
    
    // 2. Check income records
    const incomeStats = await pool.query(`
      SELECT 
        income_type,
        COUNT(*) as count,
        SUM(amount) as total_amount
      FROM income 
      WHERE date >= '2025-01-01'
      GROUP BY income_type
      ORDER BY total_amount DESC
    `);
    
    console.log(`\n💰 INCOME RECORDS:`);
    let totalIncome = 0;
    incomeStats.rows.forEach(row => {
      console.log(`  ${row.income_type}: ${row.count} records, $${parseFloat(row.total_amount).toFixed(2)}`);
      totalIncome += parseFloat(row.total_amount);
    });
    console.log(`  TOTAL INCOME: $${totalIncome.toFixed(2)}`);
    
    // 3. Check that all paid rent payments have income records
    const missingIncomeCount = await pool.query(`
      SELECT COUNT(*) as missing_count
      FROM payment_requests pr
      LEFT JOIN income i ON i.payment_request_id = pr.id
      WHERE pr.bill_type = 'rent' 
        AND pr.year = 2025 
        AND pr.status = 'paid'
        AND i.id IS NULL
    `);
    
    console.log(`\n🔗 INCOME LINKAGE:`);
    if (missingIncomeCount.rows[0].missing_count > 0) {
      console.log(`  ❌ ${missingIncomeCount.rows[0].missing_count} rent payment requests still missing income records`);
    } else {
      console.log(`  ✅ All paid rent payment requests have corresponding income records`);
    }
    
    // 4. Check UshiLo specifically
    const ushiLoStatus = await pool.query(`
      SELECT 
        pr.month,
        pr.amount as payment_amount,
        pr.status,
        i.amount as income_amount,
        i.id as income_id
      FROM payment_requests pr
      LEFT JOIN income i ON i.payment_request_id = pr.id
      WHERE pr.tenant_id = 1 
        AND pr.bill_type = 'rent' 
        AND pr.year = 2025
      ORDER BY pr.month
    `);
    
    console.log(`\n👤 USHILO (TENANT 1) STATUS:`);
    ushiLoStatus.rows.forEach(row => {
      const status = row.income_id ? '✅' : '❌';
      console.log(`  Month ${row.month}: Payment $${row.payment_amount}, Income $${row.income_amount || 'NULL'} ${status}`);
    });
    
    // 5. Check what should appear on dashboard
    console.log(`\n🖥️  DASHBOARD IMPACT:`);
    console.log(`  Total Revenue should show: $${totalIncome.toFixed(2)}`);
    console.log(`  Rent payment cards should be visible for all months Jan-Aug 2025`);
    console.log(`  Each rent card should show 4 tenants (3 at $1,685 + 1 at $2,200)`);
    
    // 6. Monthly breakdown
    const monthlyBreakdown = await pool.query(`
      SELECT 
        month,
        COUNT(*) as tenant_count,
        SUM(amount) as total_rent
      FROM payment_requests 
      WHERE bill_type = 'rent' AND year = 2025 AND status = 'paid'
      GROUP BY month
      ORDER BY month
    `);
    
    console.log(`\n📅 MONTHLY RENT BREAKDOWN:`);
    monthlyBreakdown.rows.forEach(row => {
      console.log(`  ${getMonthName(row.month)} 2025: ${row.tenant_count} tenants, $${row.total_rent}`);
    });
    
    await pool.end();
    console.log('\n✨ Verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Error during verification:', error);
    await pool.end();
    process.exit(1);
  }
}

function getMonthName(monthNumber) {
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  return months[monthNumber - 1];
}

// Run the verification
verifyRestoration();