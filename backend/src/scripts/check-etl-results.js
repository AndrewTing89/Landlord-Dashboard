const db = require('../db/connection');

async function checkETLResults() {
  try {
    console.log('🔍 ETL Pipeline Results:\n');
    
    // Check raw transactions
    const rawCount = await db.getOne(
      'SELECT COUNT(*) as count FROM raw_transactions'
    );
    console.log(`📥 Total raw transactions: ${rawCount.count}`);
    
    // Check excluded transactions
    const excluded = await db.query(
      `SELECT description, exclude_reason, amount 
       FROM raw_transactions 
       WHERE excluded = true 
       ORDER BY posted_date DESC 
       LIMIT 5`
    );
    console.log(`\n🚫 Excluded transactions: ${excluded.rows.length}`);
    excluded.rows.forEach(t => {
      console.log(`  - ${t.description} ($${Math.abs(t.amount)}) - Reason: ${t.exclude_reason}`);
    });
    
    // Check auto-approved transactions
    const autoApproved = await db.query(
      `SELECT description, suggested_expense_type, amount 
       FROM raw_transactions 
       WHERE processed = true AND excluded = false 
       ORDER BY posted_date DESC 
       LIMIT 5`
    );
    console.log(`\n✅ Auto-approved transactions: ${autoApproved.rows.length}`);
    autoApproved.rows.forEach(t => {
      console.log(`  - ${t.description} ($${Math.abs(t.amount)}) - Type: ${t.suggested_expense_type}`);
    });
    
    // Check pending review
    const pending = await db.query(
      `SELECT description, suggested_expense_type, confidence_score, amount 
       FROM raw_transactions 
       WHERE processed = false AND excluded = false 
       ORDER BY posted_date DESC 
       LIMIT 5`
    );
    console.log(`\n⏳ Pending review: ${pending.rows.length}`);
    pending.rows.forEach(t => {
      console.log(`  - ${t.description} ($${Math.abs(t.amount)}) - Suggested: ${t.suggested_expense_type} (${t.confidence_score * 100}% confidence)`);
    });
    
    // Check main transactions table
    const mainCount = await db.getOne(
      'SELECT COUNT(*) as count FROM transactions'
    );
    console.log(`\n📊 Transactions in main table: ${mainCount.count}`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkETLResults();