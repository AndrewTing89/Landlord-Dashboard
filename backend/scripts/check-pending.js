const db = require('../src/db/connection');

async function checkPending() {
  try {
    console.log('🔧 Processing raw transactions...');
    const rawTxs = await db.query(`
      SELECT * FROM raw_transactions 
      WHERE processed = false 
      ORDER BY posted_date DESC 
      LIMIT 10
    `);
    
    console.log('Sample pending transactions:');
    rawTxs.rows.forEach(tx => {
      console.log(`  - ${tx.description}: $${tx.amount} (${tx.suggested_expense_type || 'unclassified'})`);
    });
    
    console.log(`\nTotal pending: ${rawTxs.rows.length} (showing first 10)`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit(0);
  }
}

checkPending();