const db = require('../db/connection');

async function clearTransactions() {
  try {
    console.log('Clearing SimpleFIN transactions from main table...');
    
    const result = await db.query(
      "DELETE FROM transactions WHERE plaid_transaction_id LIKE 'simplefin_%'"
    );
    
    console.log(`✅ Cleared ${result.rowCount} SimpleFIN transactions`);
    console.log('Ready to resync with ETL pipeline!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

clearTransactions();