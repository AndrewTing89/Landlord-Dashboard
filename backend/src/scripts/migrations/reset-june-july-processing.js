#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function resetJuneJulyProcessing() {
  try {
    console.log('Resetting processing status for June/July raw transactions...\n');
    
    // Reset processed flag for June/July transactions
    const resetResult = await db.query(
      `UPDATE raw_transactions 
       SET processed = false, processed_at = NULL
       WHERE posted_date >= '2025-06-01' AND posted_date < '2025-08-01'
       RETURNING id, posted_date, description`
    );
    
    console.log(`✅ Reset ${resetResult.rowCount} transactions to unprocessed state`);
    
    // Show some examples
    console.log('\nSample transactions reset:');
    resetResult.rows.slice(0, 5).forEach(tx => {
      console.log(`  - ${new Date(tx.posted_date).toLocaleDateString()}: ${tx.description}`);
    });
    
    // Now process them
    console.log('\nProcessing transactions through ETL rules...');
    await require('./process-all-raw-transactions.js');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

resetJuneJulyProcessing();