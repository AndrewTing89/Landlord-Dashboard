const db = require('../db/connection');

async function createAdjustmentsForPaidRequests() {
  try {
    console.log('Creating adjustments for already paid payment requests...\n');
    
    // Get all paid payment requests
    const paidRequests = await db.query(
      `SELECT pr.*, ub.bill_type as utility_bill_type, ub.created_at as bill_date, ub.total_amount as bill_total
       FROM payment_requests pr
       LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
       WHERE pr.status = 'paid'
       AND NOT EXISTS (
         SELECT 1 FROM utility_adjustments ua 
         WHERE ua.payment_request_id = pr.id
       )
       ORDER BY pr.id`
    );
    
    console.log(`Found ${paidRequests.rows.length} paid requests without adjustments\n`);
    
    let createdCount = 0;
    let totalAdjustments = 0;
    
    for (const request of paidRequests.rows) {
      const billType = request.bill_type || request.utility_bill_type;
      const billDate = request.bill_date || request.created_at;
      
      console.log(`Processing payment request ${request.id}:`);
      console.log(`  Type: ${billType}`);
      console.log(`  Amount: $${request.amount}`);
      console.log(`  Bill Total: $${request.bill_total || 'Unknown'}`);
      
      // Find the matching utility expense transaction
      const utilityExpense = await db.getOne(
        `SELECT id, amount, date, name 
         FROM transactions 
         WHERE expense_type = $1 
         AND date >= $2::date - INTERVAL '5 days'
         AND date <= $2::date + INTERVAL '5 days'
         ${request.bill_total ? 'ORDER BY ABS(amount - $3) ASC' : ''}
         LIMIT 1`,
        request.bill_total ? [billType, billDate, request.bill_total] : [billType, billDate]
      );
      
      if (utilityExpense) {
        console.log(`  Found matching expense: ${utilityExpense.name} - $${utilityExpense.amount}`);
        
        // Create adjustment
        await db.insert('utility_adjustments', {
          transaction_id: utilityExpense.id,
          payment_request_id: request.id,
          adjustment_amount: parseFloat(request.amount),
          adjustment_type: 'reimbursement',
          description: `Roommate payment for ${billType} bill`,
          applied_date: request.paid_date || request.updated_at
        });
        
        createdCount++;
        totalAdjustments += parseFloat(request.amount);
        console.log('  ✅ Adjustment created\n');
      } else {
        console.log('  ❌ No matching expense transaction found\n');
      }
    }
    
    console.log(`\n✨ Created ${createdCount} adjustments`);
    console.log(`Total adjustment amount: $${totalAdjustments.toFixed(2)}`);
    
    // Show the net effect
    const netUtilities = await db.query(
      `SELECT 
        t.expense_type,
        SUM(t.amount) as gross_amount,
        COALESCE(SUM(adj.adjustment_amount), 0) as adjustments,
        SUM(t.amount) - COALESCE(SUM(adj.adjustment_amount), 0) as net_amount
       FROM transactions t
       LEFT JOIN utility_adjustments adj ON adj.transaction_id = t.id
       WHERE t.expense_type IN ('electricity', 'water')
       AND EXTRACT(YEAR FROM t.date) = EXTRACT(YEAR FROM CURRENT_DATE)
       GROUP BY t.expense_type`
    );
    
    console.log('\n📊 YTD Utility Expenses (Net Method):');
    netUtilities.rows.forEach(row => {
      console.log(`\n${row.expense_type}:`);
      console.log(`  Gross: $${parseFloat(row.gross_amount).toFixed(2)}`);
      console.log(`  Adjustments: -$${parseFloat(row.adjustments).toFixed(2)}`);
      console.log(`  Net: $${parseFloat(row.net_amount).toFixed(2)}`);
    });
    
    const total = netUtilities.rows.reduce((sum, row) => ({
      gross: sum.gross + parseFloat(row.gross_amount),
      adjustments: sum.adjustments + parseFloat(row.adjustments),
      net: sum.net + parseFloat(row.net_amount)
    }), { gross: 0, adjustments: 0, net: 0 });
    
    console.log('\nTotal Utilities:');
    console.log(`  Gross: $${total.gross.toFixed(2)}`);
    console.log(`  Adjustments: -$${total.adjustments.toFixed(2)}`);
    console.log(`  Net: $${total.net.toFixed(2)}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

createAdjustmentsForPaidRequests();