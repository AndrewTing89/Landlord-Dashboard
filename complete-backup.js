const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const backupDir = `deployment-backup-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
const backupPath = path.join(__dirname, backupDir);

// Ensure backup directory exists
if (!fs.existsSync(backupPath)) {
  fs.mkdirSync(backupPath, { recursive: true });
}

async function createCompleteBackup() {
  console.log('🔵 Creating COMPLETE database backup...');
  console.log(`📁 Backup directory: ${backupPath}\n`);
  
  let schemaSQL = '';
  let dataSQL = '';
  
  try {
    // First, get the complete schema using pg_dump equivalent queries
    console.log('📋 Exporting complete database schema...');
    
    // Get all sequences
    const sequences = await pool.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public'
    `);
    
    // Get all tables with their complete CREATE statements
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`Found ${tables.rows.length} tables to backup\n`);
    
    schemaSQL = `-- Landlord Dashboard Complete Database Backup
-- Created: ${new Date().toISOString()}
-- =====================================================

-- Drop all tables (CASCADE to handle foreign keys)
`;

    // Drop tables in reverse order to handle dependencies
    for (let i = tables.rows.length - 1; i >= 0; i--) {
      schemaSQL += `DROP TABLE IF EXISTS ${tables.rows[i].table_name} CASCADE;\n`;
    }
    
    schemaSQL += `\n-- Create all tables\n\n`;
    
    // Get actual CREATE TABLE statements with all constraints
    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`  📊 Processing table: ${tableName}`);
      
      // Get column definitions
      const columns = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' 
        AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      // Start CREATE TABLE
      schemaSQL += `-- Table: ${tableName}\n`;
      schemaSQL += `CREATE TABLE ${tableName} (\n`;
      
      // Add columns
      const columnDefs = [];
      for (const col of columns.rows) {
        let def = `  ${col.column_name} `;
        
        // Handle data type
        if (col.data_type === 'character varying') {
          def += `VARCHAR${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`;
        } else if (col.data_type === 'numeric') {
          def += `NUMERIC${col.numeric_precision ? `(${col.numeric_precision},${col.numeric_scale || 0})` : ''}`;
        } else if (col.data_type === 'ARRAY') {
          def += 'TEXT[]';
        } else {
          def += col.data_type.toUpperCase();
        }
        
        // Handle NOT NULL
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        // Handle defaults
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        
        columnDefs.push(def);
      }
      
      // Get constraints
      const constraints = await pool.query(`
        SELECT
          con.conname,
          con.contype,
          pg_get_constraintdef(con.oid) as definition
        FROM pg_constraint con
        JOIN pg_class rel ON rel.oid = con.conrelid
        WHERE rel.relname = $1
        AND con.contype IN ('p', 'f', 'c', 'u')
      `, [tableName]);
      
      // Add constraints to column definitions
      for (const constraint of constraints.rows) {
        if (constraint.contype === 'p') {
          columnDefs.push(`  CONSTRAINT ${constraint.conname} ${constraint.definition}`);
        } else if (constraint.contype === 'f') {
          columnDefs.push(`  CONSTRAINT ${constraint.conname} ${constraint.definition}`);
        } else if (constraint.contype === 'c') {
          columnDefs.push(`  CONSTRAINT ${constraint.conname} ${constraint.definition}`);
        } else if (constraint.contype === 'u') {
          columnDefs.push(`  CONSTRAINT ${constraint.conname} ${constraint.definition}`);
        }
      }
      
      schemaSQL += columnDefs.join(',\n');
      schemaSQL += '\n);\n\n';
      
      // Get indexes
      const indexes = await pool.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public'
        AND tablename = $1
        AND indexname NOT LIKE '%_pkey'
      `, [tableName]);
      
      for (const index of indexes.rows) {
        schemaSQL += `${index.indexdef};\n`;
      }
      
      if (indexes.rows.length > 0) {
        schemaSQL += '\n';
      }
    }
    
    // Now export all data
    console.log('\n📦 Exporting data from all tables...\n');
    
    dataSQL = `\n-- =====================================================
-- DATA SECTION
-- =====================================================\n\n`;
    
    let totalRows = 0;
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      // Get all data from table
      const data = await pool.query(`SELECT * FROM ${tableName}`);
      
      if (data.rows.length > 0) {
        console.log(`  ✅ ${tableName}: ${data.rows.length} rows`);
        totalRows += data.rows.length;
        
        dataSQL += `-- Data for table: ${tableName}\n`;
        
        // Get column names
        const columns = Object.keys(data.rows[0]);
        
        for (const row of data.rows) {
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (Array.isArray(val)) return `ARRAY[${val.map(v => `'${v}'`).join(',')}]`;
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          
          dataSQL += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        dataSQL += '\n';
      } else {
        console.log(`  ⚪ ${tableName}: empty`);
      }
    }
    
    // Reset sequences
    const sequenceSQL = `\n-- Reset sequences to correct values\n`;
    for (const seq of sequences.rows) {
      sequenceSQL + `SELECT setval('${seq.sequence_name}', (SELECT COALESCE(MAX(id), 1) FROM ${seq.sequence_name.replace('_id_seq', '')}));\n`;
    }
    
    // Combine everything
    const fullBackup = schemaSQL + dataSQL + sequenceSQL + `
-- =====================================================
-- Backup complete
-- Total tables: ${tables.rows.length}
-- Total rows: ${totalRows}
-- =====================================================
`;
    
    // Write backup file
    const backupFile = path.join(backupPath, 'complete_database_backup.sql');
    fs.writeFileSync(backupFile, fullBackup);
    
    console.log(`\n✅ Database backup complete!`);
    console.log(`  - Tables: ${tables.rows.length}`);
    console.log(`  - Total rows: ${totalRows}`);
    console.log(`  - File size: ${(fs.statSync(backupFile).size / 1024).toFixed(2)} KB`);
    
    // Copy environment files
    console.log('\n🔵 Copying environment files...');
    
    const filesToCopy = [
      { src: 'backend/.env', dest: '.env' },
      { src: 'backend/gmail-token.json', dest: 'gmail-token.json', optional: true },
      { src: 'backend/gmail-credentials.json', dest: 'gmail-credentials.json', optional: true },
      { src: 'backend/.env.production', dest: '.env.production', optional: true }
    ];
    
    for (const file of filesToCopy) {
      const srcPath = path.join(__dirname, file.src);
      const destPath = path.join(backupPath, file.dest);
      
      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);
        console.log(`  ✅ Copied ${file.src}`);
      } else if (!file.optional) {
        console.log(`  ⚠️  Warning: ${file.src} not found`);
      }
    }
    
    // Create restore script
    const restoreScript = `#!/bin/bash
# Restore script for Landlord Dashboard

echo "🔵 Restoring Landlord Dashboard Database..."

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start it first."
    exit 1
fi

# Restore database
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard < complete_database_backup.sql

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
else
    echo "❌ Database restore failed. Check the error messages above."
    exit 1
fi

# Copy environment files
cp .env ~/Landlord-Dashboard/backend/
cp gmail-*.json ~/Landlord-Dashboard/backend/ 2>/dev/null || true

echo "✅ Environment files copied!"
echo "📋 Next steps:"
echo "  1. cd ~/Landlord-Dashboard"
echo "  2. pm2 start backend/src/server.js --name landlord-api"
echo "  3. pm2 serve frontend/build 3000 --name landlord-ui --spa"
`;
    
    fs.writeFileSync(path.join(backupPath, 'restore.sh'), restoreScript);
    fs.chmodSync(path.join(backupPath, 'restore.sh'), '755');
    
    // Create README
    const readme = `# Complete Database Backup
Created: ${new Date().toISOString()}

## Contents:
- complete_database_backup.sql - Full database with all table structures and data
- .env - Environment variables
- restore.sh - Automated restore script

## Quick Restore:
\`\`\`bash
cd deployment-backup-*
chmod +x restore.sh
./restore.sh
\`\`\`

## Manual Restore:
\`\`\`bash
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard < complete_database_backup.sql
cp .env ~/Landlord-Dashboard/backend/
\`\`\`

## Statistics:
- Tables: ${tables.rows.length}
- Total Rows: ${totalRows}
- Includes ALL table structures (even empty ones)
`;
    
    fs.writeFileSync(path.join(backupPath, 'README.md'), readme);
    
    console.log('\n' + '='.repeat(60));
    console.log('🎉 COMPLETE BACKUP CREATED!');
    console.log('='.repeat(60));
    console.log(`📁 Location: ${backupPath}/`);
    console.log(`📦 Files created:`);
    console.log(`  ✅ complete_database_backup.sql (with ALL tables)`);
    console.log(`  ✅ .env (environment variables)`);
    console.log(`  ✅ restore.sh (automated restore script)`);
    console.log(`  ✅ README.md (instructions)`);
    console.log('='.repeat(60));
    
    pool.end();
    
  } catch (error) {
    console.error('❌ Backup failed:', error);
    pool.end();
    process.exit(1);
  }
}

createCompleteBackup();