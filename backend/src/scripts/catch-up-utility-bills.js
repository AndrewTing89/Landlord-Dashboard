#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');
const venmoLinkService = require('../services/venmoLinkService');
const discordService = require('../services/discordService');
const syncTracker = require('../services/syncTracker');

async function catchUpUtilityBills() {
  const startTime = new Date();
  let syncId = null;
  console.log(`\n${'='.repeat(60)}`);
  console.log(`🔄 UTILITY BILLS CATCH-UP - ${startTime.toLocaleString()}`);
  console.log(`${'='.repeat(60)}\n`);
  
  try {
    // Get lookback period from args or default to 90 days
    const lookbackDays = process.argv[2] || 90;
    console.log(`Looking back ${lookbackDays} days for unprocessed utility bills...\n`);
    
    // Start tracking this sync
    syncId = await syncTracker.startSync('catch_up', { lookbackDays });
    
    // Find all utility bills without payment requests
    const unbilledTransactions = await db.query(
      `SELECT t.* FROM transactions t
       WHERE t.expense_type IN ('electricity', 'water')
       AND NOT EXISTS (
         SELECT 1 FROM payment_requests pr 
         WHERE pr.merchant_name = t.merchant_name 
         AND pr.month = EXTRACT(MONTH FROM t.date)
         AND pr.year = EXTRACT(YEAR FROM t.date)
       )
       AND t.date >= CURRENT_DATE - INTERVAL '${lookbackDays} days'
       ORDER BY t.date ASC`
    );
    
    if (unbilledTransactions.rows.length === 0) {
      console.log('✅ All utility bills have payment requests!');
      return;
    }
    
    console.log(`Found ${unbilledTransactions.rows.length} utility bills without payment requests:\n`);
    
    // Show what we're about to process
    unbilledTransactions.rows.forEach(bill => {
      const date = new Date(bill.date);
      const monthName = date.toLocaleString('default', { month: 'short' });
      console.log(`- ${bill.expense_type} from ${monthName} ${date.getDate()}, ${date.getFullYear()} - ${bill.merchant_name || bill.name} - $${bill.amount}`);
    });
    
    console.log('\nPress Ctrl+C to cancel, or wait 5 seconds to create payment requests...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    let created = 0;
    
    for (const bill of unbilledTransactions.rows) {
      console.log(`\n💡 Processing ${bill.expense_type} bill from ${bill.date}`);
      
      // Calculate split amount
      const totalAmount = parseFloat(bill.amount);
      const splitAmount = (totalAmount / 3).toFixed(2);
      
      // Create payment request
      const paymentRequest = await db.insert('payment_requests', {
        bill_type: bill.expense_type,
        merchant_name: bill.merchant_name || bill.name,
        amount: splitAmount,
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
      
      console.log(`   ✅ Created payment request ID ${paymentRequest.id}`);
      created++;
      
      // Optional: Send Discord notification (you might want to skip this for old bills)
      const sendNotification = process.argv[3] === '--notify';
      if (sendNotification) {
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
          
          console.log(`   ✅ Discord notification sent`);
        } catch (error) {
          console.error(`   ❌ Failed to send Discord notification:`, error.message);
        }
      }
    }
    
    const endTime = new Date();
    const duration = Math.round((endTime - startTime) / 1000);
    
    console.log(`\n${'='.repeat(60)}`);
    console.log('📊 CATCH-UP SUMMARY');
    console.log(`${'='.repeat(60)}`);
    console.log(`⏱️  Duration: ${duration} seconds`);
    console.log(`💡 Payment requests created: ${created}`);
    console.log(`\n✅ Catch-up completed successfully!`);
    
    // Complete sync tracking
    if (syncId) {
      await syncTracker.completeSync(syncId, {
        transactions: 0,
        bills: unbilledTransactions.rows.length,
        paymentRequests: created,
        pendingReview: 0,
        errors: []
      });
    }
    
  } catch (error) {
    console.error('Error during catch-up:', error);
    if (syncId) {
      await syncTracker.failSync(syncId, error);
    }
  } finally {
    await db.close();
  }
}

// Usage instructions
if (process.argv.includes('--help')) {
  console.log(`
Usage: node catch-up-utility-bills.js [days] [--notify]

Arguments:
  days      Number of days to look back (default: 90)
  --notify  Send Discord notifications for created payment requests

Examples:
  node catch-up-utility-bills.js          # Look back 90 days, no notifications
  node catch-up-utility-bills.js 180      # Look back 180 days
  node catch-up-utility-bills.js 60 --notify  # Look back 60 days and send notifications
`);
  process.exit(0);
}

catchUpUtilityBills();