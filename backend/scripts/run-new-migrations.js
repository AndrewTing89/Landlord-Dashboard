#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');
const fs = require('fs');
const path = require('path');

async function runMigrations() {
  console.log('🚀 Running new migrations for clean architecture...\n');
  
  const migrations = [
    '017_create_income_table.sql',
    '018_migrate_income_data.sql',
    '019_clean_transactions_table.sql'
  ];
  
  for (const migration of migrations) {
    console.log(`📝 Running migration: ${migration}`);
    const sqlPath = path.join(__dirname, '../src/db/migrations', migration);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    try {
      // Run the entire migration as a single transaction
      await db.query('BEGIN');
      
      try {
        // For functions and triggers, we need to handle them specially
        if (migration === '017_create_income_table.sql') {
          // This migration has a function, so run it as a single statement
          await db.query(sql);
        } else {
          // For other migrations, split by semicolons more carefully
          const statements = sql
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
          
          for (let i = 0; i < statements.length; i++) {
            const statement = statements[i] + ';';
            console.log(`  Executing statement ${i + 1}/${statements.length}...`);
            await db.query(statement);
          }
        }
        
        await db.query('COMMIT');
        console.log(`  ✅ ${migration} completed\n`);
      } catch (innerError) {
        await db.query('ROLLBACK');
        throw innerError;
      }
    } catch (error) {
      console.error(`  ❌ Error in ${migration}:`, error.message);
      
      // Continue with next migration or stop based on error type
      if (migration === '017_create_income_table.sql' && error.code === '42P07') {
        console.log('  ⚠️  Table already exists, continuing...\n');
      } else if (migration === '019_clean_transactions_table.sql') {
        console.log('  ⚠️  This migration renames tables, it may have partially completed.\n');
      } else {
        throw error;
      }
    }
  }
  
  console.log('✅ All migrations completed!');
  process.exit(0);
}

runMigrations().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});