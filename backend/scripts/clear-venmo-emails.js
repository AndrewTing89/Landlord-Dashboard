const { Pool } = require('pg');
require('dotenv').config({ path: '../.env' });

async function clearVenmoEmails() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD
  });

  try {
    console.log('Clearing Venmo emails for June/July 2025...\n');
    
    // Delete Venmo emails
    const result = await pool.query(`
      DELETE FROM venmo_emails 
      WHERE EXTRACT(MONTH FROM received_date) IN (6, 7) 
      AND EXTRACT(YEAR FROM received_date) = 2025
      RETURNING *
    `);
    
    console.log(`Deleted ${result.rowCount} Venmo emails`);
    
    if (result.rows.length > 0) {
      console.log('\nDeleted emails:');
      result.rows.forEach(email => {
        console.log(`- ${email.venmo_actor}: $${email.venmo_amount} (${new Date(email.received_date).toLocaleDateString()})`);
      });
    }
    
    // Show remaining count
    const countResult = await pool.query('SELECT COUNT(*) as count FROM venmo_emails');
    console.log(`\nRemaining Venmo emails: ${countResult.rows[0].count}`);
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

clearVenmoEmails();