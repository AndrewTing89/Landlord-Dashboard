#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function addRentIncome2025() {
  console.log('=== Adding Rent Income for 2025 ===\n');
  
  try {
    const rentAmount = 1685;
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
    const currentDay = currentDate.getDate();
    
    let monthsToAdd = [];
    
    // Only add rent for months that have passed
    if (currentYear === 2025) {
      // We're in 2025, add rent for completed months
      for (let month = 1; month < currentMonth; month++) {
        monthsToAdd.push(month);
      }
      // Add current month only if we've passed the 1st
      if (currentDay >= 1) {
        monthsToAdd.push(currentMonth);
      }
    } else if (currentYear > 2025) {
      // We're past 2025, add all 12 months
      for (let month = 1; month <= 12; month++) {
        monthsToAdd.push(month);
      }
    } else {
      console.log('Current year is before 2025, no rent income to add.');
      process.exit(0);
    }
    
    console.log(`Current date: ${currentDate.toLocaleDateString()}`);
    console.log(`Months to add rent for: ${monthsToAdd.join(', ')}\n`);
    
    let added = 0;
    let skipped = 0;
    
    for (const month of monthsToAdd) {
      // Check if rent already exists for this month
      const existing = await db.getOne(
        `SELECT id FROM transactions 
         WHERE expense_type = 'rent' 
         AND EXTRACT(YEAR FROM date) = 2025 
         AND EXTRACT(MONTH FROM date) = $1`,
        [month]
      );
      
      if (existing) {
        console.log(`Rent already exists for ${month}/2025, skipping...`);
        skipped++;
        continue;
      }
      
      // Add rent income transaction
      const rentDate = new Date(2025, month - 1, 1); // 1st of each month
      
      await db.insert('transactions', {
        plaid_transaction_id: `rent_2025_${month}`,
        plaid_account_id: 'manual_entry',
        amount: rentAmount,
        date: rentDate,
        name: `Rent Payment - ${rentDate.toLocaleString('default', { month: 'long' })} 2025`,
        merchant_name: 'Tenant',
        expense_type: 'rent',
        category: 'Income',
        subcategory: 'Rental Income'
      });
      
      console.log(`✓ Added rent income for ${month}/2025: $${rentAmount}`);
      added++;
    }
    
    console.log(`\n=== Summary ===`);
    console.log(`Added: ${added} rent payments`);
    console.log(`Skipped: ${skipped} (already exist)`);
    console.log(`Total expected rent so far: $${(added + skipped) * rentAmount}`);
    
    // Show what's coming next
    if (currentYear === 2025 && currentMonth < 12) {
      const nextMonth = currentDay >= 1 ? currentMonth + 1 : currentMonth;
      if (nextMonth <= 12) {
        const nextDate = new Date(2025, nextMonth - 1, 1);
        console.log(`\nNext rent will be added on: ${nextDate.toLocaleDateString()}`);
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error adding rent income:', error);
    process.exit(1);
  }
}

// Function to check and add rent for a specific month (useful for cron jobs)
async function addRentForMonth(year, month) {
  const rentAmount = 1685;
  
  // Check if rent already exists
  const existing = await db.getOne(
    `SELECT id FROM transactions 
     WHERE expense_type = 'rent' 
     AND EXTRACT(YEAR FROM date) = $1 
     AND EXTRACT(MONTH FROM date) = $2`,
    [year, month]
  );
  
  if (existing) {
    return { success: false, message: 'Rent already exists for this month' };
  }
  
  // Add rent income
  const rentDate = new Date(year, month - 1, 1);
  
  await db.insert('transactions', {
    plaid_transaction_id: `rent_${year}_${month}`,
    plaid_account_id: 'manual_entry',
    amount: rentAmount,
    date: rentDate,
    name: `Rent Payment - ${rentDate.toLocaleString('default', { month: 'long' })} ${year}`,
    merchant_name: 'Tenant',
    expense_type: 'rent',
    category: 'Income',
    subcategory: 'Rental Income'
  });
  
  return { success: true, message: `Added rent for ${month}/${year}` };
}

// Export for use in other scripts or cron jobs
module.exports = { addRentForMonth };

// Run if called directly
if (require.main === module) {
  addRentIncome2025();
}