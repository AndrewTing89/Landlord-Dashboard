#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function addColumns() {
  console.log('Adding missing columns to payment_requests table...');
  
  try {
    // Add transaction_id column if it doesn't exist
    await db.query(`
      ALTER TABLE payment_requests 
      ADD COLUMN IF NOT EXISTS transaction_id INTEGER
    `);
    console.log('✅ Added transaction_id column');
    
    // Add company_name column if it doesn't exist
    await db.query(`
      ALTER TABLE payment_requests 
      ADD COLUMN IF NOT EXISTS company_name VARCHAR(255)
    `);
    console.log('✅ Added company_name column');
    
    // Add total_amount column if it doesn't exist
    await db.query(`
      ALTER TABLE payment_requests 
      ADD COLUMN IF NOT EXISTS total_amount DECIMAL(10, 2)
    `);
    console.log('✅ Added total_amount column');
    
    console.log('All columns added successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Error adding columns:', error);
    process.exit(1);
  }
}

addColumns();