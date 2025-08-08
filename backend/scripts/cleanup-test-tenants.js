#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function cleanupTestTenants() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    console.log('🧹 Starting cleanup of test tenant data...\n');
    
    // Start transaction
    await pool.query('BEGIN');
    
    // 1. First, let's see what tenants we have
    const allTenants = await pool.query(`
      SELECT id, first_name, last_name, email 
      FROM tenants 
      ORDER BY id
    `);
    
    console.log('Current tenants:');
    allTenants.rows.forEach(t => {
      console.log(`  ID ${t.id}: ${t.first_name} ${t.last_name} (${t.email})`);
    });
    
    // 2. Delete income records for non-Ushi tenants
    const deletedIncome = await pool.query(`
      DELETE FROM income 
      WHERE payment_request_id IN (
        SELECT id FROM payment_requests 
        WHERE tenant_id > 1
      )
      RETURNING id
    `);
    console.log(`\n✅ Deleted ${deletedIncome.rows.length} income records for test tenants`);
    
    // 3. Delete payment_requests for non-Ushi tenants
    const deletedPaymentRequests = await pool.query(`
      DELETE FROM payment_requests 
      WHERE tenant_id > 1
      RETURNING id
    `);
    console.log(`✅ Deleted ${deletedPaymentRequests.rows.length} payment_requests for test tenants`);
    
    // 4. Delete maintenance requests for non-Ushi tenants
    const deletedMaintenance = await pool.query(`
      DELETE FROM maintenance_requests 
      WHERE tenant_id > 1
      RETURNING id
    `);
    console.log(`✅ Deleted ${deletedMaintenance.rows.length} maintenance requests for test tenants`);
    
    // 5. Delete the test tenants themselves (keep Ushi who is ID 1)
    const deletedTenants = await pool.query(`
      DELETE FROM tenants 
      WHERE id > 1
      RETURNING first_name, last_name
    `);
    console.log(`✅ Deleted ${deletedTenants.rows.length} test tenants:`);
    deletedTenants.rows.forEach(t => {
      console.log(`   - ${t.first_name} ${t.last_name}`);
    });
    
    // 6. Now let's check Ushi's existing payment requests
    const ushiPayments = await pool.query(`
      SELECT pr.*, i.id as income_id
      FROM payment_requests pr
      LEFT JOIN income i ON i.payment_request_id = pr.id
      WHERE pr.tenant_id = 1 
        AND pr.bill_type = 'rent' 
        AND pr.year = 2025
      ORDER BY pr.month
    `);
    
    console.log(`\n📊 Ushi's current rent payment requests:`);
    ushiPayments.rows.forEach(p => {
      const hasIncome = p.income_id ? '✅' : '❌';
      console.log(`  Month ${p.month}: ${p.status} - $${p.amount} ${hasIncome}`);
    });
    
    // 7. Delete ALL of Ushi's rent payment requests and associated income for 2025
    // We'll recreate them fresh
    const deletedUshiIncome = await pool.query(`
      DELETE FROM income 
      WHERE payment_request_id IN (
        SELECT id FROM payment_requests 
        WHERE tenant_id = 1 
          AND bill_type = 'rent' 
          AND year = 2025
      )
      RETURNING id
    `);
    console.log(`\n🧹 Deleted ${deletedUshiIncome.rows.length} income records for Ushi's rent`);
    
    const deletedUshiRent = await pool.query(`
      DELETE FROM payment_requests 
      WHERE tenant_id = 1 
        AND bill_type = 'rent' 
        AND year = 2025
      RETURNING id
    `);
    console.log(`🧹 Deleted ${deletedUshiRent.rows.length} rent payment requests for Ushi`);
    
    // 8. Create fresh rent payment requests for Ushi (Jan-Aug 2025)
    console.log('\n🔧 Creating new rent payment requests for Ushi (Jan-Aug 2025)...\n');
    
    const months = [
      { month: 1, name: 'January' },
      { month: 2, name: 'February' },
      { month: 3, name: 'March' },
      { month: 4, name: 'April' },
      { month: 5, name: 'May' },
      { month: 6, name: 'June' },
      { month: 7, name: 'July' },
      { month: 8, name: 'August' }
    ];
    
    for (const { month, name } of months) {
      const dueDate = new Date(2025, month - 1, 1);
      const trackingId = `2025${month.toString().padStart(2, '0')}rent`;
      
      // All months start as pending (user will manually mark Jan-Jun as paid)
      const status = 'pending';
      
      const result = await pool.query(`
        INSERT INTO payment_requests (
          roommate_name,
          venmo_username,
          amount,
          total_amount,
          status,
          tracking_id,
          month,
          year,
          bill_type,
          due_date,
          request_date,
          created_at,
          updated_at,
          tenant_id,
          property_id,
          company_name
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
        ) RETURNING id
      `, [
        'UshiLo',           // roommate_name
        '@ushilo',          // venmo_username
        1685.00,            // amount (Ushi's rent)
        1685.00,            // total_amount
        status,             // status (all start as pending)
        trackingId,         // tracking_id
        month,              // month
        2025,               // year
        'rent',             // bill_type
        dueDate,            // due_date
        dueDate,            // request_date (same as due date for rent)
        new Date(),         // created_at
        new Date(),         // updated_at
        1,                  // tenant_id (Ushi)
        1,                  // property_id
        `Rent - ${name} 2025` // company_name (using this for description)
      ]);
      
      console.log(`✅ Created ${name} rent request (ID: ${result.rows[0].id}) - Status: ${status}`);
    }
    
    // Commit transaction
    await pool.query('COMMIT');
    
    // 9. Final verification
    console.log('\n📊 FINAL STATE:');
    
    const finalTenants = await pool.query('SELECT COUNT(*) as count FROM tenants');
    console.log(`  Total tenants: ${finalTenants.rows[0].count} (should be 1 - Ushi)`);
    
    const finalPaymentRequests = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total 
      FROM payment_requests 
      WHERE bill_type = 'rent' AND year = 2025
    `);
    console.log(`  Rent payment requests for 2025: ${finalPaymentRequests.rows[0].count} requests`);
    console.log(`  Total rent amount: $${finalPaymentRequests.rows[0].total}`);
    
    const finalIncome = await pool.query(`
      SELECT COUNT(*) as count, SUM(amount) as total 
      FROM income 
      WHERE income_type = 'rent' AND date >= '2025-01-01'
    `);
    console.log(`  Rent income records: ${finalIncome.rows[0].count} (should be 0 initially)`);
    
    console.log('\n✨ Cleanup completed successfully!');
    console.log('\n📝 Next steps:');
    console.log('  1. Go to landlord dashboard');
    console.log('  2. Manually mark Jan-Jun rent as paid');
    console.log('  3. Jul-Aug should auto-match via email sync');
    
    await pool.end();
    
  } catch (error) {
    await pool.query('ROLLBACK');
    console.error('❌ Error during cleanup:', error);
    await pool.end();
    process.exit(1);
  }
}

// Run the cleanup
cleanupTestTenants();