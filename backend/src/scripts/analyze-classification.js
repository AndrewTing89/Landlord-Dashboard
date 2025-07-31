const db = require('../db/connection');

async function analyzeClassification() {
  try {
    console.log('🔍 TRANSACTION CLASSIFICATION ANALYSIS\n');
    console.log('=' .repeat(60));
    
    // 1. Show the classification flow
    console.log('\n📋 HOW CLASSIFICATION WORKS:');
    console.log('1. New transactions go to raw_transactions table');
    console.log('2. ETL rules are applied based on patterns (description, payee, amount)');
    console.log('3. Matched transactions get suggested_expense_type');
    console.log('4. High-confidence matches (priority 100+) are auto-approved');
    console.log('5. Others need manual review before moving to main transactions table\n');
    
    // 2. Current ETL rule coverage
    console.log('📊 CURRENT ETL RULES COVERAGE:\n');
    const rules = await db.query(`
      SELECT 
        expense_type,
        COUNT(*) as rule_count,
        STRING_AGG(rule_name, ', ') as rules
      FROM etl_rules 
      WHERE active = true AND action = 'categorize'
      GROUP BY expense_type
      ORDER BY expense_type
    `);
    
    rules.rows.forEach(row => {
      console.log(`${row.expense_type}: ${row.rule_count} rules`);
      console.log(`  Rules: ${row.rules}`);
    });
    
    // 3. Show what's NOT being caught
    console.log('\n❌ TRANSACTIONS NOT MATCHING ANY RULES:\n');
    const uncategorized = await db.query(`
      SELECT 
        COUNT(*) as count,
        SUM(ABS(amount)) as total,
        MIN(posted_date) as earliest,
        MAX(posted_date) as latest
      FROM raw_transactions 
      WHERE suggested_expense_type IS NULL 
        AND excluded = false
    `);
    
    const uncat = uncategorized.rows[0];
    console.log(`Total uncategorized: ${uncat.count} transactions`);
    console.log(`Total amount: $${parseFloat(uncat.total || 0).toFixed(2)}`);
    console.log(`Date range: ${uncat.earliest?.toLocaleDateString() || 'N/A'} to ${uncat.latest?.toLocaleDateString() || 'N/A'}`);
    
    // 4. Sample uncategorized transactions
    console.log('\nSample uncategorized transactions:');
    const samples = await db.query(`
      SELECT posted_date, amount, description 
      FROM raw_transactions 
      WHERE suggested_expense_type IS NULL 
        AND excluded = false
      ORDER BY ABS(amount) DESC
      LIMIT 10
    `);
    
    samples.rows.forEach(tx => {
      console.log(`  ${tx.posted_date.toISOString().split('T')[0]} | $${tx.amount.toString().padStart(8)} | ${tx.description.substring(0, 50)}...`);
    });
    
    // 5. Common patterns in uncategorized
    console.log('\n🔍 COMMON PATTERNS IN UNCATEGORIZED:\n');
    const patterns = await db.query(`
      SELECT 
        CASE 
          WHEN description LIKE '%ZELLE%' THEN 'Zelle transfers'
          WHEN description LIKE '%ATM%' THEN 'ATM withdrawals'
          WHEN description LIKE '%CHECK%' THEN 'Checks'
          WHEN description LIKE '%TRANSFER%' THEN 'Bank transfers'
          WHEN description LIKE '%CASH%' THEN 'Cash transactions'
          WHEN description LIKE '%APPLE%' THEN 'Apple Pay/Cash'
          WHEN description LIKE '%PAYPAL%' THEN 'PayPal'
          WHEN description LIKE '%AMAZON%' THEN 'Amazon'
          WHEN description LIKE '%GOOGLE%' THEN 'Google'
          ELSE 'Other'
        END as pattern,
        COUNT(*) as count,
        SUM(ABS(amount)) as total
      FROM raw_transactions 
      WHERE suggested_expense_type IS NULL 
        AND excluded = false
      GROUP BY pattern
      ORDER BY count DESC
    `);
    
    patterns.rows.forEach(row => {
      console.log(`${row.pattern}: ${row.count} transactions - $${parseFloat(row.total).toFixed(2)}`);
    });
    
    // 6. Recommendations
    console.log('\n💡 RECOMMENDATIONS:\n');
    console.log('1. Add rules for Zelle transfers (some might be rent/utilities)');
    console.log('2. Create exclude rules for ATM/Cash withdrawals');
    console.log('3. Add rules for common services (Amazon, PayPal, etc.)');
    console.log('4. Consider amount-based rules (e.g., large deposits = rent)');
    console.log('5. Build the review UI to manually categorize unknowns');
    
    // 7. Show gaps in rent detection
    console.log('\n🏠 RENT DETECTION ANALYSIS:\n');
    const rentGaps = await db.query(`
      SELECT 
        DATE_TRUNC('month', posted_date) as month,
        COUNT(*) as potential_rent,
        SUM(amount) as total
      FROM raw_transactions 
      WHERE amount > 1500 
        AND amount < 3500
        AND suggested_expense_type != 'rent'
        AND excluded = false
      GROUP BY DATE_TRUNC('month', posted_date)
      ORDER BY month DESC
    `);
    
    console.log('Months with potential missed rent (deposits $1500-$3500):');
    rentGaps.rows.forEach(row => {
      console.log(`  ${row.month.toISOString().substring(0, 7)}: ${row.potential_rent} transactions - $${parseFloat(row.total).toFixed(2)}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

analyzeClassification();