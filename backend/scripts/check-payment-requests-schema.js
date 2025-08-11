const db = require('../src/db/connection');

async function checkPaymentRequestsSchema() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'payment_requests' 
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 PAYMENT_REQUESTS TABLE SCHEMA:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
    // Also check utility_bills schema
    const utilityBillsResult = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'utility_bills' 
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('\n📋 UTILITY_BILLS TABLE SCHEMA:');
    utilityBillsResult.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkPaymentRequestsSchema();