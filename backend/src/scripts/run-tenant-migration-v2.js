const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard'
});

async function runMigration() {
  console.log('🚀 Running tenant portal migration...\n');
  
  const client = await pool.connect();
  
  try {
    // Read the entire migration file
    const migrationPath = path.join(__dirname, '../../migrations/011_create_tenant_portal_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Execute the entire migration as a transaction
    await client.query('BEGIN');
    console.log('📝 Starting transaction...\n');
    
    // Execute the entire SQL file
    await client.query(migrationSQL);
    
    // Commit the transaction
    await client.query('COMMIT');
    console.log('\n✅ Migration completed successfully!');
    
    // Verify tables were created
    const tableCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('tenants', 'maintenance_requests', 'tenant_documents', 'tenant_notifications', 'tenant_sessions', 'tenant_activity_log')
      ORDER BY table_name;
    `);
    
    console.log('\n📊 Created tables:');
    tableCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    // Check views
    const viewCheck = await client.query(`
      SELECT table_name 
      FROM information_schema.views 
      WHERE table_schema = 'public' 
        AND table_name IN ('tenant_payment_dashboard', 'maintenance_summary')
      ORDER BY table_name;
    `);
    
    console.log('\n👁️  Created views:');
    viewCheck.rows.forEach(row => {
      console.log(`   ✓ ${row.table_name}`);
    });
    
    console.log('\n🎉 Tenant portal database setup complete!');
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Migration failed:', error.message);
    console.error('\nError details:', error.detail || 'No additional details');
    
    // Check if it's because tables already exist
    if (error.code === '42P07') {
      console.log('\n⚠️  Some tables may already exist. Checking current state...');
      
      const existingTables = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
          AND table_name LIKE 'tenant%' OR table_name LIKE 'maintenance%'
        ORDER BY table_name;
      `);
      
      if (existingTables.rows.length > 0) {
        console.log('\nExisting tenant-related tables:');
        existingTables.rows.forEach(row => {
          console.log(`   • ${row.table_name}`);
        });
      }
    }
    
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the migration
runMigration().catch(console.error);