const db = require('../db/connection');

async function checkTaxTransactions() {
  try {
    console.log('Searching for potential property tax transactions...\n');
    
    // Search for various tax-related patterns
    const patterns = [
      '%county%',
      '%tax%',
      '%santa clara%',
      '%property%',
      '%treasurer%'
    ];
    
    for (const pattern of patterns) {
      const result = await db.query(
        `SELECT DISTINCT description, COUNT(*) as count, SUM(ABS(amount)) as total
         FROM raw_transactions
         WHERE LOWER(description) LIKE $1
           AND amount < 0  -- Only expenses
         GROUP BY description
         ORDER BY count DESC
         LIMIT 5`,
        [pattern]
      );
      
      if (result.rows.length > 0) {
        console.log(`\n📌 Transactions containing "${pattern.replace(/%/g, '')}":`);
        result.rows.forEach(row => {
          console.log(`  ${row.count}x: ${row.description.substring(0, 80)}... ($${row.total})`);
        });
      }
    }
    
    // Also check main transactions table
    const mainTaxTransactions = await db.query(
      `SELECT expense_type, COUNT(*) as count, SUM(amount) as total
       FROM transactions
       WHERE expense_type = 'property_tax'
          OR LOWER(name) LIKE '%tax%'
          OR LOWER(name) LIKE '%county%'
       GROUP BY expense_type`
    );
    
    if (mainTaxTransactions.rows.length > 0) {
      console.log('\n💰 Tax-related transactions in main table:');
      mainTaxTransactions.rows.forEach(row => {
        console.log(`  ${row.expense_type}: ${row.count} transactions - $${row.total}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkTaxTransactions();