const db = require('../src/db/connection');

async function addTrackingId() {
  try {
    console.log('Adding tracking_id columns to payment tables...\n');
    
    // Add tracking_id to payment_requests
    await db.query(`
      ALTER TABLE payment_requests 
      ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(20) UNIQUE
    `);
    console.log('✅ Added tracking_id to payment_requests');
    
    // Add tracking_id to venmo_emails
    await db.query(`
      ALTER TABLE venmo_emails 
      ADD COLUMN IF NOT EXISTS tracking_id VARCHAR(20)
    `);
    console.log('✅ Added tracking_id to venmo_emails');
    
    // Add index for faster lookups
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_payment_requests_tracking_id 
      ON payment_requests(tracking_id)
    `);
    console.log('✅ Created index on payment_requests.tracking_id');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_venmo_emails_tracking_id 
      ON venmo_emails(tracking_id)
    `);
    console.log('✅ Created index on venmo_emails.tracking_id');
    
    console.log('\n✨ Database migration complete!');
    
    await db.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

addTrackingId();