const db = require('../db/connection');

async function updateVenmoUsername() {
  try {
    console.log('Updating all payment requests to use new Venmo username...\n');
    
    // Update all payment requests to use the new username
    const result = await db.query(
      `UPDATE payment_requests 
       SET venmo_username = '@UshiLo',
           venmo_link = REPLACE(
             REPLACE(
               REPLACE(venmo_link, '@roommate1-venmo', 'UshiLo'),
               '@andrewhting', 'UshiLo'
             ),
             'venmo.com/@', 'venmo.com/'
           )
       WHERE status = 'pending'`
    );
    
    console.log(`Updated ${result.rowCount} payment requests`);
    
    // Show a sample of updated requests
    const updated = await db.query(
      `SELECT id, bill_type, month, year, venmo_username, 
              LEFT(venmo_link, 50) as venmo_link_preview
       FROM payment_requests 
       WHERE status = 'pending'
       LIMIT 5`
    );
    
    console.log('\nSample of updated requests:');
    updated.rows.forEach(row => {
      console.log(`  ID ${row.id}: ${row.bill_type} (${row.month}/${row.year})`);
      console.log(`    Username: ${row.venmo_username}`);
      console.log(`    Link: ${row.venmo_link_preview}...`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateVenmoUsername();