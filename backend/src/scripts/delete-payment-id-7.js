const db = require('../db/connection');

async function deletePaymentId7() {
  try {
    console.log('Deleting payment request ID 7...');
    
    // Get the payment request details first
    const paymentRequest = await db.getOne(
      'SELECT * FROM payment_requests WHERE id = 7'
    );
    
    if (!paymentRequest) {
      console.log('Payment request ID 7 not found');
      process.exit(0);
    }
    
    console.log('Found payment request to delete:', {
      id: paymentRequest.id,
      roommate_name: paymentRequest.roommate_name,
      amount: paymentRequest.amount,
      bill_type: paymentRequest.bill_type,
      month: paymentRequest.month,
      year: paymentRequest.year,
      status: paymentRequest.status
    });
    
    // Delete the payment request first (this will clear the foreign key reference)
    await db.query(
      'DELETE FROM payment_requests WHERE id = $1',
      [7]
    );
    console.log('Deleted payment request');
    
    // Delete related venmo_payment_request if exists
    if (paymentRequest.venmo_request_id) {
      await db.query(
        'DELETE FROM venmo_payment_requests WHERE id = $1',
        [paymentRequest.venmo_request_id]
      );
      console.log('Deleted related venmo_payment_request');
    }
    
    console.log('✅ Successfully deleted payment request ID 7');
    
    // Verify deletion
    const count = await db.getOne(
      'SELECT COUNT(*) as count FROM payment_requests'
    );
    console.log(`Remaining payment requests: ${count.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

deletePaymentId7();