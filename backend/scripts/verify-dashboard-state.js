#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function verifyDashboardState() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('📊 LANDLORD DASHBOARD STATE VERIFICATION');
    console.log('='.repeat(60));
    
    // 1. Check tenants
    const tenants = await pool.query(`
      SELECT id, first_name, last_name, email 
      FROM tenants 
      ORDER BY id
    `);
    console.log('\n👥 TENANTS:');
    tenants.rows.forEach(t => {
      console.log(`  ${t.first_name} ${t.last_name} (${t.email})`);
    });
    
    // 2. Check rent payment requests
    const rentRequests = await pool.query(`
      SELECT month, status, amount, roommate_name, tracking_id
      FROM payment_requests 
      WHERE bill_type = 'rent' AND year = 2025
      ORDER BY month
    `);
    console.log('\n🏠 RENT PAYMENT REQUESTS (2025):');
    rentRequests.rows.forEach(r => {
      const icon = r.status === 'paid' ? '✅' : '⏳';
      console.log(`  ${getMonthName(r.month)}: ${r.roommate_name} - $${r.amount} - ${r.status} ${icon} (${r.tracking_id})`);
    });
    
    // 3. Check income records
    const income = await pool.query(`
      SELECT income_type, COUNT(*) as count, SUM(amount) as total
      FROM income 
      WHERE date >= '2025-01-01'
      GROUP BY income_type
    `);
    console.log('\n💰 INCOME SUMMARY (2025):');
    let totalIncome = 0;
    income.rows.forEach(i => {
      console.log(`  ${i.income_type}: ${i.count} records = $${i.total || 0}`);
      totalIncome += parseFloat(i.total || 0);
    });
    console.log(`  TOTAL INCOME: $${totalIncome.toFixed(2)}`);
    
    // 4. Check utility bills
    const utilityBills = await pool.query(`
      SELECT bill_type, COUNT(*) as count, SUM(total_amount) as total
      FROM payment_requests 
      WHERE bill_type IN ('electricity', 'water', 'internet') 
        AND year = 2025
      GROUP BY bill_type
    `);
    console.log('\n⚡ UTILITY BILLS (2025):');
    utilityBills.rows.forEach(u => {
      console.log(`  ${u.bill_type}: ${u.count} bills = $${u.total || 0}`);
    });
    
    // 5. What should appear on dashboard
    console.log('\n🖥️  WHAT YOU SHOULD SEE ON LANDLORD DASHBOARD:');
    console.log('  Active Requests Tab:');
    console.log('    - 8 rent payment cards (Jan-Aug) for UshiLo at $1,685 each');
    console.log('    - All showing as "pending" status initially');
    console.log('  ');
    console.log('  YTD Revenue Dashboard:');
    console.log(`    - Total Revenue: $${totalIncome.toFixed(2)} (will increase as you mark rent paid)`);
    console.log('    - Initially $0 since no payments marked as paid yet');
    console.log('  ');
    console.log('  After marking Jan-Jun as paid:');
    console.log('    - Total Revenue should show: $10,110.00 (6 months × $1,685)');
    console.log('    - Jul-Aug should remain pending until email sync matches them');
    
    await pool.end();
    console.log('\n✨ Verification complete!');
    
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

// Run verification
verifyDashboardState();