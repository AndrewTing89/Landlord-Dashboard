const { Pool } = require('pg');
const fs = require('fs');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function createCompleteBackup() {
  console.log('🚀 CREATING COMPLETE DATABASE BACKUP WITH EXACT SCHEMA');
  console.log('=' .repeat(60));
  
  try {
    // First, verify the actual schema of critical tables
    console.log('\n📋 Verifying actual column names in database...\n');
    
    const criticalTables = ['expenses', 'income', 'payment_requests', 'raw_transactions'];
    for (const tableName of criticalTables) {
      const cols = await pool.query(`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = $1 AND table_schema = 'public'
        ORDER BY ordinal_position
      `, [tableName]);
      
      console.log(`${tableName} actual columns:`);
      cols.rows.forEach(c => {
        console.log(`  - ${c.column_name} (${c.data_type})${c.is_nullable === 'NO' ? ' NOT NULL' : ''}`);
      });
      console.log();
    }
    
    // Get all tables in proper dependency order (simplified)
    console.log('Analyzing table dependencies...\n');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY 
        CASE table_name
          -- Base tables with no dependencies
          WHEN 'etl_rules' THEN 0
          WHEN 'expense_categories' THEN 0
          WHEN 'properties' THEN 0
          WHEN 'tenants' THEN 0
          WHEN 'gmail_sync_state' THEN 0
          WHEN 'job_runs' THEN 0
          
          -- Raw data tables
          WHEN 'raw_transactions' THEN 1
          
          -- Expense related
          WHEN 'expenses' THEN 2
          WHEN 'utility_bills' THEN 3
          WHEN 'maintenance_tickets' THEN 3
          
          -- Payment tables
          WHEN 'payment_requests' THEN 4
          WHEN 'venmo_emails' THEN 4
          WHEN 'venmo_payment_requests' THEN 4
          
          -- Income (depends on payment_requests)
          WHEN 'income' THEN 5
          
          -- Tenant tables
          WHEN 'tenant_sessions' THEN 6
          WHEN 'tenant_activity_log' THEN 6
          WHEN 'tenant_documents' THEN 6
          WHEN 'tenant_notifications' THEN 6
          WHEN 'maintenance_requests' THEN 6
          
          -- Others
          ELSE 7
        END,
        table_name
    `);
    
    console.log(`Found ${tables.rows.length} tables\n`);
    console.log('=' .repeat(60));
    console.log('Creating backup...\n');

    let sqlBackup = `-- Landlord Dashboard Complete Database Backup
-- Created: ${new Date().toISOString()}
-- This backup preserves EXACT column names and schema from the current database
-- Compatible with the clean architecture (income/expenses split, NO transactions table)

BEGIN;
SET CONSTRAINTS ALL DEFERRED;

-- Drop all existing tables in reverse dependency order
`;

    // Drop tables in reverse order
    const tableList = tables.rows.map(r => r.table_name);
    for (let i = tableList.length - 1; i >= 0; i--) {
      sqlBackup += `DROP TABLE IF EXISTS ${tableList[i]} CASCADE;\n`;
    }
    sqlBackup += '\n';

    // Create each table with exact schema
    let totalRows = 0;
    const tableStats = [];
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`Processing ${tableName}...`);
      
      // Get complete column information
      const columns = await pool.query(`
        SELECT 
          c.column_name,
          c.data_type,
          c.character_maximum_length,
          c.numeric_precision,
          c.numeric_scale,
          c.is_nullable,
          c.column_default,
          c.udt_name
        FROM information_schema.columns c
        WHERE c.table_name = $1 
        AND c.table_schema = 'public'
        ORDER BY c.ordinal_position
      `, [tableName]);
      
      sqlBackup += `-- Table: ${tableName}\n`;
      sqlBackup += `CREATE TABLE ${tableName} (\n`;
      
      const columnDefs = [];
      for (const col of columns.rows) {
        let def = `  ${col.column_name} `;
        
        // Map data types correctly
        if (col.udt_name === 'varchar') {
          def += `VARCHAR${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`;
        } else if (col.udt_name === 'int4' && col.column_default && col.column_default.includes('nextval')) {
          def += 'SERIAL';
        } else if (col.udt_name === 'int8' && col.column_default && col.column_default.includes('nextval')) {
          def += 'BIGSERIAL';
        } else if (col.udt_name === 'int4') {
          def += 'INTEGER';
        } else if (col.udt_name === 'int8') {
          def += 'BIGINT';
        } else if (col.udt_name === 'numeric') {
          def += `NUMERIC${col.numeric_precision ? `(${col.numeric_precision},${col.numeric_scale || 0})` : '(10,2)'}`;
        } else if (col.udt_name === 'text') {
          def += 'TEXT';
        } else if (col.udt_name === 'bool') {
          def += 'BOOLEAN';
        } else if (col.udt_name === 'timestamp') {
          def += 'TIMESTAMP';
        } else if (col.udt_name === 'timestamptz') {
          def += 'TIMESTAMPTZ';
        } else if (col.udt_name === 'date') {
          def += 'DATE';
        } else if (col.udt_name === 'jsonb') {
          def += 'JSONB';
        } else if (col.udt_name === '_text') {
          def += 'TEXT[]';
        } else {
          def += col.data_type.toUpperCase();
        }
        
        // Add default if not serial
        if (col.column_default && !col.column_default.includes('nextval')) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        // Add NOT NULL constraint
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        columnDefs.push(def);
      }
      
      sqlBackup += columnDefs.join(',\n');
      
      // Add primary key constraint
      const pk = await pool.query(`
        SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu 
          ON tc.constraint_name = kcu.constraint_name
        WHERE tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      `, [tableName]);
      
      if (pk.rows.length > 0) {
        sqlBackup += `,\n  PRIMARY KEY (${pk.rows[0].column_name})`;
      }
      
      sqlBackup += '\n);\n';
      
      // Add foreign key constraints separately
      const fks = await pool.query(`
        SELECT
          tc.constraint_name,
          kcu.column_name,
          ccu.table_name AS foreign_table,
          ccu.column_name AS foreign_column
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
        WHERE tc.table_name = $1
        AND tc.constraint_type = 'FOREIGN KEY'
      `, [tableName]);
      
      for (const fk of fks.rows) {
        sqlBackup += `ALTER TABLE ${tableName} ADD CONSTRAINT ${fk.constraint_name} `;
        sqlBackup += `FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table}(${fk.foreign_column});\n`;
      }
      
      // Add CHECK constraints
      const checks = await pool.query(`
        SELECT 
          conname,
          pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass
        AND contype = 'c'
      `, [`public.${tableName}`]);
      
      for (const check of checks.rows) {
        sqlBackup += `ALTER TABLE ${tableName} ADD CONSTRAINT ${check.conname} ${check.definition};\n`;
      }
      
      // Add indexes
      const indexes = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = $1
        AND indexname NOT LIKE '%_pkey'
        AND indexname NOT IN (
          SELECT conname FROM pg_constraint WHERE conrelid = $2::regclass
        )
      `, [tableName, `public.${tableName}`]);
      
      for (const idx of indexes.rows) {
        sqlBackup += `${idx.indexdef};\n`;
      }
      
      sqlBackup += '\n';
      
      // Export data with exact column names
      const data = await pool.query(`SELECT * FROM ${tableName}`);
      
      if (data.rows.length > 0) {
        sqlBackup += `-- Data for ${tableName} (${data.rows.length} rows)\n`;
        
        // Get actual column names from the query result
        const actualColumns = Object.keys(data.rows[0]);
        
        for (const row of data.rows) {
          const values = actualColumns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (Array.isArray(val)) {
              if (val.length === 0) return "'{}'";
              return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
            }
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            
            // For string values, ensure proper formatting
            let strVal = String(val);
            // Ensure lowercase for enum-like fields
            if ((col === 'type' || col === 'category' || col === 'expense_type' || col === 'status') && tableName === 'expenses') {
              strVal = strVal.toLowerCase();
            }
            return `'${strVal.replace(/'/g, "''")}'`;
          });
          
          sqlBackup += `INSERT INTO ${tableName} (${actualColumns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        
        totalRows += data.rows.length;
        tableStats.push({ table: tableName, rows: data.rows.length });
        console.log(`  ✅ Exported ${data.rows.length} rows`);
        sqlBackup += '\n';
      } else {
        tableStats.push({ table: tableName, rows: 0 });
        console.log(`  ⚪ No data`);
      }
    }
    
    // Update sequences
    const sequences = await pool.query(`
      SELECT sequencename 
      FROM pg_sequences 
      WHERE schemaname = 'public'
    `);
    
    sqlBackup += '-- Reset sequences to correct values\n';
    for (const seq of sequences.rows) {
      const seqName = seq.sequencename;
      const tableName = seqName.replace('_id_seq', '').replace('_seq', '');
      
      // Check if table exists and has id column
      const hasTable = tableList.includes(tableName);
      if (hasTable) {
        const hasId = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.columns 
            WHERE table_name = $1 AND column_name = 'id'
          )
        `, [tableName]);
        
        if (hasId.rows[0].exists) {
          sqlBackup += `SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM ${tableName}), 1), true);\n`;
        }
      }
    }
    
    sqlBackup += `
-- Re-enable constraints
SET CONSTRAINTS ALL IMMEDIATE;
COMMIT;

-- =====================================================
-- BACKUP COMPLETE
-- Tables: ${tables.rows.length}
-- Total Records: ${totalRows}
-- =====================================================
-- Tables with data:
${tableStats.filter(t => t.rows > 0).map(t => `-- ${t.table}: ${t.rows} rows`).join('\n')}
-- =====================================================
`;

    // Save backup
    const filename = 'landlord_dashboard_complete_backup.sql';
    fs.writeFileSync(filename, sqlBackup);
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ COMPLETE BACKUP CREATED!');
    console.log('=' .repeat(60));
    console.log(`\n📁 File: ${filename}`);
    console.log(`📊 Size: ${(sqlBackup.length / 1024).toFixed(2)} KB`);
    console.log(`📈 Total records: ${totalRows}\n`);
    console.log('Key tables backed up:');
    tableStats.filter(t => t.rows > 0).forEach(t => {
      console.log(`  - ${t.table}: ${t.rows} records`);
    });
    console.log('\n✅ This backup preserves EXACT column names from your database');
    console.log('✅ Compatible with clean architecture (income/expenses split)');
    console.log('✅ Ready for restore on Ubuntu Server\n');
    
    pool.end();
    
  } catch (error) {
    console.error('\n❌ Backup failed:', error.message);
    console.error('Details:', error);
    pool.end();
    process.exit(1);
  }
}

createCompleteBackup();