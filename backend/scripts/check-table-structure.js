const db = require('../src/db/connection');

async function checkTableStructure() {
  try {
    console.log('📋 Checking raw_transactions table structure...');
    const result = await db.query(`
      SELECT column_name, data_type, is_nullable, column_default 
      FROM information_schema.columns 
      WHERE table_name = 'raw_transactions' 
      ORDER BY ordinal_position
    `);
    
    if (result.rows.length === 0) {
      console.log('❌ raw_transactions table not found');
      return;
    }
    
    console.log('\n✅ Raw transactions columns:');
    result.rows.forEach(col => {
      console.log(`  - ${col.column_name}: ${col.data_type} ${col.is_nullable === 'NO' ? '(NOT NULL)' : '(nullable)'}`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkTableStructure();