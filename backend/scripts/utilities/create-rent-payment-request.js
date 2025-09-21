#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');
const venmoLinkService = require('../src/services/venmoLinkService');
const { generateTrackingId } = require('../src/utils/trackingId');

/**
 * Creates a rent payment request for a specific month/year
 * This replaces the old system of adding rent directly to transactions
 */
async function createRentPaymentRequest(year, month, amount = 1685) {
  try {
    // Ensure amount is a number
    amount = parseFloat(amount);
    // Check if a rent payment request already exists for this month
    const existing = await db.getOne(
      `SELECT id, status, amount FROM payment_requests 
       WHERE bill_type = 'rent' 
       AND year = $1 
       AND month = $2`,
      [year, month]
    );
    
    if (existing) {
      console.log(`   ℹ️  Rent payment request already exists for ${month}/${year} (Status: ${existing.status})`);
      return { 
        success: false, 
        message: `Rent request already exists for ${month}/${year}`,
        exists: true,
        request: existing
      };
    }
    
    // Generate tracking ID for this rent request
    const trackingId = generateTrackingId(month, year, 'rent');
    
    // Create the payment note
    const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { 
      month: 'long', 
      year: 'numeric' 
    });
    
    const note = `Rent\nMonth:${monthName}\nAmount:$${amount.toFixed(2)}\nID:${trackingId}`;
    
    // Generate Venmo link
    const venmoLink = venmoLinkService.generateVenmoLink(
      process.env.ROOMMATE_VENMO_USERNAME || '@UshiLo',
      amount,
      note
    );
    
    // Create payment request record
    const paymentRequest = await db.insert('payment_requests', {
      utility_bill_id: null, // Rent doesn't have a utility bill
      roommate_name: process.env.ROOMMATE_NAME || 'Ushi Lo',
      venmo_username: process.env.ROOMMATE_VENMO_USERNAME || '@UshiLo',
      amount: amount.toFixed(2),
      total_amount: amount.toFixed(2), // For rent, total = amount (no splitting)
      bill_type: 'rent',
      status: 'pending',
      request_date: new Date(),
      charge_date: new Date(year, month - 1, 1), // 1st of the month
      month: month,
      year: year,
      tracking_id: trackingId,
      venmo_link: venmoLink
    });
    
    console.log(`   ✅ Created rent payment request for ${monthName}`);
    console.log(`      Amount: $${amount}`);
    console.log(`      Tracking ID: ${trackingId}`);
    console.log(`      Request ID: ${paymentRequest.id}`);
    
    return {
      success: true,
      message: `Created rent payment request for ${monthName}`,
      request: paymentRequest
    };
    
  } catch (error) {
    console.error('   ❌ Error creating rent payment request:', error);
    return {
      success: false,
      message: error.message,
      error: error
    };
  }
}

/**
 * Check and create rent payment requests for current/past months
 */
async function processRentPaymentRequests() {
  console.log('🏠 Processing Rent Payment Requests\n');
  
  const currentDate = new Date();
  const currentYear = currentDate.getFullYear();
  const currentMonth = currentDate.getMonth() + 1;
  const rentAmount = parseFloat(process.env.MONTHLY_RENT || 1685);
  
  let created = 0;
  let skipped = 0;
  
  try {
    // Only process for 2025 onwards
    if (currentYear >= 2025) {
      const startYear = 2025;
      
      // Process all months from start of 2025 to current month
      for (let year = startYear; year <= currentYear; year++) {
        const startMonth = (year === startYear) ? 1 : 1;
        const endMonth = (year === currentYear) ? currentMonth : 12;
        
        for (let month = startMonth; month <= endMonth; month++) {
          // Only create if we're on or after the 1st of the month
          const rentDate = new Date(year, month - 1, 1);
          if (currentDate >= rentDate) {
            const result = await createRentPaymentRequest(year, month, rentAmount);
            
            if (result.success) {
              created++;
            } else if (result.exists) {
              skipped++;
            }
          }
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`   Created: ${created} new rent payment requests`);
    console.log(`   Skipped: ${skipped} existing requests`);
    
    // Clean up old manual rent transactions if requested
    if (process.argv.includes('--cleanup')) {
      console.log('\n🧹 Cleaning up old manual rent transactions...');
      
      const deleted = await db.query(
        `DELETE FROM expenses 
         WHERE expense_type = 'rent' 
         AND simplefin_transaction_id LIKE 'rent_%'
         AND date >= '2025-01-01'
         RETURNING id, date, amount`
      );
      
      console.log(`   Deleted ${deleted.rows.length} manual rent transactions`);
      deleted.rows.forEach(tx => {
        console.log(`      - ${tx.date}: $${tx.amount}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error processing rent payment requests:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Export for use in other scripts
module.exports = {
  createRentPaymentRequest,
  processRentPaymentRequests
};

// Run if called directly
if (require.main === module) {
  processRentPaymentRequests();
}