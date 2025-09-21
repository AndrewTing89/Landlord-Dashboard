#!/usr/bin/env node

require('dotenv').config();
const db = require('../../db/connection');
const simplefinService = require('../../services/simplefinService');
const discordService = require('../../services/discordService');
const venmoLinkService = require('../../services/venmoLinkService');
const syncTracker = require('../../services/syncTracker');
const { generateTrackingId } = require('../../utils/trackingId');

async function fullSync(syncType = 'daily', lookbackDays = 7) {
  const startTime = new Date();
  let syncId = null;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 ${syncType.toUpperCase()} SYNC STARTED - ${startTime.toLocaleString()}`);
  console.log(`📅 Looking back ${lookbackDays} days`);
  console.log(`${'='.repeat(60)}\n`);
  
  const results = {
    transactions: 0,
    newBills: [],
    paymentRequests: [],
    errors: [],
    pendingReview: 0
  };
  
  try {
    console.log('[FULL-SYNC] Starting sync tracking...');
    // Start tracking this sync
    syncId = await syncTracker.startSync(syncType, { lookbackDays });
    console.log('[FULL-SYNC] Sync ID:', syncId);
    
    // 1. Sync transactions from SimpleFIN
    console.log('1️⃣  Syncing transactions from Bank of America...');
    try {
      // Calculate start date based on lookback days
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - lookbackDays);
      
      console.log(`   📅 Looking for transactions from ${startDate.toISOString().split('T')[0]} to today`);
      
      const syncResult = await simplefinService.syncTransactions(startDate);
      results.transactions = syncResult.transactionsSaved || 0;
      console.log(`   ✅ Imported ${syncResult.transactionsSaved || 0} new transactions`);
      
      // Send Discord notification if new transactions need review
      if (syncResult.transactionsSaved > 0) {
        try {
          await discordService.sendTransactionReview(syncResult.transactionsSaved);
        } catch (discordError) {
          console.error('Failed to send Discord notification:', discordError.message);
          // Don't let Discord errors fail the sync
        }
      }
    } catch (error) {
      console.error('   ❌ SimpleFIN sync error:', error.message);
      results.errors.push(`SimpleFIN sync: ${error.message}`);
      
      // If it's a timeout, log that specifically
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        console.error('   ⏱️  The request timed out. SimpleFIN may be slow or unresponsive.');
      }
    }
    
    // 2. Process ETL rules to categorize transactions
    console.log('\n2️⃣  Processing ETL rules...');
    const pendingTransactions = await db.query(
      `SELECT COUNT(*) as count FROM raw_transactions 
       WHERE processed = false AND excluded = false`
    );
    const pendingCount = parseInt(pendingTransactions.rows[0].count);
    console.log(`   📊 ${pendingCount} transactions pending review`);
    results.pendingReview = pendingCount;
    
    // 3. Check for new utility bills and create payment requests
    console.log('\n3️⃣  Checking for new utility bills...');
    
    // Load roommate config to know how many roommates we have
    const roommateConfigCheck = require('../config/roommate.config');
    const expectedRoommateCount = roommateConfigCheck.roommates.length;
    
    // Find electricity and water transactions that need payment requests (these are split with roommates)
    const newBills = await db.query(
      `SELECT t.* FROM expenses t
       WHERE t.expense_type IN ('electricity', 'water')
       AND (
         SELECT COUNT(DISTINCT roommate_name) 
         FROM payment_requests pr 
         WHERE pr.month = EXTRACT(MONTH FROM t.date)
         AND pr.year = EXTRACT(YEAR FROM t.date)
         AND pr.bill_type = t.expense_type
       ) < ${expectedRoommateCount}  -- Not all roommates have payment requests
       AND t.date >= CURRENT_DATE - INTERVAL '${lookbackDays} days'
       ORDER BY t.date DESC`
    );
    
    console.log(`   🔍 Found ${newBills.rows.length} bills without payment requests (last ${lookbackDays} days)`);
    
    // Load roommate configuration
    const roommateConfig = require('../../config/roommate.config');
    const roommates = roommateConfig.roommates;
    
    for (const bill of newBills.rows) {
      console.log(`\n   💡 Processing ${bill.expense_type} bill from ${bill.date}`);
      
      // Calculate split amount
      const totalAmount = parseFloat(bill.amount);
      const splitAmount = (totalAmount / 3).toFixed(2);
      
      const billMonth = new Date(bill.date).getMonth() + 1;
      const billYear = new Date(bill.date).getFullYear();
      const trackingId = generateTrackingId(billMonth, billYear, bill.expense_type);
      
      // Create payment request for each roommate
      for (const roommate of roommates) {
        // Check if this specific roommate already has a payment request for this bill
        const existingRequest = await db.query(
          `SELECT id FROM payment_requests 
           WHERE month = $1 AND year = $2 AND bill_type = $3 AND roommate_name = $4`,
          [billMonth, billYear, bill.expense_type, roommate.name]
        );
        
        if (existingRequest.rows.length > 0) {
          console.log(`      ⏭️  ${roommate.name} already has a payment request for this bill, skipping...`);
          continue;
        }
        
        const paymentRequest = await db.insert('payment_requests', {
          bill_type: bill.expense_type,
          merchant_name: bill.merchant_name || bill.name,
          amount: splitAmount,
          total_amount: totalAmount.toFixed(2),
          venmo_username: roommate.venmoUsername,
          roommate_name: roommate.name,
          status: 'pending',
          request_date: new Date(),
          month: billMonth,
          year: billYear,
          charge_date: bill.date,
          created_at: new Date(),
          tracking_id: trackingId
        });
        
        // Generate Venmo link with new format
        const monthName = new Date(bill.date).toLocaleString('default', { month: 'short' });
        const typeCapitalized = bill.expense_type.charAt(0).toUpperCase() + bill.expense_type.slice(1);
        const billDate = new Date(bill.date);
        const paymentDateStr = `${billDate.getMonth() + 1}/${billDate.getDate()}/${billDate.getFullYear()}`;
        
        const note = `${trackingId} - ${typeCapitalized} bill for ${monthName} ${billYear}: Total $${totalAmount}, your share is $${splitAmount} (1/3). I paid the full amount on ${paymentDateStr}.`;
        
        const venmoLink = venmoLinkService.generateVenmoLink(roommate.venmoUsername, parseFloat(splitAmount), note);
        
        // Update with Venmo link
        await db.query(
          'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
          [venmoLink, paymentRequest.id]
        );
        
        results.paymentRequests.push(paymentRequest);
      }
      
      results.newBills.push(bill);
      
      // Send Discord notification for the new payment request
      try {
        await discordService.sendPaymentRequest({
          billType: bill.expense_type,
          totalAmount: totalAmount,
          splitAmount: splitAmount,
          merchantName: bill.merchant_name || bill.name,
          venmoLink: venmoLink,
          dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toLocaleDateString(),
          month: new Date(bill.date).getMonth() + 1,
          year: new Date(bill.date).getFullYear()
        });
        
        console.log(`   ✅ Discord notification sent for ${bill.expense_type} bill`);
        
        // Also send tenant-specific notification with @andrewhting Venmo link
        const TenantNotificationService = require('../notify-tenants-new-bills');
        const tenantNotifier = new TenantNotificationService();
        await tenantNotifier.notifyNewBill({
          bill_type: bill.expense_type,
          total_amount: totalAmount.toFixed(2),
          amount: splitAmount,
          merchant_name: bill.merchant_name || bill.name,
          month: billMonth,
          year: billYear,
          tracking_id: trackingId
        });
        console.log(`   ✅ Tenant Discord notification sent`);
      } catch (error) {
        console.error(`   ❌ Failed to send Discord notification:`, error.message);
        results.errors.push(`Discord notification: ${error.message}`);
      }
    }
    
    // 4. Check and create rent payment requests
    console.log('\n4️⃣  Checking rent payment requests...');
    try {
      const { createRentPaymentRequest } = require('../../../scripts/create-rent-payment-request');
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      let rentCreated = 0;
      
      // Only process rent for 2025 onwards
      if (currentYear >= 2025) {
        // Create rent request for current month if we're on or after the 1st
        if (currentDate.getDate() >= 1) {
          const rentResult = await createRentPaymentRequest(currentYear, currentMonth);
          if (rentResult.success) {
            console.log(`   ✅ ${rentResult.message}`);
            rentCreated++;
            results.paymentRequests.push(rentResult.request);
          }
        }
        
        // Also check previous months in 2025 in case any were missed
        if (currentYear === 2025) {
          for (let month = 1; month < currentMonth; month++) {
            const rentResult = await createRentPaymentRequest(2025, month);
            if (rentResult.success) {
              console.log(`   ✅ ${rentResult.message} (catch-up)`);
              rentCreated++;
              results.paymentRequests.push(rentResult.request);
            }
          }
        }
      }
      
      if (rentCreated === 0) {
        console.log('   ℹ️  No new rent payment requests needed');
      } else {
        console.log(`   📝 Created ${rentCreated} rent payment request(s)`);
      }
    } catch (rentError) {
      console.error('   ❌ Error checking rent payment requests:', rentError.message);
      // Don't fail the sync for rent errors
      results.errors.push(`Rent payment request: ${rentError.message}`);
    }
    
    // 5. Summary
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 ${syncType.toUpperCase()} SYNC SUMMARY`);
    console.log(`${'='.repeat(60)}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📅 Lookback period: ${lookbackDays} days`);
    console.log(`📥 New transactions: ${results.transactions}`);
    console.log(`💡 New utility bills: ${results.newBills.length}`);
    console.log(`💸 Payment requests created: ${results.paymentRequests.length}`);
    console.log(`🔍 Pending review: ${results.pendingReview}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
    }
    
    // Process Gmail emails before completing sync
    let emailResults = { processed: 0, matched: 0 };
    try {
      const gmailService = require('../../services/gmailService');
      const hasGmail = await gmailService.loadTokens();
      
      if (hasGmail) {
        console.log('\n📧 Processing Gmail for Venmo payment confirmations...');
        emailResults = await gmailService.processVenmoEmails();
        console.log(`✅ Processed ${emailResults.processed} emails, matched ${emailResults.matched} payments`);
      }
    } catch (error) {
      console.error('❌ Error processing Gmail emails:', error.message);
      results.errors.push(`Gmail processing: ${error.message}`);
    }
    
    // Complete sync tracking
    if (syncId) {
      await syncTracker.completeSync(syncId, {
        transactions: results.transactions,
        bills: results.newBills.length,
        paymentRequests: results.paymentRequests.length,
        pendingReview: results.pendingReview,
        errors: results.errors
      });
    }
    
    // Send comprehensive summary to Discord for catch-up syncs
    if (syncType === 'catch_up' && results.paymentRequests.length > 0) {
      console.log('\n📨 Sending catch-up summary to Discord...');
      await discordService.sendDailySyncSummary({
        startTime: startTime,
        endTime: endTime,
        duration: duration,
        transactions: {
          imported: results.transactions,
          pending: results.pendingReview
        },
        bills: {
          found: results.newBills.length,
          processed: results.newBills.map(bill => ({
            type: bill.expense_type,
            amount: parseFloat(bill.amount).toFixed(2)
          }))
        },
        paymentRequests: {
          created: results.paymentRequests.length,
          total: results.paymentRequests.length
        },
        emails: {
          checked: emailResults.total || 0,
          processed: emailResults.processed,
          matched: emailResults.matched
        },
        errors: results.errors
      });
    }
    
    console.log(`\n✅ ${syncType === 'catch_up' ? 'Catch-up' : 'Daily'} sync completed at ${endTime.toLocaleTimeString()}\n`);
    
  } catch (error) {
    console.error(`\n❌ FATAL ERROR in ${syncType} sync:`, error);
    if (syncId) {
      await syncTracker.failSync(syncId, error);
    }
    await discordService.sendError(`${syncType === 'catch_up' ? 'Catch-up' : 'Daily'} Sync Failed`, error.message);
  } finally {
    // Close database connection to allow clean exit
    try {
      await db.close();
      console.log('Database connection closed');
    } catch (closeError) {
      console.error('Error closing database:', closeError);
    }
    
    // Force exit after a short delay to ensure all logs are written
    setTimeout(() => {
      console.log('Forcing process exit...');
      process.exit(0);
    }, 100);
    
    // Backup force exit if something is really stuck
    setTimeout(() => {
      console.error('Process failed to exit cleanly, forcing termination');
      process.exit(1);
    }, 5000);
  }
}

// Get sync type and lookback days from arguments or environment
const syncType = process.argv[2] || process.env.SYNC_TYPE || 'daily';
const lookbackDays = parseInt(process.argv[3] || process.env.SYNC_LOOKBACK_DAYS || '7');

// Run the sync
fullSync(syncType, lookbackDays);