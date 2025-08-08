const db = require('../src/db/connection');

async function fixJulyRent() {
  try {
    console.log('Fixing July 2025 rent income...\n');

    // Check if July rent payment request is paid
    const rentPR = await db.query(`
      SELECT 
        id,
        roommate_name,
        amount,
        status,
        paid_date
      FROM payment_requests
      WHERE year = 2025 
        AND month = 7
        AND bill_type = 'rent'
    `);

    if (rentPR.rows.length === 0) {
      console.log('No rent payment request found for July 2025');
      return;
    }

    const pr = rentPR.rows[0];
    console.log(`Found rent payment request #${pr.id}:`);
    console.log(`  Roommate: ${pr.roommate_name}`);
    console.log(`  Amount: $${pr.amount}`);
    console.log(`  Status: ${pr.status}`);
    console.log(`  Paid Date: ${pr.paid_date || 'N/A'}\n`);

    if (pr.status === 'paid') {
      // Check if income entry exists
      const existingIncome = await db.query(`
        SELECT id, amount, date
        FROM income
        WHERE payment_request_id = $1
          AND income_type = 'rent'
      `, [pr.id]);

      if (existingIncome.rows.length === 0) {
        console.log('⚠️  Payment request is marked as paid but no income entry exists!');
        console.log('Creating missing rent income entry...');

        // Create the missing income entry
        const result = await db.insert('income', {
          date: pr.paid_date || '2025-07-01',
          amount: pr.amount,
          income_type: 'rent',
          description: 'Monthly Rent - July 2025',
          payment_request_id: pr.id
        });

        console.log(`✅ Created income entry with ID: ${result.id}`);
      } else {
        console.log(`✅ Income entry already exists with ID: ${existingIncome.rows[0].id}`);
      }
    } else {
      console.log('Payment request is not marked as paid yet.');
    }

  } catch (error) {
    console.error('Error fixing July rent:', error);
  } finally {
    process.exit(0);
  }
}

fixJulyRent();