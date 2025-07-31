const express = require('express');
const router = express.Router();
const { spawn } = require('child_process');
const db = require('../db/connection');

// Daily sync
router.post('/daily', async (req, res) => {
  try {
    const syncProcess = spawn('node', ['src/scripts/daily/full-sync.js', 'daily', '7'], {
      cwd: process.cwd(),
      env: { ...process.env },
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Set a timeout to kill the process if it runs too long
    const timeout = setTimeout(() => {
      console.error('[Daily Sync] Timeout reached - killing process');
      syncProcess.kill('SIGKILL');
    }, 5 * 60 * 1000); // 5 minutes
    
    // Immediately respond that sync has started
    res.json({ 
      success: true, 
      message: 'Daily sync started',
      pid: syncProcess.pid 
    });
    
    // Log output but don't wait for completion
    syncProcess.stdout.on('data', (data) => {
      console.log('[Daily Sync]', data.toString());
    });
    
    syncProcess.stderr.on('data', (data) => {
      console.error('[Daily Sync Error]', data.toString());
    });
    
    syncProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`[Daily Sync] Process exited with code ${code}`);
    });
    
    // Unref the process so the server doesn't wait for it
    syncProcess.unref();
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Catch-up sync
router.post('/catch-up', async (req, res) => {
  try {
    const { days = 365 } = req.body;
    const syncProcess = spawn('node', ['src/scripts/daily/full-sync.js', 'catch_up', days.toString()], {
      cwd: process.cwd(),
      env: { ...process.env },
      detached: false,
      stdio: ['ignore', 'pipe', 'pipe']
    });
    
    // Set a timeout to kill the process if it runs too long (10 minutes for catch-up)
    const timeout = setTimeout(() => {
      console.error('[Catch-up Sync] Timeout reached - killing process');
      syncProcess.kill('SIGKILL');
    }, 10 * 60 * 1000);
    
    // Immediately respond that sync has started
    res.json({ 
      success: true, 
      message: `Catch-up sync started (${days} days)`,
      pid: syncProcess.pid 
    });
    
    // Log output but don't wait for completion
    syncProcess.stdout.on('data', (data) => {
      console.log('[Catch-up Sync]', data.toString());
    });
    
    syncProcess.stderr.on('data', (data) => {
      console.error('[Catch-up Sync Error]', data.toString());
    });
    
    syncProcess.on('close', (code) => {
      clearTimeout(timeout);
      console.log(`[Catch-up Sync] Process exited with code ${code}`);
    });
    
    // Unref the process so the server doesn't wait for it
    syncProcess.unref();
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sync history
router.get('/history', async (req, res) => {
  try {
    const history = await db.getMany(
      `SELECT * FROM sync_history ORDER BY started_at DESC LIMIT 20`
    );
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get sync stats
router.get('/stats', async (req, res) => {
  try {
    const stats = await db.getOne(
      `SELECT 
        COUNT(*) as total_syncs,
        COUNT(CASE WHEN status = 'completed' THEN 1 END) as successful_syncs,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed_syncs,
        COUNT(CASE WHEN status = 'running' THEN 1 END) as running_syncs
       FROM sync_history`
    );
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;