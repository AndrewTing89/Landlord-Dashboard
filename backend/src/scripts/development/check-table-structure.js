#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function checkTableStructure() {
  try {
    console.log('Checking raw_transactions table structure...\n');
    
    const columns = await db.query(
      `SELECT column_name, data_type 
       FROM information_schema.columns 
       WHERE table_name = 'raw_transactions'
       ORDER BY ordinal_position`
    );
    
    console.log('Columns in raw_transactions:');
    columns.rows.forEach(col => {
      console.log(`  - ${col.column_name} (${col.data_type})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

checkTableStructure();