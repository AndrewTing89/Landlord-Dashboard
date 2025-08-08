#!/usr/bin/env node

const { Pool } = require('pg');
require('dotenv').config();

async function checkColumns() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  try {
    const result = await pool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'payment_requests'
      ORDER BY ordinal_position
    `);
    
    console.log('Columns in payment_requests table:');
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}`);
    });
    
    await pool.end();
  } catch (error) {
    console.error('Error:', error);
    await pool.end();
  }
}

checkColumns();