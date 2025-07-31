const db = require('../db/connection');

async function traceDiscordLink() {
  console.log('🔍 TRACING DISCORD LINK ISSUE\n');
  
  // 1. Find the July 2025 water bill payment request
  const julyWater = await db.query(
    `SELECT * FROM payment_requests 
     WHERE bill_type = 'water' 
     AND month = 7 
     AND year = 2025 
     AND amount = 173.40`
  );
  
  if (julyWater.rows.length > 0) {
    const request = julyWater.rows[0];
    console.log('Found July 2025 Water Bill:');
    console.log(`  ID: ${request.id}`);
    console.log(`  Status: ${request.status}`);
    console.log(`  Venmo Username: ${request.venmo_username}`);
    console.log(`  Venmo Link in DB: ${request.venmo_link}`);
    console.log('');
    
    // Check if the DB link has the old format
    if (request.venmo_link.includes('@roommate1-venmo')) {
      console.log('❌ DATABASE STILL HAS OLD LINK WITH @roommate1-venmo');
      console.log('   This specific record was not updated!');
    }
    
    if (request.venmo_link.includes('account.venmo.com')) {
      console.log('❌ DATABASE STILL HAS account.venmo.com');
    }
  } else {
    console.log('❌ Could not find July 2025 water bill for $173.40');
    
    // Show all water bills
    const allWater = await db.query(
      `SELECT id, month, year, amount, status, venmo_username, 
              LEFT(venmo_link, 80) as link_preview
       FROM payment_requests 
       WHERE bill_type = 'water'
       ORDER BY year DESC, month DESC`
    );
    
    console.log('\nAll water bills:');
    allWater.rows.forEach(row => {
      console.log(`\nID ${row.id}: ${row.month}/${row.year} - $${row.amount} (${row.status})`);
      console.log(`  Username: ${row.venmo_username}`);
      console.log(`  Link: ${row.link_preview}...`);
    });
  }
  
  process.exit(0);
}

traceDiscordLink().catch(console.error);