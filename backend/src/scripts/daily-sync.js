#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');
const simplefinService = require('../services/simplefinService');
const discordService = require('../services/discordService');
const venmoLinkService = require('../services/venmoLinkService');
const syncTracker = require('../services/syncTracker');

async function dailySync(syncType = 'daily') {
  const startTime = new Date();
  let syncId = null;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 DAILY SYNC STARTED - ${startTime.toLocaleString()}`);
  console.log(`${'='.repeat(60)}\n`);
  
  const results = {
    transactions: 0,
    newBills: [],
    paymentRequests: [],
    errors: [],
    pendingReview: 0
  };
  
  try {
    // Start tracking this sync
    syncId = await syncTracker.startSync(syncType, { lookbackDays: process.env.SYNC_LOOKBACK_DAYS || '7' });
    // 1. Sync transactions from SimpleFIN
    console.log('1️⃣  Syncing transactions from Bank of America...');
    try {
      const syncResult = await simplefinService.syncTransactions();
      results.transactions = syncResult.imported || 0;
      console.log(`   ✅ Imported ${syncResult.imported || 0} new transactions`);
      
      // Send Discord notification if new transactions need review
      if (syncResult.imported > 0) {
        await discordService.sendTransactionReview(syncResult.imported);
      }
    } catch (error) {
      console.error('   ❌ SimpleFIN sync error:', error.message);
      results.errors.push(`SimpleFIN sync: ${error.message}`);
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
    
    // Find electricity and water transactions that don't have payment requests
    // For daily sync, only look at recent transactions (7 days)
    // This prevents re-processing old bills and is more efficient
    const lookbackDays = process.env.SYNC_LOOKBACK_DAYS || '7';
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
    
    if (newBills.rows.length === 0 && lookbackDays === '7') {
      console.log(`   💡 Tip: Run 'node src/scripts/catch-up-utility-bills.js' to check older bills`);
    }
    
    for (const bill of newBills.rows) {
      console.log(`\n   💡 Processing ${bill.expense_type} bill from ${bill.date}`);
      
      // Calculate split amount
      const totalAmount = parseFloat(bill.amount);
      const splitAmount = (totalAmount / 3).toFixed(2);
      
      // Create payment request
      const paymentRequest = await db.insert('payment_requests', {
        bill_type: bill.expense_type,
        merchant_name: bill.merchant_name || bill.name,
        amount: splitAmount,
        total_amount: totalAmount.toFixed(2),
        venmo_username: '@UshiLo',
        roommate_name: 'UshiLo',
        status: 'pending',
        request_date: new Date(),
        month: new Date(bill.date).getMonth() + 1,
        year: new Date(bill.date).getFullYear(),
        charge_date: bill.date,
        created_at: new Date()
      });
      
      // Generate Venmo link
      const monthName = new Date(bill.date).toLocaleString('default', { month: 'short' });
      const note = `${bill.expense_type === 'electricity' ? 'PG&E' : 'Water'} bill for ${monthName} ${new Date(bill.date).getFullYear()}: Total $${totalAmount}, your share is $${splitAmount} (1/3). I've already paid the full amount.`;
      
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
    
    // 4. Check for Venmo payment confirmations
    console.log('\n4️⃣  Checking for Venmo payment confirmations...');
    // This would be done by the email monitor service running separately
    
    // 5. Summary
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 DAILY SYNC SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`📥 New transactions: ${results.transactions}`);
    console.log(`💡 New utility bills: ${results.newBills.length}`);
    console.log(`💸 Payment requests created: ${results.paymentRequests.length}`);
    console.log(`❌ Errors: ${results.errors.length}`);
    
    if (results.errors.length > 0) {
      console.log('\n⚠️  Errors encountered:');
      results.errors.forEach((error, i) => {
        console.log(`   ${i + 1}. ${error}`);
      });
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
    
    // Send comprehensive summary to Discord
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
        checked: 0,  // We're not tracking this currently
        processed: 0
      },
      errors: results.errors
    });
    
    console.log(`\n✅ Daily sync completed at ${endTime.toLocaleTimeString()}\n`);
    
  } catch (error) {
    console.error('\n❌ FATAL ERROR in daily sync:', error);
    if (syncId) {
      await syncTracker.failSync(syncId, error);
    }
    await discordService.sendError('Daily Sync Failed', error.message);
  } finally {
    process.exit(0);
  }
}

// Run the sync
const syncType = process.env.SYNC_TYPE || 'daily';
dailySync(syncType);