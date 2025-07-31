#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function checkSyncStatus() {
  try {
    console.log('Checking sync history status...\n');
    
    // Get recent sync history
    const syncHistory = await db.query(
      `SELECT id, sync_type, status, started_at, completed_at, 
              transactions_imported, bills_processed, payment_requests_created,
              errors
       FROM sync_history 
       ORDER BY started_at DESC 
       LIMIT 10`
    );
    
    console.log('Recent sync history:');
    syncHistory.rows.forEach(sync => {
      const startTime = new Date(sync.started_at).toLocaleString();
      const endTime = sync.completed_at ? new Date(sync.completed_at).toLocaleString() : 'Not completed';
      const duration = sync.completed_at 
        ? Math.round((new Date(sync.completed_at) - new Date(sync.started_at)) / 1000) + 's'
        : 'Still running';
      
      console.log(`\nID: ${sync.id}`);
      console.log(`  Type: ${sync.sync_type}`);
      console.log(`  Status: ${sync.status}`);
      console.log(`  Started: ${startTime}`);
      console.log(`  Completed: ${endTime}`);
      console.log(`  Duration: ${duration}`);
      console.log(`  Results: ${sync.transactions_imported || 0} transactions, ${sync.bills_processed || 0} bills, ${sync.payment_requests_created || 0} payment requests`);
      if (sync.errors) {
        console.log(`  Errors: ${sync.errors}`);
      }
    });
    
    // Check for stuck syncs
    const stuckSyncs = await db.query(
      `SELECT id, sync_type, started_at,
              EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as minutes_running
       FROM sync_history 
       WHERE status = 'running'
       AND started_at < NOW() - INTERVAL '10 minutes'`
    );
    
    if (stuckSyncs.rows.length > 0) {
      console.log('\n⚠️  Stuck syncs detected (running for more than 10 minutes):');
      stuckSyncs.rows.forEach(sync => {
        console.log(`  - ID ${sync.id}: ${sync.sync_type} (running for ${Math.round(sync.minutes_running)} minutes)`);
      });
      
      console.log('\nDo you want to mark these as failed? This will update the frontend.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkSyncStatus();