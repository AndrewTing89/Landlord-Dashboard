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
    
    // Find electricity and water transactions that need payment requests (these are split with roommates)
    const newBills = await db.query(
      `SELECT t.* FROM transactions t
       WHERE t.expense_type IN ('electricity', 'water')
       AND NOT EXISTS (
         SELECT 1 FROM payment_requests pr 
         WHERE pr.merchant_name = t.merchant_name 
         AND pr.month = EXTRACT(MONTH FROM t.date)
         AND pr.year = EXTRACT(YEAR FROM t.date)
       )
       AND t.date >= CURRENT_DATE - INTERVAL '${lookbackDays} days'
       ORDER BY t.date DESC`
    );
    
    console.log(`   🔍 Found ${newBills.rows.length} bills without payment requests (last ${lookbackDays} days)`);
    
    for (const bill of newBills.rows) {
      console.log(`\n   💡 Processing ${bill.expense_type} bill from ${bill.date}`);
      
      // Calculate split amount
      const totalAmount = parseFloat(bill.amount);
      const splitAmount = (totalAmount / 3).toFixed(2);
      
      // Create payment request
      const billMonth = new Date(bill.date).getMonth() + 1;
      const billYear = new Date(bill.date).getFullYear();
      const trackingId = generateTrackingId(billMonth, billYear, bill.expense_type);
      
      const paymentRequest = await db.insert('payment_requests', {
        bill_type: bill.expense_type,
        merchant_name: bill.merchant_name || bill.name,
        amount: splitAmount,
        total_amount: totalAmount.toFixed(2),
        venmo_username: '@UshiLo',
        roommate_name: 'UshiLo',
        status: 'pending',
        request_date: new Date(),
        month: billMonth,
        year: billYear,
        charge_date: bill.date,
        created_at: new Date(),
        tracking_id: trackingId
      });
      
      // Generate Venmo link
      const monthName = new Date(bill.date).toLocaleString('default', { month: 'short' });
      const utilityName = {
        'electricity': 'PG&E',
        'water': 'Water',
        'internet': 'Internet',
        'landscape': 'Landscaping'
      }[bill.expense_type] || bill.expense_type;
      
      const note = `[${trackingId}] ${utilityName} bill for ${monthName} ${billYear}: Total $${totalAmount}, your share is $${splitAmount} (1/3). I've already paid the full amount.`;
      
      const venmoLink = venmoLinkService.generateVenmoLink('@UshiLo', parseFloat(splitAmount), note);
      
      // Update with Venmo link
      await db.query(
        'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
        [venmoLink, paymentRequest.id]
      );
      
      results.newBills.push(bill);
      results.paymentRequests.push(paymentRequest);
      
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
      } catch (error) {
        console.error(`   ❌ Failed to send Discord notification:`, error.message);
        results.errors.push(`Discord notification: ${error.message}`);
      }
    }
    
    // 4. Check and add rent income for 2025
    console.log('\n4️⃣  Checking rent income...');
    try {
      const { addRentForMonth } = require('../add-rent-income-2025');
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1;
      let rentAdded = 0;
      
      // Only process rent for 2025
      if (currentYear === 2025) {
        // Add rent for current month if we're on or after the 1st
        if (currentDate.getDate() >= 1) {
          const rentResult = await addRentForMonth(2025, currentMonth);
          if (rentResult.success) {
            console.log(`   ✅ ${rentResult.message}`);
            rentAdded++;
          }
        }
        
        // Also check previous months in case any were missed
        for (let month = 1; month < currentMonth; month++) {
          const rentResult = await addRentForMonth(2025, month);
          if (rentResult.success) {
            console.log(`   ✅ ${rentResult.message} (catch-up)`);
            rentAdded++;
          }
        }
      }
      
      if (rentAdded === 0) {
        console.log('   ℹ️  No new rent income to add');
      } else {
        console.log(`   💰 Added ${rentAdded} rent payment(s)`);
      }
    } catch (rentError) {
      console.error('   ❌ Error checking rent income:', rentError.message);
      // Don't fail the sync for rent errors
      results.errors.push(`Rent income check: ${rentError.message}`);
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