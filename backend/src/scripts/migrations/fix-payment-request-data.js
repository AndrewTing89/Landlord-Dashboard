#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function fixPaymentRequestData() {
  try {
    console.log('Checking payment requests and utility bills data...\n');
    
    // Check payment requests without utility_bill_id
    const prWithoutBill = await db.query(
      `SELECT id, merchant_name, month, year, amount, created_at 
       FROM payment_requests 
       WHERE utility_bill_id IS NULL 
       ORDER BY created_at DESC`
    );
    
    console.log(`Found ${prWithoutBill.rows.length} payment requests without utility_bill_id`);
    
    // Check utility bills
    const utilityBills = await db.query(
      `SELECT id, bill_type, month, year, total_amount, created_at 
       FROM utility_bills 
       WHERE year = 2025 AND month >= 5
       ORDER BY year DESC, month DESC`
    );
    
    console.log(`\nFound ${utilityBills.rows.length} utility bills from May 2025 onwards`);
    
    // For each payment request, try to match with utility bill
    for (const pr of prWithoutBill.rows) {
      // Extract month/year from the payment request note or merchant name
      let month = null;
      let year = null;
      let billType = null;
      
      // Determine bill type from merchant name
      if (pr.merchant_name?.includes('Pacific Gas') || pr.merchant_name?.includes('PG&E')) {
        billType = 'electricity';
      } else if (pr.merchant_name?.includes('Water') || pr.merchant_name?.includes('WATER')) {
        billType = 'water';
      }
      
      // Try to extract month/year from existing payment request
      // Look at the venmo link note
      const noteMatch = await db.query(
        `SELECT venmo_link FROM payment_requests WHERE id = $1`,
        [pr.id]
      );
      
      if (noteMatch.rows[0]?.venmo_link) {
        const link = noteMatch.rows[0].venmo_link;
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        monthNames.forEach((name, index) => {
          if (link.includes(`${name}%20`)) {
            month = index + 1;
          }
        });
        
        if (link.includes('2025')) {
          year = 2025;
        }
      }
      
      console.log(`\nPayment Request ID ${pr.id}:`);
      console.log(`  - Merchant: ${pr.merchant_name}`);
      console.log(`  - Detected: Type=${billType}, Month=${month}, Year=${year}`);
      
      // Update the payment request with month/year
      if (month && year) {
        await db.query(
          `UPDATE payment_requests 
           SET month = $1, year = $2, bill_type = $3 
           WHERE id = $4`,
          [month, year, billType, pr.id]
        );
        console.log(`  - Updated with month=${month}, year=${year}, bill_type=${billType}`);
      }
    }
    
    // Check results
    const updatedPRs = await db.query(
      `SELECT month, year, bill_type, COUNT(*) as count 
       FROM payment_requests 
       WHERE year = 2025 AND month >= 5
       GROUP BY month, year, bill_type 
       ORDER BY year DESC, month DESC, bill_type`
    );
    
    console.log('\n✅ Updated payment requests summary:');
    updatedPRs.rows.forEach(row => {
      console.log(`  - ${row.month}/${row.year} ${row.bill_type}: ${row.count} requests`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

fixPaymentRequestData();