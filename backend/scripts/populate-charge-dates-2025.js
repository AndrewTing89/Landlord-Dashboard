#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function populateChargeDates() {
  try {
    console.log('🔧 Populating charge dates for payment requests from BofA transaction dates...\n');
    
    // Get all payment requests that need charge_date populated
    const paymentRequests = await db.query(
      `SELECT pr.id, pr.month, pr.year, pr.bill_type, pr.amount, pr.total_amount, pr.charge_date
       FROM payment_requests pr
       WHERE pr.year = 2025
       ORDER BY pr.year DESC, pr.month DESC`
    );
    
    console.log(`Found ${paymentRequests.rows.length} payment requests for 2025`);
    
    let updated = 0;
    let alreadySet = 0;
    
    for (const pr of paymentRequests.rows) {
      // Skip if already has a charge_date
      if (pr.charge_date) {
        alreadySet++;
        console.log(`✓ PR ${pr.id} (${pr.bill_type} ${pr.month}/${pr.year}) already has charge_date: ${new Date(pr.charge_date).toLocaleDateString()}`);
        continue;
      }
      
      // Find the corresponding expense based on type and date
      let query;
      let params;
      
      if (pr.bill_type === 'electricity') {
        // For electricity, look for PG&E expenses
        query = `
          SELECT date, amount 
          FROM expenses 
          WHERE (LOWER(name) LIKE '%pgande%' OR LOWER(name) LIKE '%pg&e%' OR LOWER(name) LIKE '%pacific gas%')
          AND EXTRACT(MONTH FROM date) = $1
          AND EXTRACT(YEAR FROM date) = $2
          AND category = 'electricity'
          ORDER BY date DESC
          LIMIT 1
        `;
        params = [pr.month, pr.year];
      } else if (pr.bill_type === 'water') {
        // For water, look for water expenses
        query = `
          SELECT date, amount 
          FROM expenses 
          WHERE (LOWER(name) LIKE '%water%' OR LOWER(name) LIKE '%great oaks%')
          AND EXTRACT(MONTH FROM date) = $1
          AND EXTRACT(YEAR FROM date) = $2
          AND category = 'water'
          ORDER BY date DESC
          LIMIT 1
        `;
        params = [pr.month, pr.year];
      } else if (pr.bill_type === 'rent') {
        // For rent, use the 1st of the month
        const rentDate = new Date(pr.year, pr.month - 1, 1);
        await db.query(
          `UPDATE payment_requests 
           SET charge_date = $1
           WHERE id = $2`,
          [rentDate, pr.id]
        );
        console.log(`✅ Updated PR ${pr.id} (rent ${pr.month}/${pr.year}): Bill Paid: ${rentDate.toLocaleDateString()}`);
        updated++;
        continue;
      }
      
      if (query) {
        const expense = await db.query(query, params);
        
        if (expense.rows[0]) {
          const chargeDate = expense.rows[0].date;
          const totalAmount = Math.abs(expense.rows[0].amount);
          
          // Update payment request with the charge_date (when bill was paid to BofA)
          await db.query(
            `UPDATE payment_requests 
             SET charge_date = $1, 
                 total_amount = COALESCE(total_amount, $2)
             WHERE id = $3`,
            [chargeDate, totalAmount, pr.id]
          );
          
          console.log(`✅ Updated PR ${pr.id} (${pr.bill_type} ${pr.month}/${pr.year}):`);
          console.log(`   Bill Paid: ${new Date(chargeDate).toLocaleDateString()}`);
          console.log(`   Total amount: $${totalAmount}`);
          updated++;
        } else {
          console.log(`⚠️  No matching expense found for PR ${pr.id} (${pr.bill_type} ${pr.month}/${pr.year})`);
          
          // Use a default date (10th of the month) as fallback
          const defaultDate = new Date(pr.year, pr.month - 1, 10);
          await db.query(
            `UPDATE payment_requests 
             SET charge_date = $1
             WHERE id = $2`,
            [defaultDate, pr.id]
          );
          console.log(`   Using default date: ${defaultDate.toLocaleDateString()}`);
          updated++;
        }
      }
    }
    
    console.log('\n📊 Summary:');
    console.log(`  - Already had charge_date: ${alreadySet}`);
    console.log(`  - Updated with charge_date: ${updated}`);
    console.log(`  - Total processed: ${paymentRequests.rows.length}`);
    
    // Show final results
    const results = await db.query(
      `SELECT month, year, bill_type, charge_date, total_amount, roommate_name
       FROM payment_requests
       WHERE year = 2025
       ORDER BY year DESC, month DESC, bill_type`
    );
    
    console.log('\n✅ All 2025 payment requests with charge dates:');
    const groupedByMonth = {};
    results.rows.forEach(row => {
      const key = `${row.month}/${row.year}`;
      if (!groupedByMonth[key]) {
        groupedByMonth[key] = [];
      }
      const date = row.charge_date ? new Date(row.charge_date).toLocaleDateString() : 'N/A';
      groupedByMonth[key].push(`    ${row.bill_type}: Bill Paid ${date} (${row.roommate_name})`);
    });
    
    Object.keys(groupedByMonth).sort().reverse().forEach(monthYear => {
      console.log(`\n  ${monthYear}:`);
      groupedByMonth[monthYear].forEach(item => console.log(item));
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

populateChargeDates();