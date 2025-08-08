const db = require('../src/db/connection');

async function fixMarchWaterStatus() {
  try {
    console.log('Fixing March 2025 water bill payment request status...\n');

    // Find the March 2025 water payment request
    const result = await db.query(`
      SELECT 
        id,
        roommate_name,
        bill_type,
        amount,
        status,
        month,
        year,
        tracking_id
      FROM payment_requests
      WHERE year = 2025 
        AND month = 3
        AND bill_type = 'water'
    `);

    if (result.rows.length === 0) {
      console.log('No water payment request found for March 2025');
      return;
    }

    const request = result.rows[0];
    console.log('Found payment request:');
    console.log(`  ID: ${request.id}`);
    console.log(`  Roommate: ${request.roommate_name}`);
    console.log(`  Amount: $${request.amount}`);
    console.log(`  Current Status: ${request.status}`);
    console.log(`  Tracking ID: ${request.tracking_id}\n`);

    if (request.status === 'sent') {
      // Check if there's actually a Venmo email confirming this was sent
      const emailCheck = await db.query(`
        SELECT id, email_type, received_date
        FROM venmo_emails
        WHERE payment_request_id = $1
          AND email_type = 'request_sent'
      `, [request.id]);

      if (emailCheck.rows.length === 0) {
        console.log('❌ No Venmo email confirmation found for this request being sent.');
        console.log('✅ Reverting status from "sent" back to "pending"...');
        
        await db.query(
          'UPDATE payment_requests SET status = $1, updated_at = NOW() WHERE id = $2',
          ['pending', request.id]
        );
        
        console.log('Status successfully reverted to pending!');
      } else {
        console.log('✅ Found Venmo email confirmation - status "sent" is correct.');
        console.log(`  Email received: ${emailCheck.rows[0].received_date}`);
      }
    } else {
      console.log(`Status is already "${request.status}" - no changes needed.`);
    }

    // Also check for any other payment requests incorrectly marked as 'sent'
    console.log('\n📋 Checking all payment requests with "sent" status...');
    const allSent = await db.query(`
      SELECT 
        pr.id,
        pr.roommate_name,
        pr.bill_type,
        pr.month,
        pr.year,
        pr.amount,
        pr.status
      FROM payment_requests pr
      WHERE pr.status = 'sent'
      ORDER BY pr.year DESC, pr.month DESC
    `);

    console.log(`Found ${allSent.rows.length} payment requests with "sent" status.\n`);

    for (const pr of allSent.rows) {
      // Check if there's an email confirmation
      const emailConfirm = await db.query(`
        SELECT id 
        FROM venmo_emails
        WHERE payment_request_id = $1
          AND email_type = 'request_sent'
      `, [pr.id]);

      if (emailConfirm.rows.length === 0) {
        console.log(`⚠️  PR #${pr.id}: ${pr.bill_type} (${pr.month}/${pr.year}) - NO email confirmation found`);
        console.log(`   Reverting to "pending"...`);
        
        await db.query(
          'UPDATE payment_requests SET status = $1, updated_at = NOW() WHERE id = $2',
          ['pending', pr.id]
        );
      } else {
        console.log(`✅ PR #${pr.id}: ${pr.bill_type} (${pr.month}/${pr.year}) - Has email confirmation`);
      }
    }

    console.log('\n✅ Status audit complete!');

  } catch (error) {
    console.error('Error fixing status:', error);
  } finally {
    process.exit(0);
  }
}

fixMarchWaterStatus();