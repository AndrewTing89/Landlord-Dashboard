const db = require('../db/connection');
const moment = require('moment');
const { sendBillSplitNotification } = require('../services/notificationService');
const venmoLinkService = require('../services/venmoLinkService');

/**
 * Lambda handler for processing utility bills and creating payment requests
 * This will be triggered monthly after plaidSync completes
 */
exports.handler = async (event, context) => {
  console.log('Starting bill processing Lambda', { event });
  
  try {
    // Get configuration from environment
    const splitCount = parseInt(process.env.SPLIT_COUNT || '3');
    const roommateVenmo = process.env.ROOMMATE_VENMO_USERNAME;
    const roommateName = process.env.ROOMMATE_NAME;
    const roommatePhone = process.env.ROOMMATE_PHONE;
    const roommateEmail = process.env.ROOMMATE_EMAIL;
    const ownerPhone = process.env.OWNER_PHONE;
    const ownerEmail = process.env.OWNER_EMAIL;
    
    // Determine which month to process (default: previous month)
    const targetDate = event.date ? moment(event.date) : moment().subtract(1, 'month');
    const month = targetDate.month() + 1; // moment months are 0-indexed
    const year = targetDate.year();
    
    console.log(`Processing bills for ${month}/${year}`);
    
    // Get PG&E and Great Oaks Water transactions for the month
    const utilityTransactions = await db.getMany(
      `SELECT * FROM expenses 
       WHERE (
         (merchant_name ILIKE '%pg&e%' OR merchant_name ILIKE '%pacific gas%' OR merchant_name ILIKE '%pge%')
         OR (merchant_name ILIKE '%great oaks%' OR merchant_name ILIKE '%water%')
       )
       AND expense_type IN ('electricity', 'water')
       AND EXTRACT(MONTH FROM date) = $1
       AND EXTRACT(YEAR FROM date) = $2
       ORDER BY expense_type, date`,
      [month, year]
    );
    
    console.log(`Found ${utilityTransactions.length} utility transactions`);
    
    const results = {
      electricity: null,
      water: null,
      paymentRequests: [],
      notifications: []
    };
    
    // Process each utility transaction
    for (const transaction of utilityTransactions) {
      // Determine bill type based on merchant name
      let billType;
      if (transaction.merchant_name.toLowerCase().includes('pg&e') || 
          transaction.merchant_name.toLowerCase().includes('pacific gas') ||
          transaction.merchant_name.toLowerCase().includes('pge')) {
        billType = 'electricity';
      } else if (transaction.merchant_name.toLowerCase().includes('great oaks') || 
                 transaction.merchant_name.toLowerCase().includes('water')) {
        billType = 'water';
      } else {
        console.log(`Skipping unrecognized merchant: ${transaction.merchant_name}`);
        continue;
      }
      
      // Check if bill already processed
      const existingBill = await db.getOne(
        'SELECT * FROM utility_bills WHERE transaction_id = $1',
        [transaction.id]
      );
      
      if (existingBill) {
        console.log(`Bill already processed for transaction ${transaction.id}`);
        continue;
      }
      
      // Calculate split amount
      const splitAmount = parseFloat((transaction.amount / splitCount).toFixed(2));
      
      // Create utility bill record
      const bill = await db.insert('utility_bills', {
        transaction_id: transaction.id,
        bill_type: billType,
        total_amount: transaction.amount,
        split_amount: splitAmount,
        month: month,
        year: year,
        payment_requested: true
      });
      
      results[billType] = bill;
      
      // Calculate due date (typically 15 days from now)
      const dueDate = moment().add(15, 'days');
      const dueDateFormatted = dueDate.format('MM/DD/YYYY');
      
      // Create payment request using the new service
      // This will also send SMS notification to landlord
      const requestResult = await venmoLinkService.createPaymentRequestsForBill(
        bill,
        [transaction]
      );
      
      if (requestResult) {
        results.paymentRequests.push({
          ...requestResult.paymentRequest,
          bill_type: billType,
          total_amount: transaction.amount
        });
      }
      
      // Send notifications to roommate
      if (roommatePhone || roommateEmail) {
        const notificationResult = await sendBillSplitNotification({
          billType: billType,
          totalAmount: parseFloat(transaction.amount).toFixed(2),
          splitAmount: splitAmount.toFixed(2),
          dueDate: dueDateFormatted,
          venmoLink: venmoLink,
          recipientPhone: roommatePhone,
          recipientEmail: roommateEmail,
          recipientName: roommateName,
          month: month,
          year: year
        });
        
        results.notifications.push({
          recipient: roommateName,
          billType: billType,
          status: notificationResult
        });
      }
      
      // Send notification to owner
      if (ownerPhone || ownerEmail) {
        const ownerVenmoLink = `https://venmo.com/u/${roommateVenmo}`;
        const ownerNotificationResult = await sendBillSplitNotification({
          billType: billType,
          totalAmount: parseFloat(transaction.amount).toFixed(2),
          splitAmount: splitAmount.toFixed(2),
          dueDate: dueDateFormatted,
          venmoLink: ownerVenmoLink,
          recipientPhone: ownerPhone,
          recipientEmail: ownerEmail,
          recipientName: 'Owner',
          month: month,
          year: year
        });
        
        results.notifications.push({
          recipient: 'Owner',
          billType: billType,
          status: ownerNotificationResult
        });
      }
    }
    
    // Log job run
    await db.insert('job_runs', {
      job_name: 'process_bills',
      run_date: new Date(),
      status: 'success',
      details: {
        month: month,
        year: year,
        bills_processed: results.paymentRequests.length,
        total_amount: results.paymentRequests.reduce((sum, pr) => sum + parseFloat(pr.amount), 0),
        notifications_sent: results.notifications.length
      }
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `Processed ${results.paymentRequests.length} payment requests, sent ${results.notifications.length} notifications`,
        results: results
      })
    };
    
  } catch (error) {
    console.error('Bill processing error:', error);
    
    await db.insert('job_runs', {
      job_name: 'process_bills',
      run_date: new Date(),
      status: 'failed',
      details: { error: error.message }
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};

// Generate Venmo deep link with detailed message
function generateVenmoLink(username, amount, billType, month, year, splitCount, totalAmount, merchantName, dueDate) {
  const monthName = moment(`${year}-${month}-01`).format('MMMM');
  const note = `${monthName} ${year} ${merchantName} bill - Total: $${totalAmount}, Your portion (1/${splitCount}): $${amount}. Due: ${dueDate}`;
  const encodedNote = encodeURIComponent(note);
  
  // Venmo deep link format for mobile
  return `venmo://paycharge?txn=charge&recipients=${username}&amount=${amount}&note=${encodedNote}`;
}