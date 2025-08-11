require('dotenv').config({ path: './Landlord-Dashboard/backend/.env' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard'
});

async function checkBills() {
  try {
    console.log('=== Checking July-August 2024 Bills ===\n');
    
    // Check all expenses for July-August
    const allExpenses = await pool.query(`
      SELECT date, merchant_name, amount, expense_type
      FROM expenses 
      WHERE date >= '2024-07-01' AND date <= '2024-08-31'
      ORDER BY date DESC
    `);
    
    console.log(`Total expenses in July-August: ${allExpenses.rows.length}\n`);
    
    // Look for utility-like transactions
    console.log('Potential utility bills (by merchant name):');
    const utilityLike = allExpenses.rows.filter(e => 
      e.merchant_name?.toLowerCase().includes('water') ||
      e.merchant_name?.toLowerCase().includes('great oaks') ||
      e.merchant_name?.toLowerCase().includes('pg&e') ||
      e.merchant_name?.toLowerCase().includes('pge') ||
      e.merchant_name?.toLowerCase().includes('pacific gas') ||
      e.merchant_name?.toLowerCase().includes('electric')
    );
    
    utilityLike.forEach(e => {
      console.log(`  ${e.date}: ${e.merchant_name} - $${e.amount} [Type: ${e.expense_type}]`);
    });
    
    if (utilityLike.length === 0) {
      console.log('  ❌ No utility-like transactions found by merchant name\n');
    }
    
    // Check by expense_type
    console.log('\nTransactions classified as utilities:');
    const utilityTypes = allExpenses.rows.filter(e => 
      e.expense_type === 'electricity' || 
      e.expense_type === 'water' ||
      e.expense_type === 'utilities'
    );
    
    utilityTypes.forEach(e => {
      console.log(`  ${e.date}: ${e.merchant_name} - $${e.amount} [${e.expense_type}]`);
    });
    
    if (utilityTypes.length === 0) {
      console.log('  ❌ No transactions classified as electricity/water/utilities\n');
    }
    
    // Check payment requests
    console.log('\nPayment requests for July-August:');
    const paymentRequests = await pool.query(`
      SELECT month, year, bill_type, merchant_name, total_amount, status
      FROM payment_requests
      WHERE (month = 7 OR month = 8) AND year = 2024
      ORDER BY month, bill_type
    `);
    
    paymentRequests.rows.forEach(p => {
      console.log(`  ${p.month}/2024 ${p.bill_type}: ${p.merchant_name} - $${p.total_amount} [${p.status}]`);
    });
    
    if (paymentRequests.rows.length === 0) {
      console.log('  ❌ No payment requests found for July-August\n');
    }
    
    // Check raw_transactions for utility bills
    console.log('\nRaw transactions (unprocessed) with utility keywords:');
    const rawUtilities = await pool.query(`
      SELECT date, description, amount, processed
      FROM raw_transactions
      WHERE date >= '2024-07-01' AND date <= '2024-08-31'
        AND (
          description ILIKE '%water%' OR
          description ILIKE '%great oaks%' OR
          description ILIKE '%pg&e%' OR
          description ILIKE '%pge%' OR
          description ILIKE '%pacific gas%' OR
          description ILIKE '%electric%'
        )
      ORDER BY date DESC
    `);
    
    rawUtilities.rows.forEach(r => {
      console.log(`  ${r.date}: ${r.description} - $${r.amount} [Processed: ${r.processed}]`);
    });
    
    if (rawUtilities.rows.length === 0) {
      console.log('  ❌ No raw utility transactions found\n');
    }
    
    // Check ETL rules
    console.log('\nActive ETL rules for utilities:');
    const etlRules = await pool.query(`
      SELECT rule_name, description_pattern, expense_type, priority
      FROM etl_rules
      WHERE active = true
        AND (expense_type IN ('electricity', 'water', 'utilities')
          OR description_pattern ILIKE '%water%'
          OR description_pattern ILIKE '%pg%'
          OR description_pattern ILIKE '%electric%')
      ORDER BY priority DESC
    `);
    
    etlRules.rows.forEach(r => {
      console.log(`  ${r.rule_name}: "${r.description_pattern}" -> ${r.expense_type} (priority: ${r.priority})`);
    });
    
    if (etlRules.rows.length === 0) {
      console.log('  ❌ No ETL rules found for utilities\n');
    }
    
    await pool.end();
  } catch (err) {
    console.error('Error:', err.message);
    await pool.end();
  }
}

checkBills();