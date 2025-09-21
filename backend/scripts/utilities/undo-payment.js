#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function undoPayment(paymentRequestId) {
  const client = db;
  
  try {
    await client.query('BEGIN');
    
    // 1. Get the payment request details
    const paymentRequest = await client.getOne(
      'SELECT * FROM payment_requests WHERE id = $1',
      [paymentRequestId]
    );
    
    if (!paymentRequest) {
      throw new Error(`Payment request #${paymentRequestId} not found`);
    }
    
    console.log(`\n🔄 Undoing payment for request #${paymentRequestId}`);
    console.log(`   Type: ${paymentRequest.bill_type}`);
    console.log(`   Amount: $${paymentRequest.amount}`);
    console.log(`   Status: ${paymentRequest.status}`);
    
    // 2. Reset payment request status back to pending
    await client.query(
      `UPDATE payment_requests 
       SET status = 'pending',
           paid_date = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [paymentRequestId]
    );
    
    // 3. Unlink any venmo emails
    const emailResult = await client.query(
      `UPDATE venmo_emails 
       SET payment_request_id = NULL,
           matched = false
       WHERE payment_request_id = $1
       RETURNING id`,
      [paymentRequestId]
    );
    
    if (emailResult.rows.length > 0) {
      console.log(`   ✅ Unlinked ${emailResult.rows.length} Venmo email(s)`);
    }
    
    // 4. Delete any utility adjustment/recuperation transactions
    if (paymentRequest.bill_type !== 'rent') {
      const adjustmentResult = await client.query(
        `DELETE FROM utility_adjustments 
         WHERE payment_request_id = $1
         RETURNING transaction_id`,
        [paymentRequestId]
      );
      
      if (adjustmentResult.rows.length > 0) {
        // Delete the associated recuperation transactions
        const transactionIds = adjustmentResult.rows.map(r => r.transaction_id);
        const txResult = await client.query(
          `DELETE FROM expenses 
           WHERE id = ANY($1::int[])
           RETURNING id`,
          [transactionIds]
        );
        
        console.log(`   ✅ Removed ${txResult.rows.length} recuperation transaction(s)`);
      }
    }
    
    await client.query('COMMIT');
    
    console.log(`\n✅ Successfully undid payment for request #${paymentRequestId}`);
    console.log('   Status changed: paid → pending');
    console.log('   Payment can now be reprocessed\n');
    
    return { success: true };
    
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error:', error.message);
    return { success: false, error: error.message };
  }
}

// Handle command line arguments
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('Usage: node undo-payment.js <payment_request_id>');
    console.log('Example: node undo-payment.js 123');
    process.exit(1);
  }
  
  const paymentRequestId = parseInt(args[0]);
  
  if (isNaN(paymentRequestId)) {
    console.error('Error: Payment request ID must be a number');
    process.exit(1);
  }
  
  await undoPayment(paymentRequestId);
  process.exit(0);
}

if (require.main === module) {
  main();
}

module.exports = { undoPayment };