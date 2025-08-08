require('dotenv').config();
const db = require('../src/db/connection');
const venmoLinkService = require('../src/services/venmoLinkService');

async function fixExistingVenmoLinks() {
  try {
    console.log('Fixing existing Venmo links in payment_requests table...\n');
    
    // Get all payment requests that need link updates
    const requests = await db.query(`
      SELECT id, venmo_username, amount, total_amount, bill_type, month, year, tracking_id
      FROM payment_requests
      WHERE status IN ('pending', 'sent')
      ORDER BY created_at DESC
    `);
    
    console.log(`Found ${requests.rows.length} payment requests to update\n`);
    
    for (const request of requests.rows) {
      // Generate the note based on bill type
      const formattedDate = new Date(request.year, request.month - 1).toLocaleDateString('en-US', { 
        month: 'short', 
        year: 'numeric' 
      });
      
      // Use the new key:value format with newlines for cleaner URLs
      const totalAmount = parseFloat(request.total_amount || request.amount * 3);
      const splitAmount = parseFloat(request.amount);
      const cleanDate = formattedDate.replace(/\s+/g, '_'); // Replace spaces with underscores in date
      
      let note = '';
      if (request.bill_type === 'electricity') {
        note = `PG&E\nTotal:$${totalAmount.toFixed(2)}\nYour_share(1/3):$${splitAmount.toFixed(2)}\nPaid:${cleanDate}`;
      } else if (request.bill_type === 'water') {
        note = `Great_Oaks_Water\nTotal:$${totalAmount.toFixed(2)}\nYour_share(1/3):$${splitAmount.toFixed(2)}\nPaid:${cleanDate}`;
      } else {
        note = `Payment_Request\nAmount:$${splitAmount.toFixed(2)}\nDate:${cleanDate}`;
      }
      
      // Add tracking ID on a new line if present
      if (request.tracking_id) {
        note += `\nID:${request.tracking_id}`;
      }
      
      // Generate simple link
      const venmoLink = venmoLinkService.generateVenmoLink(
        request.venmo_username,
        parseFloat(request.amount),
        note
      );
      
      // Update the payment request with new link
      await db.query(`
        UPDATE payment_requests
        SET venmo_link = $1,
            venmo_web_link = NULL,
            updated_at = NOW()
        WHERE id = $2
      `, [venmoLink, request.id]);
      
      console.log(`✅ Updated payment request #${request.id}:`);
      console.log(`   Bill: ${request.bill_type || 'N/A'} - ${formattedDate}`);
      console.log(`   Amount: $${parseFloat(request.amount).toFixed(2)}`);
      console.log(`   Link: ${venmoLink.substring(0, 80)}...\n`);
    }
    
    console.log('✅ All Venmo links have been updated successfully!');
    
  } catch (error) {
    console.error('Error fixing Venmo links:', error);
  } finally {
    process.exit();
  }
}

fixExistingVenmoLinks();