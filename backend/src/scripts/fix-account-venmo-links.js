const db = require('../db/connection');

async function fixAccountVenmoLinks() {
  try {
    console.log('Checking for links with account.venmo.com...\n');
    
    // Find links with account.venmo.com
    const badLinks = await db.query(
      `SELECT id, bill_type, venmo_link 
       FROM payment_requests 
       WHERE venmo_link LIKE '%account.venmo.com%'`
    );
    
    console.log(`Found ${badLinks.rows.length} links with account.venmo.com`);
    
    if (badLinks.rows.length > 0) {
      console.log('\nFixing these links...');
      
      // Update all links to remove "account."
      const result = await db.query(
        `UPDATE payment_requests 
         SET venmo_link = REPLACE(venmo_link, 'account.venmo.com', 'venmo.com')
         WHERE venmo_link LIKE '%account.venmo.com%'`
      );
      
      console.log(`\nUpdated ${result.rowCount} payment requests`);
      
      // Show the fixed links
      const fixed = await db.query(
        `SELECT id, bill_type, venmo_link 
         FROM payment_requests 
         WHERE id IN (${badLinks.rows.map(r => r.id).join(',')})`
      );
      
      console.log('\nFixed links:');
      fixed.rows.forEach(row => {
        console.log(`  ID ${row.id}: ${row.venmo_link.substring(0, 60)}...`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAccountVenmoLinks();