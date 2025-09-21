#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function createRecuperationTransactions() {
  try {
    console.log('Creating utility recuperation transactions...\n');
    
    // Get all paid payment requests that don't have recuperation transactions
    const paidRequests = await db.query(
      `SELECT pr.*, ub.bill_type as ub_bill_type, ub.total_amount as bill_total
       FROM payment_requests pr
       LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
       WHERE pr.status = 'paid'
       AND pr.paid_date IS NOT NULL
       AND NOT EXISTS (
         SELECT 1 FROM expenses t
         WHERE t.expense_type = 'utility_reimbursement'
         AND t.date = pr.paid_date::date
         AND t.amount = pr.amount
         AND t.merchant_name LIKE '%' || pr.roommate_name || '%'
       )
       ORDER BY pr.paid_date`
    );
    
    console.log(`Found ${paidRequests.rows.length} paid requests without recuperation transactions\n`);
    
    if (paidRequests.rows.length === 0) {
      console.log('All paid requests already have recuperation transactions!');
      return;
    }
    
    // Start transaction
    await db.query('BEGIN');
    
    let created = 0;
    try {
      for (const request of paidRequests.rows) {
        const billType = request.bill_type || request.ub_bill_type;
        const utilityName = billType === 'electricity' ? 'PG&E' : 'Water';
        const monthName = new Date(2024, request.month - 1).toLocaleString('default', { month: 'short' });
        
        // Create a recuperation transaction
        const transaction = await db.insert('expenses', {
          simplefin_transaction_id: `recuperation_${request.id}_${Date.now()}`,
          simplefin_account_id: 'manual_entry',
          amount: parseFloat(request.amount),
          date: request.paid_date,
          name: `${request.roommate_name} - ${utilityName} Payment`,
          merchant_name: request.roommate_name,
          expense_type: 'utility_reimbursement',
          category: 'Reimbursement',
          subcategory: `${billType} payment`,
          created_at: new Date(),
          updated_at: new Date()
        });
        
        console.log(`Created recuperation transaction for ${utilityName} ${monthName} ${request.year}: $${request.amount}`);
        created++;
        
        // Also ensure there's a utility adjustment linking to the original expense
        const utilityExpense = await db.getOne(
          `SELECT id FROM expenses 
           WHERE expense_type = $1 
           AND date >= $2::date - INTERVAL '5 days'
           AND date <= $2::date + INTERVAL '5 days'
           AND amount > $3
           ORDER BY ABS(amount - $3 * 3) ASC
           LIMIT 1`,
          [billType, request.charge_date || request.created_at, request.amount]
        );
        
        if (utilityExpense && !(await db.getOne(
          'SELECT id FROM utility_adjustments WHERE payment_request_id = $1',
          [request.id]
        ))) {
          await db.insert('utility_adjustments', {
            transaction_id: utilityExpense.id,
            payment_request_id: request.id,
            adjustment_amount: parseFloat(request.amount),
            adjustment_type: 'reimbursement',
            description: `${request.roommate_name} payment for ${billType} bill`,
            applied_date: request.paid_date
          });
          console.log(`  - Also created adjustment linking to expense transaction ${utilityExpense.id}`);
        }
      }
      
      await db.query('COMMIT');
      console.log(`\n✅ Successfully created ${created} recuperation transactions!`);
      
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
    
    // Show summary
    const summary = await db.query(
      `SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total
       FROM expenses
       WHERE expense_type = 'utility_reimbursement'
       GROUP BY expense_type`
    );
    
    console.log('\nUtility reimbursement summary:');
    summary.rows.forEach(row => {
      console.log(`- ${row.expense_type}: ${row.count} transactions, total $${row.total}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

createRecuperationTransactions();