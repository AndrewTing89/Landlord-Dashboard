const { Database } = require('../src/database');
require('dotenv').config({ path: '../.env' });

async function clearJunJulData() {
  const db = new Database();
  
  try {
    console.log('Clearing June/July 2025 data...\n');
    
    // Delete Venmo emails
    const emailResult = await db.query(`
      DELETE FROM venmo_emails 
      WHERE EXTRACT(MONTH FROM received_date) IN (6, 7) 
      AND EXTRACT(YEAR FROM received_date) = 2025
      RETURNING *
    `);
    console.log(`Deleted ${emailResult.rowCount} Venmo emails`);
    
    // Delete payment requests
    const requestResult = await db.query(`
      DELETE FROM payment_requests 
      WHERE month IN (6, 7) AND year = 2025
      RETURNING *
    `);
    console.log(`Deleted ${requestResult.rowCount} payment requests`);
    
    // Delete utility bills
    const billResult = await db.query(`
      DELETE FROM utility_bills
      WHERE EXTRACT(MONTH FROM bill_date) IN (6, 7)
      AND EXTRACT(YEAR FROM bill_date) = 2025
      RETURNING *
    `);
    console.log(`Deleted ${billResult.rowCount} utility bills`);
    
    // Delete transactions for those bills
    const transResult = await db.query(`
      DELETE FROM transactions
      WHERE EXTRACT(MONTH FROM transaction_date) IN (6, 7)
      AND EXTRACT(YEAR FROM transaction_date) = 2025
      AND description LIKE '%Bill%'
      RETURNING *
    `);
    console.log(`Deleted ${transResult.rowCount} related transactions`);
    
    // Show remaining counts
    console.log('\nRemaining data:');
    const emailCount = await db.getOne('SELECT COUNT(*) as count FROM venmo_emails');
    const requestCount = await db.getOne('SELECT COUNT(*) as count FROM payment_requests');
    const billCount = await db.getOne('SELECT COUNT(*) as count FROM utility_bills');
    
    console.log(`- Venmo emails: ${emailCount.count}`);
    console.log(`- Payment requests: ${requestCount.count}`);
    console.log(`- Utility bills: ${billCount.count}`);
    
    console.log('\nJune/July 2025 data cleared successfully!');
    
  } catch (error) {
    console.error('Error clearing data:', error);
  } finally {
    await db.close();
  }
}

clearJunJulData();