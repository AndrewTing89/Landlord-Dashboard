#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function createHistoricalPaymentRequests() {
  try {
    console.log('Creating payment requests for January to April 2025...\n');
    
    // First, let's find the utility transactions from Jan to Apr 2025
    const utilityTransactions = await db.query(
      `SELECT * FROM expenses 
       WHERE date >= '2025-01-01' AND date < '2025-05-01'
       AND (expense_type = 'electricity' OR expense_type = 'water')
       ORDER BY date ASC`
    );
    
    console.log(`Found ${utilityTransactions.rows.length} utility transactions from Jan-Apr 2025\n`);
    
    let createdCount = 0;
    
    for (const transaction of utilityTransactions.rows) {
      // Extract month from transaction date
      const transactionDate = new Date(transaction.date);
      const month = transactionDate.getMonth() + 1;
      const year = transactionDate.getFullYear();
      
      // Determine bill type and company name
      let billType, companyName, venmoCompanyName;
      if (transaction.expense_type === 'electricity') {
        billType = 'electricity';
        companyName = 'PG&E';
        venmoCompanyName = 'PG%26E';
      } else if (transaction.expense_type === 'water') {
        billType = 'water';
        companyName = 'Great Oaks Water';
        venmoCompanyName = 'Water';
      }
      
      // Check if payment request already exists for this month/year/type
      const existing = await db.query(
        `SELECT id FROM payment_requests 
         WHERE month = $1 AND year = $2 AND bill_type = $3`,
        [month, year, billType]
      );
      
      if (existing.rows.length === 0) {
        // Calculate roommate's share (1/3 of total)
        const totalAmount = Math.abs(transaction.amount);
        const roommateShare = (totalAmount / 3).toFixed(2);
        
        // Create Venmo link
        const monthName = new Date(year, month - 1).toLocaleString('en', { month: 'short' });
        const venmoNote = `${venmoCompanyName}%20bill%20for%20${monthName}%20${year}%3A%20Total%20%24${totalAmount}%2C%20your%20share%20is%20%24${roommateShare}%20(1%2F3).%20I've%20already%20paid%20the%20full%20amount.`;
        const venmoLink = `https://venmo.com/u/UshiLo?txn=charge&amount=${roommateShare}&note=${venmoNote}`;
        
        // Insert payment request
        await db.query(
          `INSERT INTO payment_requests (
            roommate_name, venmo_username, amount, status, venmo_link,
            bill_type, month, year, merchant_name, charge_date, total_amount,
            request_date, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)`,
          [
            'UshiLo',
            '@UshiLo',
            roommateShare,
            'pending',
            venmoLink,
            billType,
            month,
            year,
            transaction.merchant_name || transaction.name,
            transaction.date,
            totalAmount,
            new Date(),
            new Date(),
            new Date()
          ]
        );
        
        console.log(`Created payment request for ${billType} - ${month}/${year}:`);
        console.log(`  - Total: $${totalAmount}`);
        console.log(`  - Roommate share: $${roommateShare}`);
        console.log(`  - Charge date: ${transactionDate.toISOString().split('T')[0]}`);
        createdCount++;
      } else {
        console.log(`Payment request already exists for ${billType} - ${month}/${year}`);
      }
    }
    
    console.log(`\n✅ Created ${createdCount} new payment requests`);
    
    // Show all payment requests
    const allRequests = await db.query(
      `SELECT month, year, bill_type, COUNT(*) as count, SUM(amount::numeric) as total
       FROM payment_requests
       WHERE year = 2025
       GROUP BY month, year, bill_type
       ORDER BY year, month, bill_type`
    );
    
    console.log('\nAll 2025 payment requests summary:');
    allRequests.rows.forEach(row => {
      console.log(`  - ${row.month}/${row.year} ${row.bill_type}: ${row.count} requests, Total: $${row.total}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

createHistoricalPaymentRequests();