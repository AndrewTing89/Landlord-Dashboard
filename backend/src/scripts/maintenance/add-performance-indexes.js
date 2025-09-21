#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');

async function addPerformanceIndexes() {
  try {
    console.log('Adding performance indexes to database...\n');
    
    const indexes = [
      {
        name: 'idx_transactions_date_type',
        table: 'expenses',
        columns: '(date, expense_type)',
        description: 'Speed up date range and expense type queries'
      },
      {
        name: 'idx_transactions_expense_type',
        table: 'expenses',
        columns: '(expense_type)',
        description: 'Speed up expense type filtering'
      },
      {
        name: 'idx_raw_transactions_processed',
        table: 'raw_transactions',
        columns: '(processed, excluded, posted_date)',
        description: 'Speed up pending transaction queries'
      },
      {
        name: 'idx_payment_requests_status_date',
        table: 'payment_requests',
        columns: '(status, created_at)',
        description: 'Speed up payment request status queries'
      },
      {
        name: 'idx_payment_requests_month_year',
        table: 'payment_requests',
        columns: '(year, month)',
        description: 'Speed up monthly payment request queries'
      },
      {
        name: 'idx_sync_history_status',
        table: 'sync_history',
        columns: '(status, started_at)',
        description: 'Speed up sync status queries'
      },
      {
        name: 'idx_utility_bills_month_year',
        table: 'utility_bills',
        columns: '(year, month, bill_type)',
        description: 'Speed up utility bill lookups'
      }
    ];
    
    let created = 0;
    let skipped = 0;
    
    for (const index of indexes) {
      try {
        // Check if index exists
        const exists = await db.query(
          `SELECT 1 FROM pg_indexes 
           WHERE schemaname = 'public' 
           AND indexname = $1`,
          [index.name]
        );
        
        if (exists.rows.length > 0) {
          console.log(`⏭️  Index ${index.name} already exists, skipping`);
          skipped++;
          continue;
        }
        
        // Create index
        console.log(`📊 Creating index: ${index.name}`);
        console.log(`   Table: ${index.table}`);
        console.log(`   Columns: ${index.columns}`);
        console.log(`   Purpose: ${index.description}`);
        
        await db.query(
          `CREATE INDEX CONCURRENTLY ${index.name} ON ${index.table} ${index.columns}`
        );
        
        console.log(`   ✅ Created successfully\n`);
        created++;
        
      } catch (error) {
        console.error(`   ❌ Failed to create ${index.name}: ${error.message}\n`);
      }
    }
    
    // Analyze tables to update statistics
    console.log('🔄 Analyzing tables to update statistics...');
    const tables = ['expenses', 'raw_transactions', 'payment_requests', 'sync_history', 'utility_bills'];
    
    for (const table of tables) {
      try {
        await db.query(`ANALYZE ${table}`);
        console.log(`   ✅ Analyzed ${table}`);
      } catch (error) {
        console.error(`   ❌ Failed to analyze ${table}: ${error.message}`);
      }
    }
    
    console.log(`\n📊 Index creation summary:`);
    console.log(`   - Created: ${created}`);
    console.log(`   - Skipped: ${skipped}`);
    console.log(`   - Total: ${indexes.length}`);
    
    // Show current indexes
    const currentIndexes = await db.query(
      `SELECT 
        schemaname,
        tablename,
        indexname,
        pg_size_pretty(pg_relation_size(indexname::regclass)) as size
       FROM pg_indexes 
       WHERE schemaname = 'public' 
       AND tablename IN ('expenses', 'raw_transactions', 'payment_requests', 'sync_history', 'utility_bills')
       ORDER BY tablename, indexname`
    );
    
    console.log('\n📋 Current indexes:');
    let currentTable = '';
    currentIndexes.rows.forEach(idx => {
      if (idx.tablename !== currentTable) {
        currentTable = idx.tablename;
        console.log(`\n   ${currentTable}:`);
      }
      console.log(`     - ${idx.indexname} (${idx.size})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await db.close();
  }
}

addPerformanceIndexes();