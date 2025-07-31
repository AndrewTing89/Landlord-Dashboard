const db = require('../db/connection');

async function fixPatterns() {
  try {
    console.log('Fixing ETL rule patterns for JavaScript compatibility...\n');
    
    // Update patterns to remove (?i) and rely on case-insensitive flag in code
    const updates = [
      { id: 1, pattern: '(pg&e|pacific gas|pge)' },
      { id: 2, pattern: '(great oaks|water)' },
      { id: 4, pattern: '(home depot|lowes|repair|maintenance)' },
      { id: 5, pattern: 'amazon' },
      { id: 6, pattern: '(starbucks|mcdonald|restaurant|food)' }
    ];
    
    for (const update of updates) {
      await db.query(
        'UPDATE etl_rules SET description_pattern = $1 WHERE id = $2',
        [update.pattern, update.id]
      );
    }
    
    console.log('✅ Fixed regex patterns');
    
    // Add a rule for Venmo rent payments
    await db.query(
      `INSERT INTO etl_rules (rule_name, rule_type, priority, description_pattern, action, expense_type)
       VALUES ('Venmo Rent Cashout', 'categorize', 95, 'venmo.*cashout', 'categorize', 'rent')`
    );
    
    console.log('✅ Added Venmo rent rule');
    
    // Clear raw_transactions to resync with fixed rules
    await db.query('DELETE FROM raw_transactions');
    console.log('✅ Cleared raw_transactions for fresh sync');
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

fixPatterns();