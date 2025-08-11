const db = require('../src/db/connection');

async function checkRawTransactionsSchema() {
  try {
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default
      FROM information_schema.columns 
      WHERE table_name = 'raw_transactions' 
        AND table_schema = 'public'
      ORDER BY ordinal_position;
    `);
    
    console.log('📋 RAW_TRANSACTIONS TABLE SCHEMA:');
    result.rows.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkRawTransactionsSchema();