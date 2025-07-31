#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');

console.log('Testing sync process exit behavior...\n');

const syncProcess = spawn('node', [
  path.join(__dirname, 'full-sync.js'),
  'daily',
  '7'
], {
  cwd: path.join(__dirname, '../..'),
  env: { ...process.env },
  stdio: 'inherit'
});

const startTime = Date.now();

syncProcess.on('exit', (code, signal) => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\nSync process exited after ${duration} seconds`);
  console.log(`Exit code: ${code}`);
  console.log(`Signal: ${signal}`);
  
  if (duration > 60) {
    console.log('⚠️  WARNING: Sync took longer than expected to exit');
  } else {
    console.log('✅ Sync exited in a reasonable time');
  }
});

syncProcess.on('error', (error) => {
  console.error('Process error:', error);
});

// Monitor if the process is still running
let checkCount = 0;
const checkInterval = setInterval(() => {
  checkCount++;
  if (syncProcess.exitCode === null) {
    console.log(`⏱️  Sync still running... (${checkCount * 10}s)`);
  } else {
    clearInterval(checkInterval);
  }
}, 10000);