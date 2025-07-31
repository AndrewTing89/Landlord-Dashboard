const db = require('../db/connection');

async function fixAllVenmoLinksFinal() {
  try {
    console.log('🔧 FIXING ALL VENMO LINKS (INCLUDING SENT ONES)\n');
    
    // First, show what we're fixing
    const oldLinks = await db.query(
      `SELECT COUNT(*) as count, status
       FROM payment_requests 
       WHERE (venmo_link LIKE '%@roommate1-venmo%' 
              OR venmo_link LIKE '%account.venmo.com%'
              OR venmo_username != '@UshiLo')
       GROUP BY status`
    );
    
    console.log('Links that need fixing:');
    oldLinks.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count} requests`);
    });
    
    // Update ALL payment requests (not just pending)
    console.log('\nUpdating ALL payment requests...');
    
    const result = await db.query(
      `UPDATE payment_requests 
       SET venmo_username = '@UshiLo',
           venmo_link = 
             CASE 
               -- If it has the old format, rebuild it completely
               WHEN venmo_link LIKE '%@roommate1-venmo%' OR venmo_link LIKE '%andrewhting%' THEN
                 'https://venmo.com/u/UshiLo' || 
                 SUBSTRING(venmo_link FROM POSITION('?' IN venmo_link))
               -- If it has account.venmo.com, fix it
               WHEN venmo_link LIKE '%account.venmo.com%' THEN
                 REGEXP_REPLACE(venmo_link, 'https://account\.venmo\.com/@?[^?]*', 'https://venmo.com/u/UshiLo')
               -- Otherwise ensure it uses /u/ format
               ELSE
                 REGEXP_REPLACE(venmo_link, 'https://venmo\.com/@?[^?]*', 'https://venmo.com/u/UshiLo')
             END
       WHERE venmo_link NOT LIKE '%venmo.com/u/UshiLo%'`
    );
    
    console.log(`\n✅ Updated ${result.rowCount} payment requests`);
    
    // Verify the July 2025 water bill specifically
    const julyWater = await db.getOne(
      `SELECT id, status, venmo_username, venmo_link
       FROM payment_requests 
       WHERE bill_type = 'water' AND month = 7 AND year = 2025 AND amount = 173.40`
    );
    
    if (julyWater) {
      console.log('\n📌 July 2025 Water Bill (ID ' + julyWater.id + '):');
      console.log(`   Status: ${julyWater.status}`);
      console.log(`   Username: ${julyWater.venmo_username}`);
      console.log(`   Link: ${julyWater.venmo_link}`);
    }
    
    // Show a few samples
    const samples = await db.query(
      `SELECT id, bill_type, status, 
              month || '/' || year as period,
              LEFT(venmo_link, 50) as link_preview
       FROM payment_requests 
       ORDER BY id DESC 
       LIMIT 5`
    );
    
    console.log('\nSample updated links:');
    samples.rows.forEach(row => {
      console.log(`\nID ${row.id} - ${row.bill_type} ${row.period} (${row.status}):`);
      console.log(`  ${row.link_preview}...`);
    });
    
    console.log('\n✅ ALL links now use: https://venmo.com/u/UshiLo');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAllVenmoLinksFinal();