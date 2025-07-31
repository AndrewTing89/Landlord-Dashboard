#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');
const discordService = require('../services/discordService');

async function sendAllPendingToDiscord() {
  try {
    console.log('Sending all pending payment requests to Discord...\n');
    
    // Get all pending payment requests
    const pendingRequests = await db.query(
      `SELECT * FROM payment_requests 
       WHERE status = 'pending' 
       ORDER BY year DESC, month DESC`
    );
    
    console.log(`Found ${pendingRequests.rows.length} pending payment requests\n`);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const request of pendingRequests.rows) {
      try {
        // Prepare notification data
        const notificationData = {
          billType: request.bill_type,
          totalAmount: request.total_amount || (parseFloat(request.amount) * 3).toFixed(2),
          splitAmount: request.amount,
          merchantName: request.merchant_name || request.company_name || 
                        (request.bill_type === 'electricity' ? 'PG&E' : 'Great Oaks Water'),
          venmoLink: request.venmo_link,
          dueDate: request.due_date ? new Date(request.due_date).toLocaleDateString() : null,
          month: request.month,
          year: request.year
        };
        
        // Send to Discord
        await discordService.sendPaymentRequest(notificationData);
        
        // Update status to 'sent'
        await db.query(
          'UPDATE payment_requests SET status = $1 WHERE id = $2',
          ['sent', request.id]
        );
        
        console.log(`✅ Sent ${request.bill_type} bill for ${request.month}/${request.year} - $${request.amount}`);
        successCount++;
        
        // Add a small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
        
      } catch (error) {
        console.error(`❌ Failed to send request ${request.id}:`, error.message);
        failCount++;
      }
    }
    
    console.log(`\n✅ Summary:`);
    console.log(`   - Successfully sent: ${successCount}`);
    console.log(`   - Failed: ${failCount}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

// Ask for confirmation before sending
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

rl.question('This will send all pending payment requests to Discord. Continue? (y/n): ', (answer) => {
  if (answer.toLowerCase() === 'y') {
    sendAllPendingToDiscord();
  } else {
    console.log('Cancelled.');
    process.exit(0);
  }
  rl.close();
});