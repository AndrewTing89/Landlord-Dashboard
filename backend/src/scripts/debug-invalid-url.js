#!/usr/bin/env node

require('dotenv').config();
const axios = require('axios');

// Add interceptor to catch Invalid URL errors
axios.interceptors.request.use(
  (config) => {
    console.log(`[AXIOS REQUEST] ${config.method?.toUpperCase()} ${config.url}`);
    if (!config.url || (!config.url.startsWith('http://') && !config.url.startsWith('https://'))) {
      console.error('[AXIOS ERROR] Invalid URL detected:');
      console.error('- URL:', config.url);
      console.error('- Method:', config.method);
      console.error('- Stack:', new Error().stack);
    }
    return config;
  },
  (error) => {
    console.error('[AXIOS REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_INVALID_URL') {
      console.error('[AXIOS INVALID URL ERROR]');
      console.error('- Config URL:', error.config?.url);
      console.error('- Error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Now run the sync
const { spawn } = require('child_process');
const path = require('path');

console.log('Starting sync with debug interceptors...\n');

const syncProcess = spawn('node', [
  path.join(__dirname, 'full-sync.js'),
  'daily',
  '7'
], {
  stdio: 'inherit',
  env: { ...process.env }
});

syncProcess.on('exit', (code) => {
  console.log(`\nSync exited with code ${code}`);
});