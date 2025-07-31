const db = require('../db/connection');

async function checkMissingAdjustments() {
  try {
    console.log('Checking for missing adjustments...\n');
    
    // Get paid requests without adjustments
    const missingAdjustments = await db.query(
      `SELECT pr.*, ub.bill_type as utility_bill_type, ub.total_amount as bill_total
       FROM payment_requests pr
       LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
       WHERE pr.status = 'paid'
       AND NOT EXISTS (
         SELECT 1 FROM utility_adjustments ua 
         WHERE ua.payment_request_id = pr.id
       )`
    );
    
    if (missingAdjustments.rows.length > 0) {
      console.log(`Found ${missingAdjustments.rows.length} paid requests still without adjustments:\n`);
      
      let totalMissing = 0;
      missingAdjustments.rows.forEach(req => {
        console.log(`Payment Request ${req.id}:`);
        console.log(`  Type: ${req.bill_type || req.utility_bill_type}`);
        console.log(`  Amount: $${req.amount}`);
        console.log(`  Bill Total: $${req.bill_total || 'Unknown'}`);
        console.log(`  Month/Year: ${req.month}/${req.year}`);
        totalMissing += parseFloat(req.amount);
      });
      
      console.log(`\nTotal missing adjustments: $${totalMissing.toFixed(2)}`);
    } else {
      console.log('All paid requests have adjustments! ✅');
    }
    
    // Show current adjustment summary
    const adjustmentSummary = await db.query(
      `SELECT 
        COUNT(*) as count,
        SUM(adjustment_amount) as total
       FROM utility_adjustments`
    );
    
    console.log(`\nCurrent adjustments: ${adjustmentSummary.rows[0].count} totaling $${parseFloat(adjustmentSummary.rows[0].total || 0).toFixed(2)}`);
    
    // Show payment request summary
    const paymentSummary = await db.query(
      `SELECT 
        status,
        COUNT(*) as count,
        SUM(amount) as total
       FROM payment_requests
       GROUP BY status`
    );
    
    console.log('\nPayment request summary:');
    paymentSummary.rows.forEach(row => {
      console.log(`  ${row.status}: ${row.count} requests, $${parseFloat(row.total).toFixed(2)}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkMissingAdjustments();