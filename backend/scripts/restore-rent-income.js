#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function restoreRentIncome() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Analyzing current rent payment requests and income records...\n');
    
    // Get all paid rent payment requests for 2025 that don't have linked income
    const paidRentPayments = await pool.query(`
      SELECT pr.*
      FROM payment_requests pr
      LEFT JOIN income i ON i.payment_request_id = pr.id
      WHERE pr.bill_type = 'rent' 
        AND pr.year = 2025 
        AND pr.status = 'paid'
        AND i.id IS NULL
      ORDER BY pr.tenant_id, pr.month
    `);
    
    console.log(`Found ${paidRentPayments.rows.length} paid rent payment requests without income records:`);
    paidRentPayments.rows.forEach(row => {
      console.log(`  Tenant ${row.tenant_id} (${row.roommate_name}) - ${row.month}/${row.year}: $${row.amount} (Payment Request ID: ${row.id})`);
    });
    
    if (paidRentPayments.rows.length === 0) {
      console.log('✅ No missing rent income records found. All rent payments already have income records.');
      await pool.end();
      return;
    }
    
    console.log('\n🔧 Creating missing rent income records...\n');
    
    // Create income records for each missing rent payment
    let created = 0;
    for (const payment of paidRentPayments.rows) {
      // Calculate the payment date (1st of the month)
      const paymentDate = new Date(payment.year, payment.month - 1, 1);
      
      const incomeData = {
        date: paymentDate.toISOString().split('T')[0],
        amount: payment.amount,
        description: `Rent Payment - ${payment.roommate_name} - ${getMonthName(payment.month)} ${payment.year}`,
        income_type: 'rent',
        category: 'rent',
        source_type: 'payment_request',
        payment_request_id: payment.id,
        payer_name: payment.roommate_name,
        notes: `Restored missing rent income record for payment request ID ${payment.id}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      const insertResult = await pool.query(`
        INSERT INTO income (
          date, amount, description, income_type, category, source_type,
          payment_request_id, payer_name, notes, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
        ) RETURNING id
      `, [
        incomeData.date,
        incomeData.amount,
        incomeData.description,
        incomeData.income_type,
        incomeData.category,
        incomeData.source_type,
        incomeData.payment_request_id,
        incomeData.payer_name,
        incomeData.notes,
        incomeData.created_at,
        incomeData.updated_at
      ]);
      
      console.log(`✅ Created income record ID ${insertResult.rows[0].id} for ${payment.roommate_name} - ${getMonthName(payment.month)} ${payment.year}: $${payment.amount}`);
      created++;
    }
    
    console.log(`\n🎉 Successfully created ${created} rent income records!\n`);
    
    // Verify the restoration
    console.log('🔍 Verifying restoration...\n');
    
    const totalIncomeResult = await pool.query(`
      SELECT 
        COUNT(*) as total_records,
        SUM(amount) as total_amount
      FROM income 
      WHERE date >= '2025-01-01'
    `);
    
    const rentIncomeResult = await pool.query(`
      SELECT 
        COUNT(*) as rent_records,
        SUM(amount) as rent_amount
      FROM income 
      WHERE income_type = 'rent' AND date >= '2025-01-01'
    `);
    
    const utilityIncomeResult = await pool.query(`
      SELECT 
        COUNT(*) as utility_records,
        SUM(amount) as utility_amount
      FROM income 
      WHERE income_type = 'utility_reimbursement' AND date >= '2025-01-01'
    `);
    
    console.log('📊 Income Summary for 2025:');
    console.log(`  Total Income Records: ${totalIncomeResult.rows[0].total_records}`);
    console.log(`  Total Income Amount: $${totalIncomeResult.rows[0].total_amount}`);
    console.log(`  Rent Income Records: ${rentIncomeResult.rows[0].rent_records}`);
    console.log(`  Rent Income Amount: $${rentIncomeResult.rows[0].rent_amount}`);
    console.log(`  Utility Reimbursement Records: ${utilityIncomeResult.rows[0].utility_records}`);
    console.log(`  Utility Reimbursement Amount: $${utilityIncomeResult.rows[0].utility_amount}`);
    
    // Check that all rent payment requests now have income records
    const stillMissing = await pool.query(`
      SELECT COUNT(*) as missing_count
      FROM payment_requests pr
      LEFT JOIN income i ON i.payment_request_id = pr.id
      WHERE pr.bill_type = 'rent' 
        AND pr.year = 2025 
        AND pr.status = 'paid'
        AND i.id IS NULL
    `);
    
    if (stillMissing.rows[0].missing_count > 0) {
      console.log(`❌ Warning: ${stillMissing.rows[0].missing_count} rent payment requests still missing income records`);
    } else {
      console.log('✅ All paid rent payment requests now have corresponding income records');
    }
    
    await pool.end();
    console.log('\n✨ Rent income restoration completed successfully!');
    
  } catch (error) {
    console.error('❌ Error restoring rent income:', error);
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

// Run the restoration
restoreRentIncome();