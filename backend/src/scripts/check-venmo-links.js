const db = require('../db/connection');

async function checkVenmoLinks() {
  try {
    const result = await db.query(
      `SELECT id, bill_type, venmo_username, venmo_link 
       FROM payment_requests 
       WHERE status = 'pending' 
       LIMIT 3`
    );
    
    console.log('Current Venmo links in database:\n');
    result.rows.forEach(row => {
      console.log(`ID ${row.id} (${row.bill_type}):`);
      console.log(`  Username: ${row.venmo_username}`);
      console.log(`  Link: ${row.venmo_link}`);
      console.log('');
    });
    
    // Check if it's the frontend adding "account."
    console.log('The issue might be:');
    console.log('1. Links in DB still have wrong format');
    console.log('2. Frontend is modifying the URL');
    console.log('3. The send-sms endpoint is regenerating with old data');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkVenmoLinks();