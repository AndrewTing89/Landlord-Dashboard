require('dotenv').config();
const db = require('../src/db/connection');

async function checkCurrentLinks() {
  try {
    console.log('Checking current Venmo links in database...\n');
    
    const requests = await db.query(`
      SELECT id, venmo_username, amount, venmo_link, venmo_web_link, bill_type, month, year
      FROM payment_requests
      WHERE status IN ('pending', 'sent')
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    console.log(`Found ${requests.rows.length} pending/sent payment requests:\n`);
    
    for (const req of requests.rows) {
      console.log(`Payment Request #${req.id}:`);
      console.log(`  Bill: ${req.bill_type} - ${req.month}/${req.year}`);
      console.log(`  Amount: $${req.amount}`);
      console.log(`  Username: ${req.venmo_username}`);
      console.log(`  Primary Link (venmo_link):`);
      console.log(`    ${req.venmo_link}`);
      console.log(`  Secondary Link (venmo_web_link):`);
      console.log(`    ${req.venmo_web_link || 'Not set'}`);
      console.log('');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkCurrentLinks();