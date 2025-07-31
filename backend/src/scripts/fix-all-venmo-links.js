const db = require('../db/connection');
const venmoLinkService = require('../services/venmoLinkService');

async function fixAllVenmoLinks() {
  try {
    console.log('Fixing ALL Venmo links to use UshiLo...\n');
    
    // Get all pending payment requests
    const requests = await db.query(
      `SELECT id, bill_type, amount, month, year, merchant_name 
       FROM payment_requests 
       WHERE status = 'pending'`
    );
    
    console.log(`Found ${requests.rows.length} pending payment requests to fix\n`);
    
    let updated = 0;
    
    for (const request of requests.rows) {
      // Generate proper note
      const billTypeName = request.bill_type === 'electricity' ? 'PG&E' : 'Water';
      const totalAmount = (parseFloat(request.amount) * 3).toFixed(2);
      const monthYear = `${new Date(request.year, request.month - 1).toLocaleString('default', { month: 'short' })} ${request.year}`;
      
      const note = `${billTypeName} bill for ${monthYear}: Total $${totalAmount}, your share is $${request.amount} (1/3). I've already paid the full amount.`;
      
      // Generate new Venmo link with UshiLo
      const newVenmoLink = venmoLinkService.generateVenmoLink(
        '@UshiLo',
        parseFloat(request.amount),
        note
      );
      
      // Update the record
      await db.query(
        `UPDATE payment_requests 
         SET venmo_username = '@UshiLo',
             venmo_link = $1
         WHERE id = $2`,
        [newVenmoLink, request.id]
      );
      
      console.log(`✓ Fixed ID ${request.id}: ${billTypeName} ${monthYear} - $${request.amount}`);
      updated++;
    }
    
    console.log(`\n✅ Successfully updated ${updated} payment requests`);
    console.log('\nAll links now point to: https://venmo.com/UshiLo');
    console.log('(No @ symbol in URL, no account.venmo.com)');
    
    // Show a sample
    const sample = await db.query(
      `SELECT id, venmo_link 
       FROM payment_requests 
       WHERE status = 'pending' 
       LIMIT 1`
    );
    
    if (sample.rows.length > 0) {
      console.log('\nSample link:');
      console.log(sample.rows[0].venmo_link);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixAllVenmoLinks();