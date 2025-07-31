const db = require('../db/connection');

async function deleteDummyPayment() {
  try {
    console.log('Looking for dummy payment request...');
    
    // Find the dummy payment request
    const dummyRequest = await db.getOne(
      "SELECT * FROM payment_requests WHERE roommate_name = 'Jane Doe'"
    );
    
    if (!dummyRequest) {
      console.log('No dummy payment request found');
      process.exit(0);
    }
    
    console.log('Found dummy payment request:', {
      id: dummyRequest.id,
      roommate_name: dummyRequest.roommate_name,
      amount: dummyRequest.amount,
      bill_type: dummyRequest.bill_type
    });
    
    // Delete related venmo_payment_request if exists
    if (dummyRequest.venmo_request_id) {
      await db.query(
        'DELETE FROM venmo_payment_requests WHERE id = $1',
        [dummyRequest.venmo_request_id]
      );
      console.log('Deleted related venmo_payment_request');
    }
    
    // Delete the payment request
    await db.query(
      'DELETE FROM payment_requests WHERE id = $1',
      [dummyRequest.id]
    );
    
    console.log('✅ Successfully deleted dummy payment request');
    
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

deleteDummyPayment();