#\!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function fixStuckSync() {
  try {
    console.log('Fixing stuck sync processes...\n');
    
    // Find stuck syncs (running for more than 10 minutes)
    const stuckSyncs = await db.query(
      `SELECT id, sync_type, started_at,
              EXTRACT(EPOCH FROM (NOW() - started_at)) / 60 as minutes_running
       FROM sync_history 
       WHERE status = 'running'
       AND started_at < NOW() - INTERVAL '10 minutes'`
    );
    
    if (stuckSyncs.rows.length === 0) {
      console.log('No stuck syncs found.');
      return;
    }
    
    console.log(`Found ${stuckSyncs.rows.length} stuck sync(s):`);
    stuckSyncs.rows.forEach(sync => {
      console.log(`  - ID ${sync.id}: ${sync.sync_type} (running for ${Math.round(sync.minutes_running)} minutes)`);
    });
    
    // Mark them as failed
    for (const sync of stuckSyncs.rows) {
      await db.query(
        `UPDATE sync_history 
         SET status = 'failed',
             completed_at = NOW(),
             errors = 'Sync process timed out or crashed'
         WHERE id = $1`,
        [sync.id]
      );
      console.log(`✅ Marked sync ${sync.id} as failed`);
    }
    
    // Show current sync status
    const currentStatus = await db.query(
      `SELECT sync_type, status, COUNT(*) as count
       FROM sync_history
       WHERE started_at > NOW() - INTERVAL '24 hours'
       GROUP BY sync_type, status
       ORDER BY sync_type, status`
    );
    
    console.log('\nSync status in last 24 hours:');
    currentStatus.rows.forEach(row => {
      console.log(`  - ${row.sync_type} ${row.status}: ${row.count}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

fixStuckSync();
