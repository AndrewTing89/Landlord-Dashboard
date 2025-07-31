const db = require('../db/connection');

async function analyzeSystemSetup() {
  try {
    console.log('🔍 SYSTEM SETUP ANALYSIS\n');
    console.log('=======================\n');
    
    // 1. Check expense categorization
    console.log('1. EXPENSE CATEGORIZATION:');
    const expenseTypes = await db.query(
      `SELECT expense_type, COUNT(*) as count, SUM(amount) as total
       FROM transactions
       WHERE EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
       GROUP BY expense_type
       ORDER BY expense_type`
    );
    
    console.log('\nCurrent expense_type usage:');
    expenseTypes.rows.forEach(row => {
      console.log(`  ${row.expense_type}: ${row.count} transactions, $${parseFloat(row.total).toFixed(2)}`);
    });
    
    // 2. Check for conceptual issues
    console.log('\n\n2. CONCEPTUAL ISSUES IDENTIFIED:');
    
    console.log('\n  ❌ Issue #1: Using "expense_type" for both income and expenses');
    console.log('     - "rent" is categorized as an expense_type but represents income');
    console.log('     - This conflates revenue and expenses in the same field');
    
    console.log('\n  ❌ Issue #2: Double-counting utility costs');
    console.log('     - Full utility bill shows as expense (e.g., $300 electricity)');
    console.log('     - Roommate payment shows as revenue (e.g., $100)');
    console.log('     - Net effect should be $200 expense, not $300 expense + $100 revenue');
    
    // 3. Show actual vs optimal accounting
    console.log('\n\n3. ACCOUNTING COMPARISON:');
    
    // Get utility expenses
    const utilityExpenses = await db.query(
      `SELECT 
        SUM(CASE WHEN expense_type = 'electricity' THEN amount ELSE 0 END) as electricity,
        SUM(CASE WHEN expense_type = 'water' THEN amount ELSE 0 END) as water
       FROM transactions
       WHERE EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)
       AND expense_type IN ('electricity', 'water')`
    );
    
    // Get utility reimbursements
    const utilityReimbursements = await db.query(
      `SELECT 
        SUM(amount) as total_reimbursements
       FROM transactions
       WHERE name LIKE '%Utility Payment%'
       AND expense_type = 'rent'
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    
    const elec = parseFloat(utilityExpenses.rows[0].electricity || 0);
    const water = parseFloat(utilityExpenses.rows[0].water || 0);
    const reimb = parseFloat(utilityReimbursements.rows[0].total_reimbursements || 0);
    
    console.log('\n  Current Method (inflated):');
    console.log(`    Electricity expense: $${elec.toFixed(2)}`);
    console.log(`    Water expense: $${water.toFixed(2)}`);
    console.log(`    Total utility expense: $${(elec + water).toFixed(2)}`);
    console.log(`    Utility reimbursements (as revenue): $${reimb.toFixed(2)}`);
    console.log(`    → Shows as: $${(elec + water).toFixed(2)} expenses + $${reimb.toFixed(2)} revenue`);
    
    console.log('\n  Optimal Method (net):');
    console.log(`    Total utility bills: $${(elec + water).toFixed(2)}`);
    console.log(`    Less: Roommate share: -$${reimb.toFixed(2)}`);
    console.log(`    → Net utility expense: $${(elec + water - reimb).toFixed(2)}`);
    
    // 4. Revenue analysis
    console.log('\n\n4. REVENUE ANALYSIS:');
    const revenueBreakdown = await db.query(
      `SELECT 
        SUM(CASE WHEN name LIKE '%Utility Payment%' THEN amount ELSE 0 END) as utility_reimb,
        SUM(CASE WHEN name NOT LIKE '%Utility Payment%' THEN amount ELSE 0 END) as base_rent,
        SUM(amount) as total
       FROM transactions
       WHERE expense_type = 'rent'
       AND EXTRACT(YEAR FROM date) = EXTRACT(YEAR FROM CURRENT_DATE)`
    );
    
    console.log(`\n  Current "Revenue" breakdown:`);
    console.log(`    Base rent: $${parseFloat(revenueBreakdown.rows[0].base_rent).toFixed(2)}`);
    console.log(`    Utility reimbursements: $${parseFloat(revenueBreakdown.rows[0].utility_reimb).toFixed(2)}`);
    console.log(`    Total shown as revenue: $${parseFloat(revenueBreakdown.rows[0].total).toFixed(2)}`);
    
    console.log(`\n  ⚠️  True rental revenue is only: $${parseFloat(revenueBreakdown.rows[0].base_rent).toFixed(2)}`);
    console.log(`     Utility reimbursements are expense reductions, not revenue`);
    
    // 5. Recommendations
    console.log('\n\n5. RECOMMENDATIONS:');
    console.log('\n  Option A: Net Method (Recommended)');
    console.log('    - Don\'t create revenue transactions for utility payments');
    console.log('    - Instead, reduce the utility expense by the reimbursement amount');
    console.log('    - Shows true net cost of utilities');
    console.log('    - More accurate P&L representation');
    
    console.log('\n  Option B: Gross Method (Current)');
    console.log('    - Continue showing full expenses and reimbursements as revenue');
    console.log('    - But classify reimbursements differently (not as "rent")');
    console.log('    - Add a new category like "utility_reimbursement"');
    console.log('    - Helps track cash flow but inflates both revenue and expenses');
    
    console.log('\n  Option C: Add transaction_type field');
    console.log('    - Add field to distinguish income vs expense transactions');
    console.log('    - Keep detailed categorization for both');
    console.log('    - Most flexible but requires schema changes');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

analyzeSystemSetup();