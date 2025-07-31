const db = require('../db/connection');

async function checkImportSummary() {
  try {
    console.log('📊 Bank of America Import Summary\n');
    
    // Overall stats
    const stats = await db.getOne(`
      SELECT 
        COUNT(*) as total_transactions,
        COUNT(DISTINCT DATE_TRUNC('month', posted_date)) as months_covered,
        MIN(posted_date) as earliest_date,
        MAX(posted_date) as latest_date,
        SUM(CASE WHEN amount > 0 THEN ABS(amount) ELSE 0 END) as total_income,
        SUM(CASE WHEN amount < 0 THEN ABS(amount) ELSE 0 END) as total_expenses
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
    `);
    
    console.log(`Total Imported: ${stats.total_transactions} transactions`);
    console.log(`Date Range: ${stats.earliest_date?.toLocaleDateString()} to ${stats.latest_date?.toLocaleDateString()}`);
    console.log(`Months Covered: ${stats.months_covered}`);
    console.log(`Total Income: $${parseFloat(stats.total_income || 0).toFixed(2)}`);
    console.log(`Total Expenses: $${parseFloat(stats.total_expenses || 0).toFixed(2)}`);
    
    // By category
    const byCategory = await db.query(`
      SELECT 
        COALESCE(suggested_expense_type, 'other') as category,
        COUNT(*) as count,
        SUM(ABS(amount)) as total
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
        AND excluded = false
      GROUP BY suggested_expense_type
      ORDER BY total DESC
    `);
    
    console.log('\n📂 By Category:');
    byCategory.rows.forEach(row => {
      console.log(`  ${row.category}: ${row.count} transactions - $${parseFloat(row.total).toFixed(2)}`);
    });
    
    // Auto-approved transactions
    const autoApproved = await db.getOne(`
      SELECT COUNT(*) as count
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
        AND processed = true
        AND excluded = false
    `);
    
    console.log(`\n✅ Auto-approved: ${autoApproved.count} transactions`);
    
    // Excluded transactions
    const excluded = await db.getOne(`
      SELECT COUNT(*) as count
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
        AND excluded = true
    `);
    
    console.log(`🚫 Excluded: ${excluded.count} transactions`);
    
    // Pending review
    const pending = await db.getOne(`
      SELECT COUNT(*) as count
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
        AND processed = false
        AND excluded = false
    `);
    
    console.log(`⏳ Pending Review: ${pending.count} transactions`);
    
    // Check for property tax
    const propertyTax = await db.query(`
      SELECT posted_date, description, amount
      FROM raw_transactions
      WHERE simplefin_account_id = 'bofa_import'
        AND (suggested_expense_type = 'property_tax' 
             OR LOWER(description) LIKE '%county%'
             OR LOWER(description) LIKE '%tax%')
      ORDER BY posted_date
    `);
    
    if (propertyTax.rows.length > 0) {
      console.log('\n🏛️ Property Tax Transactions Found:');
      propertyTax.rows.forEach(row => {
        console.log(`  ${row.posted_date.toLocaleDateString()}: ${row.description.substring(0, 50)}... ($${Math.abs(row.amount)})`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkImportSummary();