#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function cleanOldPaymentRequests() {
  try {
    console.log('Cleaning up old payment requests that were accidentally created...\n');
    
    // Find payment requests from 2024 that were created today
    const oldRequests = await db.query(
      `SELECT id, bill_type, merchant_name, month, year, created_at 
       FROM payment_requests 
       WHERE year < 2025 
       AND created_at::date = CURRENT_DATE
       ORDER BY year, month`
    );
    
    console.log(`Found ${oldRequests.rows.length} old payment requests created today:`);
    oldRequests.rows.forEach(pr => {
      console.log(`- ID ${pr.id}: ${pr.bill_type} for ${pr.month}/${pr.year} (${pr.merchant_name})`);
    });
    
    if (oldRequests.rows.length > 0) {
      console.log('\nDeleting these old payment requests...');
      
      const deleteResult = await db.query(
        `DELETE FROM payment_requests 
         WHERE year < 2025 
         AND created_at::date = CURRENT_DATE`
      );
      
      console.log(`✅ Deleted ${deleteResult.rowCount} old payment requests`);
    }
    
    // Also clean up any payment requests from before May 2025
    console.log('\nChecking for other old payment requests...');
    const beforeMay = await db.query(
      `DELETE FROM payment_requests 
       WHERE (year < 2025) OR (year = 2025 AND month < 5)
       RETURNING id, month, year, merchant_name`
    );
    
    if (beforeMay.rowCount > 0) {
      console.log(`✅ Deleted ${beforeMay.rowCount} payment requests from before May 2025`);
    }
    
    // Show remaining payment requests
    const remaining = await db.query(
      `SELECT month, year, COUNT(*) as count 
       FROM payment_requests 
       GROUP BY month, year 
       ORDER BY year DESC, month DESC`
    );
    
    console.log('\nRemaining payment requests by month:');
    remaining.rows.forEach(row => {
      console.log(`- ${row.month}/${row.year}: ${row.count} requests`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

cleanOldPaymentRequests();