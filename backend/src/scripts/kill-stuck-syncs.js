#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

async function killStuckSyncs() {
  try {
    console.log('Looking for stuck sync processes...\n');
    
    // Find any node processes running full-sync.js
    try {
      const { stdout } = await execPromise('ps aux | grep "node.*full-sync" | grep -v grep');
      const lines = stdout.trim().split('\n').filter(line => line);
      
      if (lines.length > 0) {
        console.log(`Found ${lines.length} sync process(es):\n`);
        
        for (const line of lines) {
          const parts = line.split(/\s+/);
          const pid = parts[1];
          const startTime = parts[8];
          
          console.log(`PID: ${pid}, Started: ${startTime}`);
          console.log('Killing process...');
          
          try {
            await execPromise(`kill -9 ${pid}`);
            console.log('✅ Process killed\n');
          } catch (err) {
            console.error(`❌ Failed to kill process: ${err.message}\n`);
          }
        }
      } else {
        console.log('No sync processes found running.');
      }
    } catch (err) {
      // grep returns exit code 1 when no matches found
      if (err.code === 1) {
        console.log('No sync processes found running.');
      } else {
        throw err;
      }
    }
    
    // Also mark any "running" syncs in DB as failed
    const stuckSyncs = await db.query(
      `UPDATE sync_history 
       SET status = 'failed', 
           completed_at = NOW(),
           errors = ARRAY['Sync killed - was stuck']
       WHERE status = 'running'
       RETURNING id, sync_type, started_at`
    );
    
    if (stuckSyncs.rows.length > 0) {
      console.log(`\n📊 Marked ${stuckSyncs.rows.length} stuck sync(s) as failed in database:`);
      stuckSyncs.rows.forEach(sync => {
        console.log(`- Sync ID ${sync.id} (${sync.sync_type}) started at ${sync.started_at}`);
      });
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

killStuckSyncs();