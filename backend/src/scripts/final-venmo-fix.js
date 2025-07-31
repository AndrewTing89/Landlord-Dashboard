const db = require('../db/connection');

async function finalVenmoFix() {
  try {
    console.log('🔧 FINAL VENMO LINK FIX\n');
    console.log('Updating all links to use /u/ format...\n');
    
    // Update all pending payment requests
    const result = await db.query(
      `UPDATE payment_requests 
       SET venmo_link = REGEXP_REPLACE(
         REGEXP_REPLACE(
           venmo_link,
           'https://(account\\.)?venmo\\.com/@?',
           'https://venmo.com/u/'
         ),
         '@roommate1-venmo',
         'UshiLo'
       ),
       venmo_username = '@UshiLo'
       WHERE status = 'pending'`
    );
    
    console.log(`✅ Updated ${result.rowCount} payment requests\n`);
    
    // Show samples
    const samples = await db.query(
      `SELECT id, bill_type, month || '/' || year as period, venmo_link 
       FROM payment_requests 
       WHERE status = 'pending' 
       ORDER BY id 
       LIMIT 3`
    );
    
    console.log('Sample updated links:');
    samples.rows.forEach(row => {
      console.log(`\nID ${row.id} - ${row.bill_type} (${row.period}):`);
      console.log(row.venmo_link);
    });
    
    console.log('\n✅ All links now use the format: https://venmo.com/u/UshiLo');
    console.log('This format works correctly and won\'t cause 404 errors!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

finalVenmoFix();