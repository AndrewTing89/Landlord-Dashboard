const db = require('../src/db/connection');

async function createMissingIncome() {
  try {
    console.log('🔧 Creating missing income record for matched payment...');
    
    // Get the payment request #19 that was marked as paid
    const paymentRequest = await db.getOne(
      'SELECT * FROM payment_requests WHERE id = 19'
    );
    
    if (!paymentRequest) {
      console.log('❌ Payment request #19 not found');
      return;
    }
    
    console.log('📝 Payment Request:', {
      id: paymentRequest.id,
      roommate: paymentRequest.roommate_name,
      amount: paymentRequest.amount,
      bill_type: paymentRequest.bill_type,
      status: paymentRequest.status,
      month: paymentRequest.month,
      year: paymentRequest.year
    });
    
    // Check if income already exists
    const existingIncome = await db.getOne(
      'SELECT * FROM income WHERE payment_request_id = $1',
      [paymentRequest.id]
    );
    
    if (existingIncome) {
      console.log('ℹ️ Income record already exists:', existingIncome.id);
      return;
    }
    
    // Get month name
    const monthNames = [
      'January', 'February', 'March', 'April', 'May', 'June',
      'July', 'August', 'September', 'October', 'November', 'December'
    ];
    const monthName = monthNames[paymentRequest.month - 1];
    
    // Create income record for utility reimbursement
    const incomeResult = await db.query(`
      INSERT INTO income (
        date,
        amount,
        description,
        income_type,
        payment_request_id,
        payer_name,
        notes,
        month,
        year,
        created_at,
        updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, NOW(), NOW()
      ) RETURNING id
    `, [
      paymentRequest.paid_date || new Date(),
      parseFloat(paymentRequest.amount),
      `Utility Reimbursement - ${paymentRequest.bill_type} - ${monthName} ${paymentRequest.year}`,
      'utility_reimbursement',
      paymentRequest.id,
      paymentRequest.roommate_name,
      `Payment for ${paymentRequest.bill_type} bill (${monthName} ${paymentRequest.year})`,
      paymentRequest.month,
      paymentRequest.year
    ]);
    
    console.log('✅ Created income record:', incomeResult.rows[0].id);
    console.log('   Amount: $' + paymentRequest.amount);
    console.log('   Type: utility_reimbursement');
    console.log('   Description: Utility Reimbursement - ' + paymentRequest.bill_type);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

createMissingIncome();