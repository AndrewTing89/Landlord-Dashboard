#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function updateVenmoLinks() {
  try {
    console.log('🔧 Updating Venmo links to include payment dates...\n');
    
    // Get all payment requests with charge_date for 2025
    const paymentRequests = await db.query(
      `SELECT id, bill_type, month, year, amount, total_amount, 
              roommate_name, venmo_username, tracking_id, charge_date, venmo_link
       FROM payment_requests 
       WHERE year = 2025 
       AND status != 'paid'
       AND charge_date IS NOT NULL
       ORDER BY year DESC, month DESC`
    );
    
    console.log(`Found ${paymentRequests.rows.length} payment requests to update\n`);
    
    let updated = 0;
    
    for (const pr of paymentRequests.rows) {
      const type = pr.bill_type;
      const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
      const amount = pr.amount;
      const totalAmount = pr.total_amount || (amount * 3).toFixed(2);
      const trackingId = pr.tracking_id;
      const year = pr.year;
      
      let note;
      
      if (type === 'rent') {
        // For rent, simpler format
        note = `${trackingId} - Rent for ${year}-${trackingId.split('-')[1]}`;
      } else {
        // For utilities: include the payment date
        const billDate = new Date(pr.charge_date);
        const paymentDateStr = ` on ${billDate.getMonth() + 1}/${billDate.getDate()}/${billDate.getFullYear()}`;
        
        note = `${trackingId} - ${typeCapitalized} bill for ${year}-${trackingId.split('-')[1]}: Total $${totalAmount}, your share is $${amount} (1/3). I paid the full amount${paymentDateStr}.`;
      }
      
      // URL encode the note
      const encodedNote = encodeURIComponent(note);
      
      // Remove @ symbol and spaces if present in username
      const cleanUsername = pr.venmo_username.replace('@', '').replace(/\s+/g, '');
      
      // Generate the new Venmo link
      const newVenmoLink = `https://account.venmo.com/pay?amount=${amount}&note=${encodedNote}&recipients=${cleanUsername}&txn=charge`;
      
      // Update the payment request with new Venmo link
      await db.query(
        'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
        [newVenmoLink, pr.id]
      );
      
      console.log(`✅ Updated PR ${pr.id} (${pr.roommate_name} - ${pr.bill_type} ${pr.month}/${pr.year})`);
      
      // Show the old vs new note for comparison
      if (pr.venmo_link) {
        try {
          const oldNoteMatch = pr.venmo_link.match(/note=([^&]*)/);
          if (oldNoteMatch) {
            const oldNote = decodeURIComponent(oldNoteMatch[1]);
            console.log(`   Old: "${oldNote.substring(0, 80)}..."`);
          }
        } catch (e) {
          // Ignore decoding errors
        }
      }
      console.log(`   New: "${note.substring(0, 80)}..."`);
      console.log('');
      
      updated++;
    }
    
    console.log(`\n📊 Summary:`);
    console.log(`  - Updated ${updated} Venmo links with payment dates`);
    
    // Show a sample of the updated links
    const sample = await db.query(
      `SELECT bill_type, month, year, charge_date, venmo_link, roommate_name
       FROM payment_requests 
       WHERE year = 2025 
       AND month = 8
       AND bill_type = 'electricity'
       LIMIT 1`
    );
    
    if (sample.rows[0]) {
      const s = sample.rows[0];
      console.log(`\n📝 Sample updated Venmo link (August Electricity):`);
      const noteMatch = s.venmo_link.match(/note=([^&]*)/);
      if (noteMatch) {
        const decodedNote = decodeURIComponent(noteMatch[1]);
        console.log(`   ${decodedNote}`);
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

updateVenmoLinks();