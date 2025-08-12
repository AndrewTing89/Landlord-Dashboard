const db = require('../src/db/connection');
const { extractTrackingId } = require('../src/utils/trackingId');
const venmoMatchingService = require('../src/services/venmoMatchingService');

async function fixVenmoEmailAndMatch() {
  try {
    console.log('🔧 Fixing Venmo email tracking ID and re-attempting match...');
    
    // Get the Venmo email for $173.40
    const email = await db.getOne(
      'SELECT * FROM venmo_emails WHERE venmo_amount = 173.40 ORDER BY received_date DESC LIMIT 1'
    );
    
    if (!email) {
      console.log('❌ No Venmo email found for $173.40');
      return;
    }
    
    console.log('📧 Found email:', {
      id: email.id,
      subject: email.subject,
      actor: email.venmo_actor,
      amount: email.venmo_amount,
      snippet: email.body_snippet?.substring(0, 100)
    });
    
    // Extract tracking ID from the snippet
    const trackingId = extractTrackingId(email.body_snippet);
    console.log('🏷️ Extracted tracking ID:', trackingId);
    
    // Update the email with tracking ID and note
    if (trackingId) {
      await db.query(
        'UPDATE venmo_emails SET tracking_id = $1, venmo_note = $2 WHERE id = $3',
        [trackingId, email.body_snippet, email.id]
      );
      console.log('✅ Updated email with tracking ID');
      
      // Get updated email
      const updatedEmail = await db.getOne('SELECT * FROM venmo_emails WHERE id = $1', [email.id]);
      
      // Try to match again
      console.log('\n🔄 Re-attempting match with tracking ID...');
      const matchResult = await venmoMatchingService.matchPaymentEmail(updatedEmail);
      console.log('Match result:', matchResult);
      
      if (matchResult.matched) {
        console.log('✅ Successfully matched payment!');
      } else {
        console.log('⚠️ Still could not auto-match. You may need to manually match in the UI.');
        console.log('   Reason:', matchResult.reason);
        if (matchResult.best_confidence) {
          console.log('   Best confidence:', (matchResult.best_confidence * 100).toFixed(1) + '%');
        }
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixVenmoEmailAndMatch();