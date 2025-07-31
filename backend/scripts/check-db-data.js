const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
});

async function checkData() {
  try {
    // Check if we can connect
    await pool.query('SELECT NOW()');
    console.log('✅ Database connection successful\n');
    
    // List all tables
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    console.log('📋 Tables found:', tables.rows.map(r => r.table_name).join(', '));
    console.log('\n📊 Data counts:');
    
    // Check key tables for data
    const checks = [
      'SELECT COUNT(*) as count FROM payment_requests',
      'SELECT COUNT(*) as count FROM venmo_emails',
      'SELECT COUNT(*) as count FROM gmail_credentials',
      'SELECT COUNT(*) as count FROM utilities_categorized',
      'SELECT COUNT(*) as count FROM utility_bills',
      'SELECT COUNT(*) as count FROM transactions',
      'SELECT COUNT(*) as count FROM accounts'
    ];
    
    for (const query of checks) {
      try {
        const result = await pool.query(query);
        const tableName = query.match(/FROM (\w+)/)[1];
        console.log(`  ${tableName}: ${result.rows[0].count} rows`);
      } catch (e) {
        // Table might not exist
      }
    }
    
    // Check recent payment requests
    try {
      const recentRequests = await pool.query(`
        SELECT created_at, utility_type, total_amount, payment_status 
        FROM payment_requests 
        ORDER BY created_at DESC 
        LIMIT 5
      `);
      if (recentRequests.rows.length > 0) {
        console.log('\n📝 Recent payment requests:');
        recentRequests.rows.forEach(req => {
          console.log(`  ${req.created_at.toISOString().split('T')[0]} - ${req.utility_type}: $${req.total_amount} (${req.payment_status})`);
        });
      }
    } catch (e) {
      // Table might not exist
    }
    
    await pool.end();
  } catch (error) {
    console.error('❌ Database connection error:', error.message);
    console.error('Make sure Docker is running: docker-compose up -d');
  }
}

checkData();