const db = require('../db/connection');

async function showBusinessImpact() {
  try {
    console.log('🏠 PROPERTY BUSINESS ANALYSIS - Impact of Filtering\n');
    console.log('=' .repeat(60));
    
    // Get all transactions summary
    const allStats = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN expense_type = 'rent' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN expense_type != 'rent' THEN amount ELSE 0 END) as total_expenses_all,
        SUM(CASE WHEN expense_type = 'other' THEN amount ELSE 0 END) as personal_expenses
      FROM transactions
      WHERE date >= '2024-01-01'
    `);
    
    const all = allStats.rows[0];
    
    // Get property-only stats
    const propStats = await db.query(`
      SELECT 
        COUNT(*) as total_count,
        SUM(CASE WHEN expense_type = 'rent' THEN amount ELSE 0 END) as total_revenue,
        SUM(CASE WHEN expense_type NOT IN ('rent', 'other') THEN amount ELSE 0 END) as total_expenses
      FROM transactions
      WHERE date >= '2024-01-01'
        AND expense_type != 'other'
    `);
    
    const prop = propStats.rows[0];
    
    console.log('\n📊 ALL TRANSACTIONS (including personal):');
    console.log(`  Total transactions: ${all.total_count}`);
    console.log(`  Revenue (rent): $${parseFloat(all.total_revenue).toFixed(2)}`);
    console.log(`  All expenses: $${parseFloat(all.total_expenses_all).toFixed(2)}`);
    console.log(`  Net income: $${(parseFloat(all.total_revenue) - parseFloat(all.total_expenses_all)).toFixed(2)}`);
    
    console.log('\n🏠 PROPERTY-ONLY TRANSACTIONS:');
    console.log(`  Total transactions: ${prop.total_count}`);
    console.log(`  Revenue (rent): $${parseFloat(prop.total_revenue).toFixed(2)}`);
    console.log(`  Property expenses: $${parseFloat(prop.total_expenses).toFixed(2)}`);
    console.log(`  Net income: $${(parseFloat(prop.total_revenue) - parseFloat(prop.total_expenses)).toFixed(2)}`);
    
    console.log('\n💰 DIFFERENCE:');
    console.log(`  Personal expenses excluded: $${parseFloat(all.personal_expenses).toFixed(2)}`);
    console.log(`  Transactions excluded: ${all.total_count - prop.total_count}`);
    console.log(`  Net income improvement: $${parseFloat(all.personal_expenses).toFixed(2)}`);
    
    // Show expense breakdown
    console.log('\n📈 PROPERTY EXPENSE BREAKDOWN:');
    const breakdown = await db.query(`
      SELECT 
        expense_type,
        COUNT(*) as count,
        SUM(amount) as total,
        ROUND(100.0 * SUM(amount) / NULLIF((
          SELECT SUM(amount) 
          FROM transactions 
          WHERE expense_type NOT IN ('rent', 'other')
            AND date >= '2024-01-01'
        ), 0), 1) as percentage
      FROM transactions
      WHERE expense_type NOT IN ('rent', 'other')
        AND date >= '2024-01-01'
      GROUP BY expense_type
      ORDER BY total DESC
    `);
    
    breakdown.rows.forEach(row => {
      console.log(`  ${row.expense_type}: $${parseFloat(row.total).toFixed(2)} (${row.percentage}%) - ${row.count} transactions`);
    });
    
    // Personal expenses breakdown
    console.log('\n🚫 EXCLUDED PERSONAL EXPENSES:');
    const personal = await db.query(`
      SELECT 
        name,
        amount,
        date
      FROM transactions
      WHERE expense_type = 'other'
        AND date >= '2024-01-01'
      ORDER BY amount DESC
      LIMIT 10
    `);
    
    console.log('  Top 10 personal expenses being excluded:');
    personal.rows.forEach((row, i) => {
      console.log(`  ${i+1}. $${row.amount} - ${row.name.substring(0, 50)}... (${row.date.toISOString().split('T')[0]})`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

showBusinessImpact();