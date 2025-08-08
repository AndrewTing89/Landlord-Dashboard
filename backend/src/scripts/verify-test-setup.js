#!/usr/bin/env node

/**
 * Verify Test Setup Script
 * Verifies that all test tenants and payment histories were created properly
 */

const db = require('../db/connection');

async function main() {
  try {
    console.log('🔍 VERIFYING TEST TENANT SETUP');
    console.log('===============================\n');

    // Check tenants
    const tenants = await db.query(`
      SELECT 
        t.id, t.email, t.first_name, t.last_name, 
        t.property_id, p.name as property_name, 
        t.monthly_rent, t.is_active
      FROM tenants t
      LEFT JOIN properties p ON t.property_id = p.id
      ORDER BY t.id
    `);

    console.log('📋 TENANTS:');
    tenants.rows.forEach(tenant => {
      console.log(`  ${tenant.id}. ${tenant.first_name} ${tenant.last_name}`);
      console.log(`     Email: ${tenant.email}`);
      console.log(`     Property: ${tenant.property_name} (ID: ${tenant.property_id})`);
      console.log(`     Rent: $${tenant.monthly_rent}`);
      console.log(`     Status: ${tenant.is_active ? 'Active' : 'Inactive'}`);
      console.log('');
    });

    // Check payment requests summary
    const paymentSummary = await db.query(`
      SELECT 
        t.first_name, t.last_name, t.id as tenant_id,
        COUNT(*) as total_requests,
        COUNT(CASE WHEN pr.status = 'paid' THEN 1 END) as paid_requests,
        COUNT(CASE WHEN pr.status = 'pending' THEN 1 END) as pending_requests,
        COUNT(CASE WHEN pr.status = 'sent' THEN 1 END) as sent_requests,
        COUNT(CASE WHEN pr.status = 'foregone' THEN 1 END) as foregone_requests,
        SUM(pr.amount) as total_amount,
        SUM(CASE WHEN pr.status = 'paid' THEN pr.amount ELSE 0 END) as paid_amount
      FROM tenants t
      LEFT JOIN payment_requests pr ON t.id = pr.tenant_id AND pr.year = 2025
      GROUP BY t.id, t.first_name, t.last_name
      ORDER BY t.id
    `);

    console.log('💰 PAYMENT REQUEST SUMMARY (2025):');
    paymentSummary.rows.forEach(summary => {
      console.log(`  ${summary.first_name} ${summary.last_name}:`);
      console.log(`    Total Requests: ${summary.total_requests}`);
      console.log(`    Paid: ${summary.paid_requests} ($${parseFloat(summary.paid_amount || 0).toFixed(2)})`);
      console.log(`    Pending: ${summary.pending_requests}`);
      console.log(`    Sent: ${summary.sent_requests}`);
      console.log(`    Foregone: ${summary.foregone_requests}`);
      console.log(`    Total Amount: $${parseFloat(summary.total_amount || 0).toFixed(2)}`);
      console.log('');
    });

    // Check payment patterns by bill type
    const billTypeBreakdown = await db.query(`
      SELECT 
        t.first_name, t.last_name, pr.bill_type,
        COUNT(*) as request_count,
        COUNT(CASE WHEN pr.status = 'paid' THEN 1 END) as paid_count,
        ROUND(COUNT(CASE WHEN pr.status = 'paid' THEN 1 END) * 100.0 / COUNT(*), 1) as paid_percentage
      FROM tenants t
      LEFT JOIN payment_requests pr ON t.id = pr.tenant_id AND pr.year = 2025
      WHERE pr.bill_type IS NOT NULL
      GROUP BY t.id, t.first_name, t.last_name, pr.bill_type
      ORDER BY t.id, pr.bill_type
    `);

    console.log('📊 PAYMENT PATTERNS BY BILL TYPE:');
    let currentTenant = '';
    billTypeBreakdown.rows.forEach(row => {
      const tenantName = `${row.first_name} ${row.last_name}`;
      if (tenantName !== currentTenant) {
        console.log(`  ${tenantName}:`);
        currentTenant = tenantName;
      }
      console.log(`    ${row.bill_type}: ${row.paid_count}/${row.request_count} paid (${row.paid_percentage}%)`);
    });

    console.log('\n🔐 LOGIN CREDENTIALS:');
    console.log('=====================');
    console.log('Ushi Lo: ushi@test.com / password123');
    console.log('Alex Chen: alex@test.com / password123');  
    console.log('Sarah Johnson: sarah@test.com / password123');
    
    console.log('\n✅ VERIFICATION COMPLETE');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main };