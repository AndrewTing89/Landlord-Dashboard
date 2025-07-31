#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function fixRoommateNames() {
  try {
    console.log('Starting roommate name fix...\n');
    
    // First, check how many payment requests have the wrong name
    const wrongNameRequests = await db.query(
      `SELECT COUNT(*) as count FROM payment_requests WHERE roommate_name = 'Roommate Name'`
    );
    
    console.log(`Found ${wrongNameRequests.rows[0].count} payment requests with 'Roommate Name'`);
    
    if (wrongNameRequests.rows[0].count === 0) {
      console.log('No payment requests to fix!');
      return;
    }
    
    // Get details of requests to be updated
    const requestsToUpdate = await db.query(
      `SELECT id, bill_type, month, year, amount, status 
       FROM payment_requests 
       WHERE roommate_name = 'Roommate Name'
       ORDER BY year DESC, month DESC`
    );
    
    console.log('\nPayment requests to update:');
    requestsToUpdate.rows.forEach(req => {
      console.log(`- ID ${req.id}: ${req.bill_type} ${req.month}/${req.year} - $${req.amount} (${req.status})`);
    });
    
    // Ask for confirmation
    console.log('\nThis will update all these payment requests to use "UshiLo" as the roommate name.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update all payment requests
    const updateResult = await db.query(
      `UPDATE payment_requests 
       SET roommate_name = 'UshiLo', 
           updated_at = NOW() 
       WHERE roommate_name = 'Roommate Name'
       RETURNING id`
    );
    
    console.log(`\n✅ Updated ${updateResult.rowCount} payment requests successfully!`);
    
    // Also check if there are any venmo_payment_requests with wrong name
    const venmoRequests = await db.query(
      `SELECT COUNT(*) as count FROM venmo_payment_requests WHERE from_name = 'Roommate Name'`
    );
    
    if (venmoRequests.rows[0].count > 0) {
      console.log(`\nFound ${venmoRequests.rows[0].count} Venmo requests with wrong name, updating...`);
      
      const venmoUpdate = await db.query(
        `UPDATE venmo_payment_requests 
         SET from_name = 'UshiLo' 
         WHERE from_name = 'Roommate Name'`
      );
      
      console.log(`✅ Updated ${venmoUpdate.rowCount} Venmo requests successfully!`);
    }
    
    // Final verification
    const finalCheck = await db.query(
      `SELECT 
        (SELECT COUNT(*) FROM payment_requests WHERE roommate_name = 'UshiLo') as correct_count,
        (SELECT COUNT(*) FROM payment_requests WHERE roommate_name = 'Roommate Name') as wrong_count`
    );
    
    console.log('\nFinal counts:');
    console.log(`- Payment requests with 'UshiLo': ${finalCheck.rows[0].correct_count}`);
    console.log(`- Payment requests with 'Roommate Name': ${finalCheck.rows[0].wrong_count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

fixRoommateNames();