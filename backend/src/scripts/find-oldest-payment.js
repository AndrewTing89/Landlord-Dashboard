const db = require('../db/connection');

async function findOldestPayment() {
  try {
    console.log('Finding oldest payment request...\n');
    
    // Get the oldest payment request
    const oldest = await db.query(
      `SELECT id, roommate_name, amount, bill_type, month, year, status, 
              utility_bill_id, created_at, request_date
       FROM payment_requests 
       ORDER BY id ASC
       LIMIT 5`
    );
    
    console.log('Oldest payment requests (by ID):\n');
    
    oldest.rows.forEach(req => {
      console.log(`ID: ${req.id}`);
      console.log(`  Roommate: ${req.roommate_name}`);
      console.log(`  Amount: $${req.amount}`);
      console.log(`  Type: ${req.bill_type}`);
      console.log(`  Month/Year: ${req.month}/${req.year}`);
      console.log(`  Status: ${req.status}`);
      console.log(`  Utility Bill ID: ${req.utility_bill_id || 'NULL'}`);
      console.log(`  Created: ${req.created_at}`);
      console.log(`  Request Date: ${req.request_date}`);
      console.log('---');
    });
    
    // Also check if there's one that's already paid (might be the test one)
    const paid = await db.query(
      "SELECT * FROM payment_requests WHERE status = 'paid'"
    );
    
    if (paid.rows.length > 0) {
      console.log(`\nFound ${paid.rows.length} paid payment request(s):`);
      paid.rows.forEach(req => {
        console.log(`- ID ${req.id}: ${req.roommate_name} - $${req.amount} (${req.bill_type}) - Bill ID: ${req.utility_bill_id || 'NULL'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

findOldestPayment();