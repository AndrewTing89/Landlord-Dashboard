#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function removeDuplicateRequests() {
  try {
    console.log('Checking for duplicate July 2025 payment requests...\n');
    
    // Find all July 2025 requests to see the situation
    const julyRequests = await db.query(
      `SELECT id, bill_type, month, year, amount, merchant_name, created_at, status
       FROM payment_requests 
       WHERE (month = 7 AND year = 2025) OR id IN (34, 35)
       ORDER BY created_at DESC`
    );
    
    console.log('Found July 2025 payment requests:');
    julyRequests.rows.forEach(req => {
      console.log(`ID ${req.id}: ${req.bill_type || 'NULL'} - ${req.merchant_name || 'NULL'} - $${req.amount} (${req.status})`);
      console.log(`  Created: ${req.created_at}`);
    });
    
    // The newer ones (IDs 34, 35) were created by daily sync and have better data
    // We should delete the older duplicate (ID 8) and also check for PG&E duplicate
    
    console.log('\nLooking for duplicates to remove...');
    
    // Find duplicates - older requests with same amount and month
    const duplicatesToRemove = await db.query(
      `SELECT pr1.id, pr1.bill_type, pr1.amount, pr1.merchant_name
       FROM payment_requests pr1
       WHERE EXISTS (
         SELECT 1 FROM payment_requests pr2
         WHERE pr2.id != pr1.id
         AND pr2.month = pr1.month
         AND pr2.year = pr1.year
         AND pr2.amount = pr1.amount
         AND pr2.created_at > pr1.created_at
       )
       AND pr1.month = 7 AND pr1.year = 2025`
    );
    
    if (duplicatesToRemove.rows.length === 0) {
      console.log('No duplicates found!');
      return;
    }
    
    console.log(`\nFound ${duplicatesToRemove.rows.length} duplicate(s) to remove:`);
    duplicatesToRemove.rows.forEach(dup => {
      console.log(`- ID ${dup.id}: ${dup.bill_type || 'NULL'} - $${dup.amount}`);
    });
    
    console.log('\nDeleting duplicates...');
    
    const deleteResult = await db.query(
      `DELETE FROM payment_requests 
       WHERE id IN (
         SELECT pr1.id
         FROM payment_requests pr1
         WHERE EXISTS (
           SELECT 1 FROM payment_requests pr2
           WHERE pr2.id != pr1.id
           AND pr2.month = pr1.month
           AND pr2.year = pr1.year
           AND pr2.amount = pr1.amount
           AND pr2.created_at > pr1.created_at
         )
         AND pr1.month = 7 AND pr1.year = 2025
       )
       RETURNING id`
    );
    
    console.log(`✅ Deleted ${deleteResult.rowCount} duplicate payment request(s)`);
    
    // Verify final state
    const finalCheck = await db.query(
      `SELECT id, bill_type, month, year, amount, merchant_name, status
       FROM payment_requests 
       WHERE month = 7 AND year = 2025
       ORDER BY id`
    );
    
    console.log('\nFinal July 2025 payment requests:');
    finalCheck.rows.forEach(req => {
      console.log(`- ID ${req.id}: ${req.bill_type} - ${req.merchant_name} - $${req.amount} (${req.status})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

removeDuplicateRequests();