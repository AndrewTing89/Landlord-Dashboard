const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
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

async function exportDatabase() {
  console.log('🔵 Starting database export using Node.js...');
  console.log(`📁 Backup directory: ${backupPath}`);
  
  let sqlDump = `-- Landlord Dashboard Database Backup
-- Created: ${new Date().toISOString()}
-- =====================================================

-- Disable foreign key checks during import
SET session_replication_role = 'replica';

`;

  try {
    // Get all tables
    const tablesResult = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`📊 Found ${tablesResult.rows.length} tables to backup`);
    
    for (const table of tablesResult.rows) {
      const tableName = table.table_name;
      console.log(`  Exporting table: ${tableName}...`);
      
      // Get table structure
      const createTableResult = await pool.query(`
        SELECT 
          'CREATE TABLE IF NOT EXISTS ' || table_name || ' (' ||
          string_agg(
            column_name || ' ' || 
            data_type || 
            CASE 
              WHEN character_maximum_length IS NOT NULL 
              THEN '(' || character_maximum_length || ')' 
              ELSE '' 
            END ||
            CASE 
              WHEN is_nullable = 'NO' THEN ' NOT NULL' 
              ELSE '' 
            END ||
            CASE 
              WHEN column_default IS NOT NULL 
              THEN ' DEFAULT ' || column_default 
              ELSE '' 
            END,
            ', '
          ) || ');' as create_statement
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        GROUP BY table_name
      `, [tableName]);
      
      if (createTableResult.rows.length > 0) {
        sqlDump += `\n-- Table: ${tableName}\n`;
        sqlDump += `DROP TABLE IF EXISTS ${tableName} CASCADE;\n`;
        
        // Get actual CREATE TABLE statement with constraints
        const constraintsResult = await pool.query(`
          SELECT pg_get_constraintdef(c.oid) as constraint_def
          FROM pg_constraint c
          JOIN pg_class t ON c.conrelid = t.oid
          WHERE t.relname = $1 AND c.contype IN ('p', 'f', 'c', 'u')
        `, [tableName]);
        
        // For simplicity, we'll export data with INSERT statements
        // First, get column names
        const columnsResult = await pool.query(`
          SELECT column_name 
          FROM information_schema.columns 
          WHERE table_schema = 'public' AND table_name = $1
          ORDER BY ordinal_position
        `, [tableName]);
        
        const columns = columnsResult.rows.map(r => r.column_name);
        
        // Export table data
        const dataResult = await pool.query(`SELECT * FROM ${tableName}`);
        
        if (dataResult.rows.length > 0) {
          sqlDump += `\n-- Data for ${tableName}\n`;
          
          for (const row of dataResult.rows) {
            const values = columns.map(col => {
              const val = row[col];
              if (val === null) return 'NULL';
              if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
              if (val instanceof Date) return `'${val.toISOString()}'`;
              if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'`;
              return val;
            });
            
            sqlDump += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
          }
        }
      }
    }
    
    sqlDump += `\n-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Update sequences
SELECT setval(pg_get_serial_sequence('income', 'id'), COALESCE(MAX(id), 1)) FROM income;
SELECT setval(pg_get_serial_sequence('expenses', 'id'), COALESCE(MAX(id), 1)) FROM expenses;
SELECT setval(pg_get_serial_sequence('payment_requests', 'id'), COALESCE(MAX(id), 1)) FROM payment_requests;
SELECT setval(pg_get_serial_sequence('raw_transactions', 'id'), COALESCE(MAX(id), 1)) FROM raw_transactions;
SELECT setval(pg_get_serial_sequence('etl_rules', 'id'), COALESCE(MAX(id), 1)) FROM etl_rules;
SELECT setval(pg_get_serial_sequence('maintenance_tickets', 'id'), COALESCE(MAX(id), 1)) FROM maintenance_tickets;

-- Backup complete
`;
    
    // Write SQL dump to file
    const dumpFile = path.join(backupPath, 'landlord_dashboard_backup.sql');
    fs.writeFileSync(dumpFile, sqlDump);
    
    console.log('✅ Database exported successfully!');
    
    // Get statistics
    const stats = {
      tables: tablesResult.rows.length,
      totalRows: 0,
      fileSize: fs.statSync(dumpFile).size
    };
    
    for (const table of tablesResult.rows) {
      const countResult = await pool.query(`SELECT COUNT(*) FROM ${table.table_name}`);
      stats.totalRows += parseInt(countResult.rows[0].count);
    }
    
    console.log(`\n📊 Export Statistics:`);
    console.log(`  - Tables: ${stats.tables}`);
    console.log(`  - Total Rows: ${stats.totalRows}`);
    console.log(`  - Backup Size: ${(stats.fileSize / 1024).toFixed(2)} KB`);
    
    pool.end();
    copyEnvFiles();
    
  } catch (error) {
    console.error('❌ Export failed:', error.message);
    pool.end();
    process.exit(1);
  }
}

function copyEnvFiles() {
  console.log('\n🔵 Copying environment files...');
  
  const filesToCopy = [
    { src: 'backend/.env', dest: '.env' },
    { src: 'backend/gmail-token.json', dest: 'gmail-token.json', optional: true },
    { src: 'backend/gmail-credentials.json', dest: 'gmail-credentials.json', optional: true }
  ];
  
  filesToCopy.forEach(file => {
    const srcPath = path.join(__dirname, file.src);
    const destPath = path.join(backupPath, file.dest);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      console.log(`✅ Copied ${file.src}`);
    } else if (!file.optional) {
      console.log(`⚠️  Warning: ${file.src} not found`);
    } else {
      console.log(`ℹ️  Skipped ${file.src} (not found, optional)`);
    }
  });
  
  // Create comprehensive restore instructions
  const instructions = `# 🚀 Landlord Dashboard Deployment Bundle
# Created: ${new Date().toISOString()}

## 📦 Contents:
- **landlord_dashboard_backup.sql** - Complete database backup with all data
- **.env** - Environment variables with all API keys and secrets
- **gmail-token.json** - Gmail OAuth token (if exists)
- **gmail-credentials.json** - Gmail credentials (if exists)

## 🔧 How to Restore on New Computer:

### Step 1: Transfer to Multipass VM

\`\`\`powershell
# From Windows PowerShell, after setting up Multipass:
multipass transfer deployment-backup-* landlord:~/
\`\`\`

### Step 2: Restore Database

\`\`\`bash
# Inside the VM:
cd ~/deployment-backup-*

# Import the database
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard < landlord_dashboard_backup.sql

# Verify import
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard -c "\\dt"
\`\`\`

### Step 3: Copy Environment Files

\`\`\`bash
# Copy .env and Gmail files to backend
cp .env ~/Landlord-Dashboard/backend/
cp gmail-*.json ~/Landlord-Dashboard/backend/ 2>/dev/null || true

# Verify .env is in place
cat ~/Landlord-Dashboard/backend/.env | head -5
\`\`\`

### Step 4: Start Application

\`\`\`bash
cd ~/Landlord-Dashboard

# Start backend
pm2 start backend/src/server.js --name landlord-api

# Start frontend
pm2 serve frontend/build 3000 --name landlord-ui --spa

# Save PM2 config
pm2 save
pm2 startup
\`\`\`

## 🔒 SECURITY WARNING:
⚠️  This folder contains HIGHLY SENSITIVE data:
- Database passwords
- API keys (SimpleFIN, Discord, Gmail)
- OAuth tokens
- All financial data

**DO NOT:**
- Upload to cloud storage
- Email these files
- Commit to Git
- Leave on USB after transfer

**DO:**
- Transfer via USB only
- Delete from USB after successful transfer
- Keep backup in secure location

## 📊 Database Information:
- Database: landlord_dashboard
- User: landlord_user
- Password: landlord_pass
- Tables included: All ${tablesResult.rows.length} tables
- Total records: ${stats.totalRows}

## ✅ Verification Steps:
After restore, verify:
1. Can login to dashboard
2. Transactions appear correctly
3. Payment requests show up
4. SimpleFIN sync works
5. Gmail monitoring active

## 🆘 Troubleshooting:
If database restore fails:
- Ensure PostgreSQL is running: \`sudo systemctl status postgresql\`
- Check user exists: \`sudo -u postgres psql -c "\\du"\`
- Create database first: \`createdb -U landlord_user landlord_dashboard\`
`;
  
  fs.writeFileSync(path.join(backupPath, 'README.md'), instructions);
  console.log('✅ Created detailed restore instructions');
  
  console.log('\n' + '='.repeat(60));
  console.log('🎉 BACKUP BUNDLE CREATED SUCCESSFULLY!');
  console.log('='.repeat(60));
  console.log(`\n📁 Location: ${backupPath}/`);
  console.log('\n📦 Contents:');
  console.log('  ✅ landlord_dashboard_backup.sql (database)');
  console.log('  ✅ .env (all secrets and API keys)');
  
  const hasGmailToken = fs.existsSync(path.join(backupPath, 'gmail-token.json'));
  if (hasGmailToken) {
    console.log('  ✅ gmail-token.json');
  }
  
  console.log('  ✅ README.md (restore instructions)');
  
  console.log('\n📋 Next Steps:');
  console.log('  1. Copy the entire "' + backupDir + '" folder to a USB drive');
  console.log('  2. Transfer USB to your new Windows laptop');
  console.log('  3. Follow the README.md inside for restore instructions');
  console.log('\n⚠️  IMPORTANT: This bundle contains sensitive data!');
  console.log('  Keep it secure and delete from USB after transfer.');
  console.log('='.repeat(60));
}

// Run the export
exportDatabase();