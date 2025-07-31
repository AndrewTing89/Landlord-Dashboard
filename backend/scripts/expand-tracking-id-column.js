const db = require('../src/db/connection');

async function expandTrackingIdColumn() {
  try {
    console.log('📏 Expanding tracking_id column size...\n');
    
    // Expand tracking_id column to 50 characters
    await db.query(`
      ALTER TABLE payment_requests 
      ALTER COLUMN tracking_id TYPE VARCHAR(50)
    `);
    console.log('✅ Expanded payment_requests.tracking_id to VARCHAR(50)');
    
    await db.query(`
      ALTER TABLE venmo_emails 
      ALTER COLUMN tracking_id TYPE VARCHAR(50)
    `);
    console.log('✅ Expanded venmo_emails.tracking_id to VARCHAR(50)');
    
    console.log('\n✨ Column expansion complete!');
    
    await db.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

expandTrackingIdColumn();