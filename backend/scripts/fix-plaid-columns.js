const db = require('../src/db/connection');

async function fixPlaidColumns() {
  try {
    console.log('🔧 Fixing Plaid column names to SimpleFIN...');
    
    // Rename plaid_transaction_id to simplefin_transaction_id
    await db.query(`
      ALTER TABLE expenses 
      RENAME COLUMN plaid_transaction_id TO simplefin_transaction_id
    `);
    console.log('✅ Renamed plaid_transaction_id → simplefin_transaction_id');
    
    // Rename plaid_account_id to simplefin_account_id  
    await db.query(`
      ALTER TABLE expenses 
      RENAME COLUMN plaid_account_id TO simplefin_account_id
    `);
    console.log('✅ Renamed plaid_account_id → simplefin_account_id');
    
    // Update the unique constraint name too
    await db.query(`
      ALTER TABLE expenses 
      DROP CONSTRAINT IF EXISTS expenses_plaid_transaction_id_key
    `);
    console.log('✅ Dropped old plaid constraint');
    
    await db.query(`
      ALTER TABLE expenses 
      ADD CONSTRAINT expenses_simplefin_transaction_id_key 
      UNIQUE (simplefin_transaction_id)
    `);
    console.log('✅ Added new SimpleFIN constraint');
    
    console.log('🎉 All Plaid references removed from expenses table!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('does not exist')) {
      console.log('✅ Columns may already be renamed');
    }
  } finally {
    process.exit(0);
  }
}

fixPlaidColumns();