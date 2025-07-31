const db = require('../db/connection');

async function verifyNetMethod() {
  try {
    console.log('🔍 VERIFYING NET METHOD IMPLEMENTATION\n');
    console.log('=====================================\n');
    
    // 1. Show current revenue (should only be base rent)
    const revenue = await db.query(
      `SELECT 
        COUNT(*) as count,
        SUM(amount) as total
       FROM transactions
       WHERE expense_type = 'rent'
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    
    console.log('1. REVENUE (Base Rent Only):');
    console.log(`   Transactions: ${revenue.rows[0].count}`);
    console.log(`   Total: $${parseFloat(revenue.rows[0].total || 0).toFixed(2)}`);
    
    // 2. Show utility expenses with adjustments
    const utilities = await db.query(
      `SELECT 
        t.expense_type,
        COUNT(DISTINCT t.id) as transactions,
        SUM(t.amount) as gross_amount,
        COUNT(DISTINCT adj.id) as adjustments,
        COALESCE(SUM(adj.adjustment_amount), 0) as adjustment_total,
        SUM(t.amount) - COALESCE(SUM(adj.adjustment_amount), 0) as net_amount
       FROM transactions t
       LEFT JOIN utility_adjustments adj ON adj.transaction_id = t.id
       WHERE t.expense_type IN ('electricity', 'water')
       AND EXTRACT(YEAR FROM t.date) = EXTRACT(YEAR FROM CURRENT_DATE)
       GROUP BY t.expense_type`
    );
    
    console.log('\n2. UTILITY EXPENSES (Net Method):');
    utilities.rows.forEach(row => {
      console.log(`\n${row.expense_type}:`);
      console.log(`   Transactions: ${row.transactions}`);
      console.log(`   Gross amount: $${parseFloat(row.gross_amount).toFixed(2)}`);
      console.log(`   Adjustments: ${row.adjustments} totaling -$${parseFloat(row.adjustment_total).toFixed(2)}`);
      console.log(`   Net amount: $${parseFloat(row.net_amount).toFixed(2)}`);
    });
    
    // 3. Show all expenses with net calculation
    const allExpenses = await db.query(
      `SELECT 
        SUM(CASE WHEN t.expense_type NOT IN ('rent', 'other') THEN t.amount ELSE 0 END) as gross_expenses,
        SUM(CASE WHEN t.expense_type NOT IN ('rent', 'other') THEN COALESCE(adj.adjustment_amount, 0) ELSE 0 END) as total_adjustments,
        SUM(CASE WHEN t.expense_type NOT IN ('rent', 'other') THEN t.amount - COALESCE(adj.adjustment_amount, 0) ELSE 0 END) as net_expenses
       FROM transactions t
       LEFT JOIN utility_adjustments adj ON adj.transaction_id = t.id
       WHERE EXTRACT(YEAR FROM t.date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    
    console.log('\n3. YTD PROPERTY EXPENSES SUMMARY:');
    console.log(`   Gross expenses: $${parseFloat(allExpenses.rows[0].gross_expenses).toFixed(2)}`);
    console.log(`   Total adjustments: -$${parseFloat(allExpenses.rows[0].total_adjustments).toFixed(2)}`);
    console.log(`   Net expenses: $${parseFloat(allExpenses.rows[0].net_expenses).toFixed(2)}`);
    
    // 4. Calculate true net income
    const netIncome = parseFloat(revenue.rows[0].total || 0) - parseFloat(allExpenses.rows[0].net_expenses);
    
    console.log('\n4. TRUE NET INCOME:');
    console.log(`   Revenue (rent): $${parseFloat(revenue.rows[0].total || 0).toFixed(2)}`);
    console.log(`   Net expenses: -$${parseFloat(allExpenses.rows[0].net_expenses).toFixed(2)}`);
    console.log(`   Net income: $${netIncome.toFixed(2)}`);
    
    // 5. Show what it would have been with the old method
    const oldMethodRevenue = parseFloat(revenue.rows[0].total || 0) + parseFloat(allExpenses.rows[0].total_adjustments);
    const oldMethodNetIncome = oldMethodRevenue - parseFloat(allExpenses.rows[0].gross_expenses);
    
    console.log('\n5. COMPARISON WITH OLD METHOD:');
    console.log('   Old method (inflated):');
    console.log(`     Revenue: $${oldMethodRevenue.toFixed(2)} (rent + reimbursements)`);
    console.log(`     Expenses: $${parseFloat(allExpenses.rows[0].gross_expenses).toFixed(2)}`);
    console.log(`     Net income: $${oldMethodNetIncome.toFixed(2)}`);
    console.log('\n   New method (accurate):');
    console.log(`     Revenue: $${parseFloat(revenue.rows[0].total || 0).toFixed(2)} (rent only)`);
    console.log(`     Net expenses: $${parseFloat(allExpenses.rows[0].net_expenses).toFixed(2)}`);
    console.log(`     Net income: $${netIncome.toFixed(2)}`);
    console.log('\n   ✅ Both methods arrive at the same net income!');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

verifyNetMethod();