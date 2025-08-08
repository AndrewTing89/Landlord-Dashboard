#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function fixMissingRentIncome() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🔍 Checking for paid rent payments without income records...\n');
    
    // Find all paid rent payment requests that don't have income records
    const missingIncome = await pool.query(`
      SELECT pr.*
      FROM payment_requests pr
      LEFT JOIN income i ON i.payment_request_id = pr.id
      WHERE pr.bill_type = 'rent'
        AND pr.status = 'paid'
        AND pr.year = 2025
        AND i.id IS NULL
      ORDER BY pr.month
    `);
    
    if (missingIncome.rows.length === 0) {
      console.log('✅ All paid rent payments have income records!');
      await pool.end();
      return;
    }
    
    console.log(`Found ${missingIncome.rows.length} paid rent payments without income records:`);
    missingIncome.rows.forEach(payment => {
      console.log(`  - ${payment.roommate_name} - Month ${payment.month}/${payment.year}: $${payment.amount}`);
    });
    
    console.log('\n🔧 Creating missing income records...\n');
    
    for (const payment of missingIncome.rows) {
      const incomeDate = new Date(payment.year, payment.month - 1, 1);
      const monthName = getMonthName(payment.month);
      
      const result = await pool.query(`
        INSERT INTO income (
          date,
          amount,
          description,
          income_type,
          category,
          source_type,
          payment_request_id,
          payer_name,
          notes,
          created_at,
          updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW())
        RETURNING id
      `, [
        incomeDate,
        parseFloat(payment.amount),
        `Rent Payment - ${payment.roommate_name} - ${monthName} ${payment.year}`,
        'rent',
        'rent',
        'payment_request',
        payment.id,
        payment.roommate_name,
        `Fixed missing income record for payment request #${payment.id} on ${new Date().toISOString().split('T')[0]}`
      ]);
      
      console.log(`✅ Created income record ID ${result.rows[0].id} for ${payment.roommate_name} - ${monthName} ${payment.year}`);
    }
    
    // Verify the fix
    console.log('\n📊 Verification:');
    
    const totalIncome = await pool.query(`
      SELECT 
        income_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income
      WHERE date >= '2025-01-01'
      GROUP BY income_type
      ORDER BY income_type
    `);
    
    let grandTotal = 0;
    totalIncome.rows.forEach(row => {
      console.log(`  ${row.income_type}: ${row.count} records = $${row.total}`);
      grandTotal += parseFloat(row.total);
    });
    console.log(`  TOTAL INCOME: $${grandTotal.toFixed(2)}`);
    
    // Check specifically for Jul/Aug
    const julAugStatus = await pool.query(`
      SELECT 
        pr.month,
        pr.roommate_name,
        pr.amount,
        pr.status,
        i.id as income_id
      FROM payment_requests pr
      LEFT JOIN income i ON i.payment_request_id = pr.id
      WHERE pr.bill_type = 'rent'
        AND pr.year = 2025
        AND pr.month IN (7, 8)
      ORDER BY pr.month
    `);
    
    console.log('\n📅 July/August Status:');
    julAugStatus.rows.forEach(row => {
      const hasIncome = row.income_id ? '✅' : '❌';
      const monthName = getMonthName(row.month);
      console.log(`  ${monthName}: ${row.roommate_name} - $${row.amount} - ${row.status} ${hasIncome}`);
    });
    
    await pool.end();
    console.log('\n✨ Fix completed successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error);
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

// Run the fix
fixMissingRentIncome();