#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function fixChargeDates() {
  try {
    console.log('Fixing charge dates for payment requests...\n');
    
    // Get payment requests with their bill info
    const paymentRequests = await db.query(
      `SELECT pr.id, pr.month, pr.year, pr.bill_type, pr.amount, pr.merchant_name,
              pr.charge_date, pr.total_amount
       FROM payment_requests pr
       WHERE pr.year = 2025 AND pr.month >= 5
       ORDER BY pr.year DESC, pr.month DESC`
    );
    
    console.log(`Found ${paymentRequests.rows.length} payment requests to fix`);
    
    for (const pr of paymentRequests.rows) {
      // Find the corresponding transaction based on merchant and amount
      let query;
      let params;
      
      if (pr.bill_type === 'electricity') {
        // For electricity, look for PG&E transactions
        query = `
          SELECT date, amount 
          FROM transactions 
          WHERE (LOWER(name) LIKE '%pgande%' OR LOWER(name) LIKE '%pg&e%' OR LOWER(name) LIKE '%pacific gas%')
          AND date >= $1 AND date <= $2
          AND expense_type = 'electricity'
          ORDER BY ABS(amount - $3) ASC
          LIMIT 1
        `;
        // Look in the month when the bill would have been charged
        const startDate = new Date(pr.year, pr.month - 1, 1);
        const endDate = new Date(pr.year, pr.month, 0); // Last day of month
        params = [startDate, endDate, pr.amount * 3]; // Total amount is share * 3
      } else if (pr.bill_type === 'water') {
        // For water, look for water transactions
        query = `
          SELECT date, amount 
          FROM transactions 
          WHERE (LOWER(name) LIKE '%water%' OR LOWER(name) LIKE '%great oaks%')
          AND date >= $1 AND date <= $2
          AND expense_type = 'water'
          ORDER BY ABS(amount - $3) ASC
          LIMIT 1
        `;
        const startDate = new Date(pr.year, pr.month - 1, 1);
        const endDate = new Date(pr.year, pr.month, 0);
        params = [startDate, endDate, pr.amount * 3];
      }
      
      if (query) {
        const transaction = await db.query(query, params);
        
        if (transaction.rows[0]) {
          const chargeDate = transaction.rows[0].date;
          const totalAmount = Math.abs(transaction.rows[0].amount);
          
          await db.query(
            `UPDATE payment_requests 
             SET charge_date = $1, total_amount = $2
             WHERE id = $3`,
            [chargeDate, totalAmount, pr.id]
          );
          
          console.log(`\nUpdated PR ${pr.id} (${pr.bill_type} ${pr.month}/${pr.year}):`);
          console.log(`  - Charge date: ${chargeDate.toISOString().split('T')[0]}`);
          console.log(`  - Total amount: $${totalAmount}`);
        } else {
          console.log(`\nNo matching transaction found for PR ${pr.id} (${pr.bill_type} ${pr.month}/${pr.year})`);
        }
      }
    }
    
    // Show final results
    const results = await db.query(
      `SELECT month, year, bill_type, charge_date, total_amount
       FROM payment_requests
       WHERE year = 2025 AND month >= 5
       ORDER BY year DESC, month DESC, bill_type`
    );
    
    console.log('\n✅ Final payment requests:');
    results.rows.forEach(row => {
      const date = row.charge_date ? new Date(row.charge_date).toISOString().split('T')[0] : 'N/A';
      console.log(`  - ${row.month}/${row.year} ${row.bill_type}: Charged on ${date}, Total: $${row.total_amount || 'N/A'}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

fixChargeDates();