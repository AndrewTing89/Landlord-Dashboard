#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');
const { createRentPaymentRequest } = require('./create-rent-payment-request');

/**
 * Migrates from the old system (manual rent transactions) to the new system (payment requests)
 * This script will:
 * 1. Find all manual rent transactions
 * 2. Create corresponding payment requests
 * 3. Mark payment requests as paid if we have the Venmo email
 * 4. Optionally delete the manual transactions
 */
async function migrateRentToPaymentRequests() {
  console.log('🔄 Migrating Rent System\n');
  console.log('From: Manual transactions in transactions table');
  console.log('To:   Payment requests with email matching\n');
  console.log('='.repeat(60) + '\n');
  
  const dryRun = !process.argv.includes('--execute');
  
  if (dryRun) {
    console.log('🔍 DRY RUN MODE - No changes will be made');
    console.log('   Add --execute to perform the migration\n');
  }
  
  try {
    // 1. Find all manual rent transactions from 2025 onwards
    console.log('📊 Finding manual rent transactions...');
    const manualRentTransactions = await db.query(`
      SELECT * FROM transactions 
      WHERE expense_type = 'rent' 
      AND (plaid_transaction_id LIKE 'rent_%' OR plaid_account_id = 'manual_entry')
      AND date >= '2025-01-01'
      ORDER BY date
    `);
    
    console.log(`   Found ${manualRentTransactions.rows.length} manual rent transactions\n`);
    
    // 2. Find existing Venmo emails for rent payments
    console.log('📧 Finding Venmo rent payment emails...');
    const venmoRentEmails = await db.query(`
      SELECT * FROM venmo_emails
      WHERE venmo_amount >= 1585
      AND venmo_actor ILIKE '%ushi%'
      AND received_date >= '2025-01-01'
      ORDER BY received_date
    `);
    
    console.log(`   Found ${venmoRentEmails.rows.length} potential rent payment emails\n`);
    
    // 3. Create payment requests for each month
    console.log('💳 Processing rent by month...\n');
    
    const monthsProcessed = new Map();
    let created = 0;
    let matched = 0;
    let deleted = 0;
    
    for (const transaction of manualRentTransactions.rows) {
      const date = new Date(transaction.date);
      const year = date.getFullYear();
      const month = date.getMonth() + 1;
      const monthKey = `${year}-${month}`;
      
      if (monthsProcessed.has(monthKey)) {
        console.log(`   ⏭️  Already processed ${monthKey}`);
        continue;
      }
      
      console.log(`   Processing ${monthKey}:`);
      console.log(`      Manual transaction: $${transaction.amount} on ${transaction.date}`);
      
      // Check if payment request already exists
      const existingRequest = await db.getOne(
        `SELECT * FROM payment_requests 
         WHERE bill_type = 'rent' 
         AND year = $1 
         AND month = $2`,
        [year, month]
      );
      
      if (existingRequest) {
        console.log(`      ✓ Payment request already exists (#${existingRequest.id})`);
      } else if (!dryRun) {
        // Create payment request
        const result = await createRentPaymentRequest(year, month, transaction.amount);
        if (result.success) {
          console.log(`      ✅ Created payment request #${result.request.id}`);
          created++;
          
          // Check if we have a matching Venmo email
          const matchingEmail = venmoRentEmails.rows.find(email => {
            const emailDate = new Date(email.received_date);
            return emailDate.getMonth() + 1 === month && 
                   emailDate.getFullYear() === year &&
                   Math.abs(email.venmo_amount - transaction.amount) < 100;
          });
          
          if (matchingEmail) {
            // Update payment request as paid
            await db.query(
              `UPDATE payment_requests 
               SET status = 'paid', 
                   paid_date = $1,
                   updated_at = NOW()
               WHERE id = $2`,
              [matchingEmail.received_date, result.request.id]
            );
            
            // Link the email to the payment request
            await db.query(
              `UPDATE venmo_emails 
               SET payment_request_id = $1,
                   matched = true
               WHERE id = $2`,
              [result.request.id, matchingEmail.id]
            );
            
            console.log(`      💰 Matched to Venmo payment from ${matchingEmail.received_date}`);
            matched++;
          }
        }
      } else {
        console.log(`      [DRY RUN] Would create payment request`);
      }
      
      monthsProcessed.set(monthKey, true);
    }
    
    // 4. Delete manual transactions if requested
    if (process.argv.includes('--delete-manual') && !dryRun) {
      console.log('\n🗑️  Deleting manual rent transactions...');
      
      const deleteResult = await db.query(`
        DELETE FROM transactions 
        WHERE expense_type = 'rent' 
        AND (plaid_transaction_id LIKE 'rent_%' OR plaid_account_id = 'manual_entry')
        AND date >= '2025-01-01'
        RETURNING id
      `);
      
      deleted = deleteResult.rows.length;
      console.log(`   Deleted ${deleted} manual transactions`);
    } else if (process.argv.includes('--delete-manual')) {
      console.log('\n[DRY RUN] Would delete manual rent transactions');
    }
    
    // 5. Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 MIGRATION SUMMARY\n');
    console.log(`Payment Requests Created: ${created}`);
    console.log(`Payments Matched to Emails: ${matched}`);
    console.log(`Manual Transactions Deleted: ${deleted}`);
    console.log(`Months Processed: ${monthsProcessed.size}`);
    
    if (dryRun) {
      console.log('\n⚠️  This was a DRY RUN - no changes were made');
      console.log('   Run with --execute to perform the migration');
      console.log('   Add --delete-manual to also remove old transactions');
    }
    
    // 6. Show current state
    console.log('\n📈 Current System State:');
    
    const rentRequests = await db.query(`
      SELECT status, COUNT(*) as count, SUM(amount::numeric) as total
      FROM payment_requests
      WHERE bill_type = 'rent'
      GROUP BY status
    `);
    
    console.log('\nRent Payment Requests:');
    rentRequests.rows.forEach(row => {
      console.log(`   ${row.status}: ${row.count} requests ($${row.total})`);
    });
    
    const remainingManual = await db.query(`
      SELECT COUNT(*) as count, SUM(amount) as total
      FROM transactions 
      WHERE expense_type = 'rent' 
      AND (plaid_transaction_id LIKE 'rent_%' OR plaid_account_id = 'manual_entry')
    `);
    
    if (remainingManual.rows[0].count > 0) {
      console.log(`\n⚠️  Still have ${remainingManual.rows[0].count} manual rent transactions ($${remainingManual.rows[0].total})`);
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the migration
migrateRentToPaymentRequests();