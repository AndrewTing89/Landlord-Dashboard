const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: './backend/.env' });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

const backupDir = `migration-package-${new Date().toISOString().split('T')[0]}`;
const backupPath = path.join(__dirname, backupDir);

// Ensure backup directory exists
if (!fs.existsSync(backupPath)) {
  fs.mkdirSync(backupPath, { recursive: true });
}

async function createMigrationPackage() {
  console.log('🚀 CREATING MIGRATION PACKAGE FOR UBUNTU SERVER');
  console.log('=' .repeat(60));
  console.log(`📁 Package directory: ${backupPath}\n`);
  
  try {
    // Step 1: Get all tables
    console.log('📋 Step 1: Analyzing database structure...\n');
    
    const tables = await pool.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    
    console.log(`  Found ${tables.rows.length} tables\n`);
    
    // Step 2: Create SQL backup
    console.log('💾 Step 2: Creating database backup...\n');
    
    let sqlBackup = `-- Landlord Dashboard Database Backup
-- Created: ${new Date().toISOString()}
-- Tables: ${tables.rows.length}

-- Disable foreign key checks
SET session_replication_role = 'replica';

`;

    // Drop and recreate all tables
    for (const table of tables.rows) {
      sqlBackup += `DROP TABLE IF EXISTS ${table.table_name} CASCADE;\n`;
    }
    sqlBackup += '\n';

    // Process each table
    let totalRows = 0;
    const tableStats = [];
    
    for (const table of tables.rows) {
      const tableName = table.table_name;
      console.log(`  Processing ${tableName}...`);
      
      // Get CREATE TABLE statement using pg_dump format
      const columns = await pool.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          column_default,
          is_nullable
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);
      
      sqlBackup += `-- Table: ${tableName}\n`;
      sqlBackup += `CREATE TABLE ${tableName} (\n`;
      
      const columnDefs = [];
      for (const col of columns.rows) {
        let def = `  ${col.column_name} `;
        
        // Add data type
        if (col.data_type === 'character varying') {
          def += `VARCHAR${col.character_maximum_length ? `(${col.character_maximum_length})` : ''}`;
        } else if (col.data_type === 'numeric') {
          def += 'NUMERIC(10,2)';
        } else if (col.data_type === 'timestamp without time zone') {
          def += 'TIMESTAMP';
        } else if (col.data_type === 'timestamp with time zone') {
          def += 'TIMESTAMPTZ';
        } else if (col.data_type === 'ARRAY') {
          def += 'TEXT[]';
        } else {
          def += col.data_type.toUpperCase();
        }
        
        // Add constraints
        if (col.column_default) {
          def += ` DEFAULT ${col.column_default}`;
        }
        if (col.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        
        columnDefs.push(def);
      }
      
      sqlBackup += columnDefs.join(',\n');
      
      // Add primary key
      const pkResult = await pool.query(`
        SELECT column_name
        FROM information_schema.key_column_usage
        WHERE table_name = $1
        AND constraint_name LIKE '%_pkey'
      `, [tableName]);
      
      if (pkResult.rows.length > 0) {
        sqlBackup += `,\n  PRIMARY KEY (${pkResult.rows[0].column_name})`;
      }
      
      sqlBackup += '\n);\n\n';
      
      // Get and insert data
      const data = await pool.query(`SELECT * FROM ${tableName}`);
      
      if (data.rows.length > 0) {
        totalRows += data.rows.length;
        tableStats.push({ table: tableName, rows: data.rows.length });
        
        for (const row of data.rows) {
          const columns = Object.keys(row);
          const values = columns.map(col => {
            const val = row[col];
            if (val === null) return 'NULL';
            if (typeof val === 'boolean') return val ? 'true' : 'false';
            if (typeof val === 'number') return val;
            if (val instanceof Date) return `'${val.toISOString()}'`;
            if (Array.isArray(val)) {
              return `ARRAY[${val.map(v => `'${String(v).replace(/'/g, "''")}'`).join(',')}]`;
            }
            if (typeof val === 'object') return `'${JSON.stringify(val).replace(/'/g, "''")}'::jsonb`;
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          
          sqlBackup += `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')});\n`;
        }
        sqlBackup += '\n';
      } else {
        tableStats.push({ table: tableName, rows: 0 });
      }
    }
    
    // Re-enable foreign keys
    sqlBackup += `-- Re-enable foreign key checks
SET session_replication_role = 'origin';

-- Update sequences
`;

    // Update sequences
    const sequences = await pool.query(`
      SELECT sequencename 
      FROM pg_sequences 
      WHERE schemaname = 'public'
    `);
    
    for (const seq of sequences.rows) {
      const seqName = seq.sequencename;
      const tableName = seqName.replace('_id_seq', '').replace('_seq', '');
      
      // Check if table exists
      const tableExists = tables.rows.some(t => t.table_name === tableName);
      if (tableExists) {
        sqlBackup += `SELECT setval('${seqName}', COALESCE((SELECT MAX(id) FROM ${tableName}), 1));\n`;
      }
    }
    
    sqlBackup += `
-- Backup complete
-- Total rows: ${totalRows}
`;

    // Write SQL backup
    fs.writeFileSync(path.join(backupPath, 'database.sql'), sqlBackup);
    console.log(`  ✅ Database backup created (${totalRows} total rows)\n`);
    
    // Step 3: Copy environment files
    console.log('📁 Step 3: Copying configuration files...\n');
    
    // Copy .env file
    const envPath = path.join(__dirname, 'backend', '.env');
    if (fs.existsSync(envPath)) {
      fs.copyFileSync(envPath, path.join(backupPath, '.env'));
      console.log('  ✅ .env file copied');
    }
    
    // Copy Gmail credentials if they exist
    const gmailToken = path.join(__dirname, 'backend', 'gmail-token.json');
    const gmailCreds = path.join(__dirname, 'backend', 'gmail-credentials.json');
    
    if (fs.existsSync(gmailToken)) {
      fs.copyFileSync(gmailToken, path.join(backupPath, 'gmail-token.json'));
      console.log('  ✅ Gmail token copied');
    }
    
    if (fs.existsSync(gmailCreds)) {
      fs.copyFileSync(gmailCreds, path.join(backupPath, 'gmail-credentials.json'));
      console.log('  ✅ Gmail credentials copied');
    }
    
    // Step 4: Create restore script
    console.log('\n📝 Step 4: Creating restore script...\n');
    
    const restoreScript = `#!/bin/bash

echo "🚀 Landlord Dashboard Database Restore Script"
echo "============================================"

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 > /dev/null 2>&1; then
    echo "❌ PostgreSQL is not running. Please start it first."
    exit 1
fi

# Database credentials
DB_NAME="landlord_dashboard"
DB_USER="landlord_user"
DB_PASS="landlord_pass"

echo "📋 Creating database and user..."

# Create user and database
sudo -u postgres psql <<EOF
-- Create user if not exists
DO \\$\\$
BEGIN
   IF NOT EXISTS (SELECT FROM pg_user WHERE usename = '$DB_USER') THEN
      CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
   END IF;
END
\\$\\$;

-- Create database if not exists
SELECT 'CREATE DATABASE $DB_NAME OWNER $DB_USER'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = '$DB_NAME')\\gexec

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;
EOF

echo "💾 Restoring database..."

# Restore the database
PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME < database.sql

if [ $? -eq 0 ]; then
    echo "✅ Database restored successfully!"
    
    echo "📊 Verifying data..."
    PGPASSWORD=$DB_PASS psql -h localhost -U $DB_USER -d $DB_NAME <<EOF
SELECT 'Tables:', COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'Income records:', COUNT(*) FROM income;
SELECT 'Expense records:', COUNT(*) FROM expenses;
SELECT 'Payment requests:', COUNT(*) FROM payment_requests;
EOF
else
    echo "❌ Database restore failed!"
    exit 1
fi

echo ""
echo "📁 Setting up environment files..."

# Copy environment files to backend directory
if [ -f ".env" ]; then
    cp .env ../backend/.env
    echo "✅ .env file copied to backend/"
fi

if [ -f "gmail-token.json" ]; then
    cp gmail-token.json ../backend/gmail-token.json
    echo "✅ Gmail token copied to backend/"
fi

if [ -f "gmail-credentials.json" ]; then
    cp gmail-credentials.json ../backend/gmail-credentials.json
    echo "✅ Gmail credentials copied to backend/"
fi

echo ""
echo "✅ Migration complete! Your app should work exactly as before."
echo ""
echo "Next steps:"
echo "1. cd ../backend && npm install"
echo "2. cd ../frontend && npm install"
echo "3. Start the application"
`;

    fs.writeFileSync(path.join(backupPath, 'restore.sh'), restoreScript);
    fs.chmodSync(path.join(backupPath, 'restore.sh'), '755');
    console.log('  ✅ Restore script created\n');
    
    // Step 5: Create README
    const readme = `# Landlord Dashboard Migration Package

Created: ${new Date().toISOString()}

## 📦 Package Contents

- **database.sql** - Complete database backup with all tables and data
- **.env** - Environment variables and API keys
- **gmail-token.json** - Gmail OAuth token (if exists)
- **gmail-credentials.json** - Gmail OAuth credentials (if exists)
- **restore.sh** - Automated restore script
- **README.md** - This file

## 📊 Database Statistics

Total Tables: ${tables.rows.length}
Total Records: ${totalRows}

### Table Breakdown:
${tableStats.filter(t => t.rows > 0).map(t => `- ${t.table}: ${t.rows} records`).join('\n')}

## 🚀 Quick Start on Ubuntu Server

1. **Transfer this folder to your Ubuntu server:**
   \`\`\`bash
   # From your Mac:
   scp -r ${backupDir} user@your-server:~/
   \`\`\`

2. **On the Ubuntu server, clone your repo:**
   \`\`\`bash
   git clone https://github.com/yourusername/landlord-dashboard.git
   cd landlord-dashboard
   \`\`\`

3. **Run the restore script:**
   \`\`\`bash
   cd ~/${backupDir}
   ./restore.sh
   \`\`\`

4. **Install dependencies and start:**
   \`\`\`bash
   cd ~/landlord-dashboard/backend
   npm install
   npm run dev
   
   # In another terminal:
   cd ~/landlord-dashboard/frontend
   npm install
   npm run dev
   \`\`\`

## ⚠️ Important Notes

- Database name: landlord_dashboard
- Database user: landlord_user
- Make sure PostgreSQL is installed on Ubuntu server
- The app will work EXACTLY as it does on your Mac

## 🔒 Security

This package contains sensitive data including API keys and tokens.
Handle with care and do not share publicly.
`;

    fs.writeFileSync(path.join(backupPath, 'README.md'), readme);
    console.log('  ✅ README created\n');
    
    // Print summary
    console.log('=' .repeat(60));
    console.log('✅ MIGRATION PACKAGE CREATED SUCCESSFULLY!');
    console.log('=' .repeat(60));
    console.log('\n📊 Summary:');
    console.log(`  - Total tables: ${tables.rows.length}`);
    console.log(`  - Total records: ${totalRows}`);
    console.log(`  - Package location: ${backupPath}/\n`);
    console.log('📦 Key files with data:');
    tableStats.filter(t => t.rows > 0).forEach(t => {
      console.log(`  - ${t.table}: ${t.rows} records`);
    });
    console.log('\n🚀 Next steps:');
    console.log('1. Transfer the folder to your Ubuntu server via USB or network');
    console.log('2. Run the restore.sh script on the server');
    console.log('3. Your app will work exactly the same!\n');
    
    pool.end();
    
  } catch (error) {
    console.error('❌ Error creating migration package:', error);
    pool.end();
    process.exit(1);
  }
}

createMigrationPackage();