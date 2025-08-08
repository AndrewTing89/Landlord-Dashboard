const db = require('../src/db/connection');

async function addVenmoWebLink() {
  try {
    console.log('Adding venmo_web_link column to payment_requests table...');
    
    // Check if column already exists
    const checkColumn = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_requests' 
      AND column_name = 'venmo_web_link'
    `);
    
    if (checkColumn.rows.length > 0) {
      console.log('Column venmo_web_link already exists');
      return;
    }
    
    // Add the column
    await db.query(`
      ALTER TABLE payment_requests
      ADD COLUMN venmo_web_link TEXT
    `);
    
    console.log('✅ Successfully added venmo_web_link column');
    
    // Add comment
    await db.query(`
      COMMENT ON COLUMN payment_requests.venmo_web_link IS 'Web-based Venmo link for desktop users'
    `);
    
    console.log('✅ Added column comment');
    
  } catch (error) {
    console.error('Error adding venmo_web_link column:', error);
  } finally {
    process.exit();
  }
}

addVenmoWebLink();