#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function migrateIncomeData() {
  console.log('🔄 Migrating income data to new income table...\n');
  
  try {
    await db.query('BEGIN');
    
    // First, migrate utility reimbursements (all of them, not just 2025)
    const utilityResult = await db.query(`
      INSERT INTO income (
        date,
        amount,
        description,
        income_type,
        category,
        source_type,
        payer_name,
        notes,
        created_at
      )
      SELECT 
        date,
        ABS(amount), -- Convert to positive
        name,
        'utility_reimbursement',
        CASE 
          WHEN name ILIKE '%electricity%' OR name ILIKE '%pg&e%' OR name ILIKE '%pge%' THEN 'electricity'
          WHEN name ILIKE '%water%' THEN 'water'
          ELSE 'utility'
        END as category,
        'payment_request', -- These came from payment requests
        CASE 
          WHEN merchant_name IS NOT NULL THEN merchant_name
          ELSE 'Ushi Lo'
        END as payer_name,
        CONCAT('Migrated from transactions table. Original ID: ', id),
        created_at
      FROM transactions
      WHERE expense_type = 'utility_reimbursement'
      RETURNING id
    `);
    
    console.log(`✅ Migrated ${utilityResult.rows.length} utility reimbursement records`);
    
    // Now create income records for paid rent payment requests
    const rentResult = await db.query(`
      INSERT INTO income (
        date,
        amount,
        description,
        income_type,
        source_type,
        payment_request_id,
        payer_name,
        notes
      )
      SELECT 
        COALESCE(pr.paid_date, pr.updated_at)::date as date,
        pr.amount::numeric as amount,
        CONCAT('Rent - ', TO_CHAR(TO_DATE(pr.month::text || '-' || pr.year::text, 'MM-YYYY'), 'Month YYYY')) as description,
        'rent',
        'payment_request',
        pr.id,
        pr.roommate_name,
        'Created from paid rent payment request'
      FROM payment_requests pr
      WHERE pr.bill_type = 'rent'
        AND pr.status = 'paid'
        AND pr.year = 2025
        AND NOT EXISTS (
          -- Don't create duplicate if we already migrated from transactions
          SELECT 1 FROM income i 
          WHERE i.payment_request_id = pr.id
        )
      RETURNING id
    `);
    
    console.log(`✅ Created ${rentResult.rows.length} rent income records from payment requests`);
    
    // Create income records for paid utility payment requests
    const utilityPaymentResult = await db.query(`
      INSERT INTO income (
        date,
        amount,
        description,
        income_type,
        category,
        source_type,
        payment_request_id,
        payer_name,
        notes
      )
      SELECT 
        COALESCE(pr.paid_date, pr.updated_at)::date as date,
        pr.amount::numeric as amount,
        CONCAT(
          CASE pr.bill_type
            WHEN 'electricity' THEN 'PG&E'
            WHEN 'water' THEN 'Water'
            ELSE pr.bill_type
          END,
          ' Payment - ',
          TO_CHAR(TO_DATE(pr.month::text || '-' || pr.year::text, 'MM-YYYY'), 'Mon YYYY')
        ) as description,
        'utility_reimbursement',
        pr.bill_type,
        'payment_request',
        pr.id,
        pr.roommate_name,
        'Created from paid utility payment request'
      FROM payment_requests pr
      WHERE pr.bill_type IN ('electricity', 'water')
        AND pr.status = 'paid'
        AND pr.year = 2025
        AND NOT EXISTS (
          -- Don't create duplicate
          SELECT 1 FROM income i 
          WHERE i.payment_request_id = pr.id
        )
      RETURNING id
    `);
    
    console.log(`✅ Created ${utilityPaymentResult.rows.length} utility income records from payment requests`);
    
    await db.query('COMMIT');
    
    // Show summary
    const summary = await db.query(`
      SELECT 
        income_type,
        COUNT(*) as count,
        SUM(amount) as total
      FROM income
      GROUP BY income_type
      ORDER BY income_type
    `);
    
    console.log('\n📊 Income Table Summary:');
    summary.rows.forEach(row => {
      console.log(`   - ${row.income_type}: ${row.count} records, total: $${row.total}`);
    });
    
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('❌ Migration failed:', error.message);
    throw error;
  }
  
  process.exit(0);
}

migrateIncomeData();