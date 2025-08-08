const db = require('../src/db/connection');

async function checkJulyRevenue() {
  try {
    console.log('Checking July 2025 revenue...\n');

    // Check all income entries for July 2025
    const julyIncome = await db.query(`
      SELECT 
        id,
        date,
        amount,
        income_type,
        description,
        payment_request_id
      FROM income
      WHERE EXTRACT(YEAR FROM date) = 2025 
        AND EXTRACT(MONTH FROM date) = 7
      ORDER BY date, income_type
    `);

    console.log(`Found ${julyIncome.rows.length} income entries for July 2025:\n`);
    
    let rentTotal = 0;
    let reimbursementTotal = 0;
    const rentEntries = [];
    const reimbursementEntries = [];

    julyIncome.rows.forEach(row => {
      if (row.income_type === 'rent') {
        rentTotal += parseFloat(row.amount);
        rentEntries.push(row);
      } else if (row.income_type === 'utility_reimbursement') {
        reimbursementTotal += parseFloat(row.amount);
        reimbursementEntries.push(row);
      }
    });

    console.log('RENT INCOME:');
    console.log('------------');
    rentEntries.forEach(entry => {
      console.log(`  ${entry.date.toISOString().split('T')[0]} - $${entry.amount} - ${entry.description || 'No description'}`);
    });
    console.log(`Total Rent: $${rentTotal.toFixed(2)}`);
    
    console.log('\nUTILITY REIMBURSEMENTS:');
    console.log('----------------------');
    reimbursementEntries.forEach(entry => {
      console.log(`  ${entry.date.toISOString().split('T')[0]} - $${entry.amount} - ${entry.description || 'No description'} (PR: ${entry.payment_request_id || 'NULL'})`);
    });
    console.log(`Total Reimbursements: $${reimbursementTotal.toFixed(2)}`);
    
    console.log(`\nTOTAL JULY REVENUE: $${(rentTotal + reimbursementTotal).toFixed(2)}`);

    // Check for duplicate rent entries
    if (rentEntries.length > 1) {
      console.log('\n⚠️  WARNING: Multiple rent entries found for July!');
      console.log('This might be causing the inflated revenue.');
      
      // Check if they're duplicates
      const uniqueDates = [...new Set(rentEntries.map(e => e.date.toISOString().split('T')[0]))];
      if (uniqueDates.length < rentEntries.length) {
        console.log('Found potential duplicate rent entries on the same date(s).');
      }
    }

    // Check payment requests for July to cross-reference
    console.log('\n\nChecking Payment Requests for July 2025:');
    console.log('----------------------------------------');
    const paymentRequests = await db.query(`
      SELECT 
        id,
        roommate_name,
        bill_type,
        amount,
        status,
        created_at
      FROM payment_requests
      WHERE year = 2025 
        AND month = 7
      ORDER BY bill_type, created_at
    `);

    paymentRequests.rows.forEach(pr => {
      console.log(`  PR #${pr.id}: ${pr.bill_type} - ${pr.roommate_name} - $${pr.amount} - Status: ${pr.status}`);
    });

    // Check for rent payment request specifically
    const rentPR = paymentRequests.rows.filter(pr => pr.bill_type === 'rent');
    if (rentPR.length > 0) {
      console.log(`\nRent Payment Request Status: ${rentPR[0].status}`);
      if (rentPR[0].status === 'paid' && rentEntries.length > 1) {
        console.log('⚠️  Rent payment request is marked as paid, but multiple rent income entries exist!');
      }
    }

  } catch (error) {
    console.error('Error checking July revenue:', error);
  } finally {
    process.exit(0);
  }
}

checkJulyRevenue();