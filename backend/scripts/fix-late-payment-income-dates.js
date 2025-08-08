const db = require('../src/db/connection');

async function fixLatePaymentIncomeDates() {
  try {
    console.log('Fixing income dates for late payments...\n');
    
    // Find all income records linked to payment requests
    const incomeWithRequests = await db.query(`
      SELECT 
        i.*,
        pr.month as pr_month,
        pr.year as pr_year,
        pr.bill_type,
        pr.roommate_name,
        pr.paid_date,
        EXTRACT(MONTH FROM i.date) as income_month,
        EXTRACT(YEAR FROM i.date) as income_year
      FROM income i
      JOIN payment_requests pr ON i.payment_request_id = pr.id
      WHERE pr.month IS NOT NULL 
        AND pr.year IS NOT NULL
      ORDER BY i.id
    `);
    
    console.log(`Found ${incomeWithRequests.rows.length} income records linked to payment requests\n`);
    
    let fixedCount = 0;
    let alreadyCorrectCount = 0;
    
    for (const record of incomeWithRequests.rows) {
      const incomeMonth = parseInt(record.income_month);
      const incomeYear = parseInt(record.income_year);
      const requestMonth = parseInt(record.pr_month);
      const requestYear = parseInt(record.pr_year);
      
      // Check if the income is recorded in the wrong month
      if (incomeMonth !== requestMonth || incomeYear !== requestYear) {
        console.log(`❌ Income #${record.id} for ${record.roommate_name} (${record.bill_type}):`);
        console.log(`   Currently in: ${incomeMonth}/${incomeYear}`);
        console.log(`   Should be in: ${requestMonth}/${requestYear}`);
        console.log(`   Amount: $${record.amount}`);
        
        // Calculate the correct date (1st for rent, 15th for utilities)
        const day = record.bill_type === 'rent' ? 1 : 15;
        const correctDate = new Date(requestYear, requestMonth - 1, day);
        
        // Update the income record
        await db.query(
          'UPDATE income SET date = $1 WHERE id = $2',
          [correctDate, record.id]
        );
        
        console.log(`   ✅ Fixed! Moved to ${correctDate.toISOString().split('T')[0]}\n`);
        fixedCount++;
      } else {
        alreadyCorrectCount++;
      }
    }
    
    console.log('\n=== Summary ===');
    console.log(`✅ Fixed ${fixedCount} income records`);
    console.log(`✓ ${alreadyCorrectCount} records were already correct`);
    
    if (fixedCount > 0) {
      console.log('\n⚠️ Important: The dashboard charts should now show revenue in the correct months.');
      console.log('Late payments will appear in the month they were for, not when they were paid.');
    }
    
  } catch (error) {
    console.error('Error fixing income dates:', error);
  } finally {
    process.exit();
  }
}

// Add confirmation prompt
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('This script will fix income dates for late payments.');
console.log('Income will be moved to the month the bill was for, not when it was paid.\n');

rl.question('Do you want to proceed? (yes/no): ', (answer) => {
  if (answer.toLowerCase() === 'yes' || answer.toLowerCase() === 'y') {
    rl.close();
    fixLatePaymentIncomeDates();
  } else {
    console.log('Cancelled.');
    rl.close();
    process.exit();
  }
});