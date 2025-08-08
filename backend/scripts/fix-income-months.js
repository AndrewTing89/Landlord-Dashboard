const db = require('../src/db/connection');

async function fixIncomeMonths() {
  try {
    console.log('Fixing income month assignments...\n');

    // Start transaction
    await db.query('BEGIN');

    // 1. Fix rent income - should be on the 1st of each month
    console.log('Fixing rent income dates...');
    const rentPayments = await db.query(`
      SELECT 
        i.id as income_id,
        i.date as current_date,
        i.amount,
        i.description,
        pr.month,
        pr.year
      FROM income i
      JOIN payment_requests pr ON i.payment_request_id = pr.id
      WHERE i.income_type = 'rent'
        AND pr.bill_type = 'rent'
    `);

    for (const payment of rentPayments.rows) {
      const correctDate = new Date(payment.year, payment.month - 1, 1); // First day of the month
      const formattedDate = correctDate.toISOString().split('T')[0];
      
      console.log(`  Moving rent payment from ${payment.current_date.toISOString().split('T')[0]} to ${formattedDate}`);
      
      await db.query(
        'UPDATE income SET date = $1 WHERE id = $2',
        [formattedDate, payment.income_id]
      );
    }
    console.log(`Updated ${rentPayments.rows.length} rent payments\n`);

    // 2. Fix utility reimbursements - should be in the month of the bill
    console.log('Fixing utility reimbursement dates...');
    const utilityPayments = await db.query(`
      SELECT 
        i.id as income_id,
        i.date as current_date,
        i.amount,
        i.description,
        pr.month,
        pr.year,
        pr.bill_type
      FROM income i
      JOIN payment_requests pr ON i.payment_request_id = pr.id
      WHERE i.income_type = 'utility_reimbursement'
        AND pr.bill_type IN ('electricity', 'water', 'internet')
    `);

    for (const payment of utilityPayments.rows) {
      // Use the 15th of the month for utility reimbursements
      const correctDate = new Date(payment.year, payment.month - 1, 15);
      const formattedDate = correctDate.toISOString().split('T')[0];
      
      console.log(`  Moving ${payment.bill_type} reimbursement from ${payment.current_date.toISOString().split('T')[0]} to ${formattedDate}`);
      
      await db.query(
        'UPDATE income SET date = $1 WHERE id = $2',
        [formattedDate, payment.income_id]
      );
    }
    console.log(`Updated ${utilityPayments.rows.length} utility reimbursements\n`);

    // 3. Also check for rent entries without payment_request_id
    console.log('Checking for rent entries without payment request links...');
    const orphanRent = await db.query(`
      SELECT 
        id,
        date,
        amount,
        description
      FROM income
      WHERE income_type = 'rent'
        AND payment_request_id IS NULL
    `);

    for (const rent of orphanRent.rows) {
      // Extract month from description or date
      const currentDate = new Date(rent.date);
      const firstOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
      const formattedDate = firstOfMonth.toISOString().split('T')[0];
      
      if (rent.date.toISOString().split('T')[0] !== formattedDate) {
        console.log(`  Moving orphan rent from ${rent.date.toISOString().split('T')[0]} to ${formattedDate}`);
        
        await db.query(
          'UPDATE income SET date = $1 WHERE id = $2',
          [formattedDate, rent.id]
        );
      }
    }

    await db.query('COMMIT');
    console.log('\n✅ Successfully fixed all income month assignments!');

    // Show updated summary
    console.log('\nUpdated monthly income summary for 2025:');
    const summary = await db.query(`
      SELECT 
        EXTRACT(MONTH FROM date) as month,
        income_type,
        SUM(amount) as total,
        COUNT(*) as count
      FROM income
      WHERE EXTRACT(YEAR FROM date) = 2025
      GROUP BY EXTRACT(MONTH FROM date), income_type
      ORDER BY month, income_type
    `);

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    let currentMonth = 0;
    
    summary.rows.forEach(row => {
      if (row.month !== currentMonth) {
        currentMonth = row.month;
        console.log(`\n${monthNames[row.month - 1]}:`);
      }
      console.log(`  ${row.income_type}: $${parseFloat(row.total).toFixed(2)} (${row.count} entries)`);
    });

  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Error fixing income months:', error);
  } finally {
    process.exit(0);
  }
}

fixIncomeMonths();