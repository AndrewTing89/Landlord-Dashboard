const db = require('../src/db/connection');

async function addIgnoredColumn() {
  try {
    console.log('Adding ignored column to venmo_emails table...');
    
    // Add the column
    await db.query(`
      ALTER TABLE venmo_emails 
      ADD COLUMN IF NOT EXISTS ignored BOOLEAN DEFAULT false
    `);
    console.log('✓ Added ignored column');
    
    // Create index
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_venmo_emails_ignored 
      ON venmo_emails(ignored) 
      WHERE ignored = false
    `);
    console.log('✓ Created index on ignored column');
    
    // Update existing records
    await db.query(`
      UPDATE venmo_emails 
      SET ignored = false 
      WHERE ignored IS NULL
    `);
    console.log('✓ Updated existing records');
    
    console.log('✅ Successfully added ignored column to venmo_emails table');
  } catch (error) {
    console.error('Error adding ignored column:', error);
  } finally {
    process.exit();
  }
}

addIgnoredColumn();