const db = require('../db/connection');

async function checkPaymentRequests() {
  try {
    console.log('Checking all payment requests...\n');
    
    // Get all payment requests
    const requests = await db.query(
      `SELECT id, roommate_name, amount, bill_type, month, year, status, utility_bill_id
       FROM payment_requests 
       ORDER BY created_at DESC
       LIMIT 10`
    );
    
    console.log(`Found ${requests.rows.length} payment requests (showing first 10):\n`);
    
    requests.rows.forEach(req => {
      console.log(`ID: ${req.id}`);
      console.log(`  Roommate: ${req.roommate_name}`);
      console.log(`  Amount: $${req.amount}`);
      console.log(`  Type: ${req.bill_type}`);
      console.log(`  Month/Year: ${req.month}/${req.year}`);
      console.log(`  Status: ${req.status}`);
      console.log(`  Utility Bill ID: ${req.utility_bill_id || 'NULL'}`);
      console.log('---');
    });
    
    // Check for any without utility_bill_id (likely dummy data)
    const withoutBillId = await db.query(
      'SELECT * FROM payment_requests WHERE utility_bill_id IS NULL'
    );
    
    if (withoutBillId.rows.length > 0) {
      console.log(`\nFound ${withoutBillId.rows.length} payment requests without utility_bill_id (likely dummy data):`);
      withoutBillId.rows.forEach(req => {
        console.log(`- ID ${req.id}: ${req.roommate_name} - $${req.amount} (${req.bill_type})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkPaymentRequests();