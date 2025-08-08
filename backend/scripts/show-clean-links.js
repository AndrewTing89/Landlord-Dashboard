require('dotenv').config();
const db = require('../src/db/connection');

async function showCleanLinks() {
  try {
    const requests = await db.query(`
      SELECT id, venmo_username, amount, total_amount, venmo_link, bill_type, month, year
      FROM payment_requests
      WHERE status IN ('pending', 'sent')
      ORDER BY created_at DESC
    `);
    
    console.log('Current Payment Request Links (Clean Format):\n');
    console.log('================================================================\n');
    
    for (const req of requests.rows) {
      const company = req.bill_type === 'electricity' ? 'PG&E' : 'Great Oaks Water';
      const monthName = new Date(req.year, req.month - 1).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      
      console.log(`${company} ${monthName}`);
      console.log(`Total: $${parseFloat(req.total_amount || req.amount * 3).toFixed(2)}`);
      console.log(`Pay: $${parseFloat(req.amount).toFixed(2)}`);
      console.log(req.venmo_link);
      
      // Show what the note looks like when decoded
      const noteParam = req.venmo_link.split('note=')[1];
      if (noteParam) {
        const decoded = decodeURIComponent(noteParam);
        console.log('\nNote preview (what Venmo will show):');
        console.log('─'.repeat(40));
        console.log(decoded);
      }
      
      console.log('\n' + '='.repeat(60) + '\n');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

showCleanLinks();