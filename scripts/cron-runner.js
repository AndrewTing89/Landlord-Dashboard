#!/usr/bin/env node

const axios = require('axios');
const moment = require('moment');
const { exec } = require('child_process');
const path = require('path');

const API_BASE = process.env.API_BASE || 'http://localhost:3002';

// This script runs daily at 5 AM
async function runDailyTasks() {
  console.log(`[${moment().format()}] Starting daily tasks...`);
  
  const today = moment();
  const dayOfMonth = today.date();
  
  try {
    // On the 1st of each month, insert rent transaction
    if (dayOfMonth === 1) {
      console.log('Running monthly rent insertion...');
      
      const rentScriptPath = path.join(__dirname, '../backend/src/scripts/insert-monthly-rent.js');
      await new Promise((resolve, reject) => {
        exec(`node ${rentScriptPath}`, (error, stdout, stderr) => {
          if (error) {
            console.error('Rent insertion error:', error);
            reject(error);
          } else {
            console.log('Rent insertion output:', stdout);
            if (stderr) console.error('Rent insertion stderr:', stderr);
            resolve();
          }
        });
      });
    }
    
    // On the 5th of each month, run bill processing
    if (dayOfMonth === 5) {
      console.log('Running monthly bill processing...');
      
      // First sync transactions (using SimpleFIN)
      const syncResponse = await axios.post(`${API_BASE}/api/simplefin/sync`);
      console.log('Transaction sync result:', syncResponse.data);
      
      // Wait a bit for transactions to be saved
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Then process bills
      const billResponse = await axios.post(`${API_BASE}/api/lambda/process-bills`);
      console.log('Bill processing result:', billResponse.data);
    }
    
    // Daily transaction sync (always run)
    console.log('Running daily transaction sync...');
    const dailySyncResponse = await axios.post(`${API_BASE}/api/simplefin/sync`);
    console.log('Daily sync result:', dailySyncResponse.data);
    
    // Check Venmo emails twice daily (morning and evening)
    const hour = moment().hour();
    if (hour === 9 || hour === 18) {
      console.log('Checking Venmo emails...');
      try {
        const venmoResponse = await axios.post(`${API_BASE}/api/check-venmo-emails`);
        console.log('Venmo email check result:', venmoResponse.data);
      } catch (error) {
        console.error('Venmo email check failed:', error.message);
      }
    }
    
  } catch (error) {
    console.error('Error in daily tasks:', error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
  }
  
  console.log(`[${moment().format()}] Daily tasks completed`);
}

// Run immediately if called directly
if (require.main === module) {
  runDailyTasks().then(() => {
    console.log('Cron job completed');
    process.exit(0);
  }).catch(err => {
    console.error('Cron job failed:', err);
    process.exit(1);
  });
}

module.exports = { runDailyTasks };