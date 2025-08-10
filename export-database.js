const { exec } = require('child_process');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: './backend/.env' });

const backupDir = `deployment-backup-${new Date().toISOString().split('T')[0].replace(/-/g, '')}`;
const backupPath = path.join(__dirname, backupDir);

// Ensure backup directory exists
if (!fs.existsSync(backupPath)) {
  fs.mkdirSync(backupPath, { recursive: true });
}

console.log('🔵 Starting database export...');
console.log(`📁 Backup directory: ${backupPath}`);

// Parse DATABASE_URL
const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('❌ DATABASE_URL not found in .env file');
  process.exit(1);
}

// Export database using pg_dump
const dumpFile = path.join(backupPath, 'landlord_dashboard_backup.sql');
const pgDumpCommand = `pg_dump "${dbUrl}" > "${dumpFile}"`;

exec(pgDumpCommand, (error, stdout, stderr) => {
  if (error) {
    console.error('❌ Database export failed:', error.message);
    console.error('Stderr:', stderr);
    
    // Try alternative method
    console.log('\n🔄 Trying alternative export method...');
    const altCommand = `pg_dump -h localhost -U landlord_user -d landlord_dashboard > "${dumpFile}"`;
    
    exec(altCommand, { env: { ...process.env, PGPASSWORD: 'landlord_pass' } }, (altError, altStdout, altStderr) => {
      if (altError) {
        console.error('❌ Alternative export also failed:', altError.message);
        process.exit(1);
      } else {
        console.log('✅ Database exported successfully using alternative method!');
        copyEnvFiles();
      }
    });
  } else {
    console.log('✅ Database exported successfully!');
    copyEnvFiles();
  }
});

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
    }
  });
  
  // Create restore instructions
  const instructions = `# 🚀 Landlord Dashboard Deployment Bundle
# Created: ${new Date().toISOString()}

## 📦 Contents:
- landlord_dashboard_backup.sql - Complete database backup
- .env - Environment variables with all secrets
- gmail-token.json - Gmail OAuth token (if exists)
- gmail-credentials.json - Gmail credentials (if exists)

## 🔧 How to Restore on New Computer:

### 1. After setting up Multipass and PostgreSQL:

\`\`\`bash
# Copy this folder to the VM
multipass transfer deployment-backup-* landlord:~/

# Inside the VM, restore database:
cd ~/deployment-backup-*
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard < landlord_dashboard_backup.sql

# Copy .env file to backend:
cp .env ~/Landlord-Dashboard/backend/
cp gmail-*.json ~/Landlord-Dashboard/backend/ 2>/dev/null || true
\`\`\`

### 2. Start the application:

\`\`\`bash
cd ~/Landlord-Dashboard
pm2 start backend/src/server.js --name landlord-api
pm2 serve frontend/build 3000 --name landlord-ui --spa
\`\`\`

## 🔒 Security Notes:
- This folder contains SENSITIVE data (API keys, tokens)
- Transfer via USB or secure method only
- Delete from USB after transfer
- Never upload to cloud storage or GitHub

## 📊 Database Info:
- Database name: landlord_dashboard
- Username: landlord_user
- Password: landlord_pass
`;
  
  fs.writeFileSync(path.join(backupPath, 'README.md'), instructions);
  console.log('✅ Created restore instructions');
  
  console.log('\n' + '='.repeat(50));
  console.log('🎉 BACKUP COMPLETE!');
  console.log('='.repeat(50));
  console.log(`📁 Location: ${backupPath}`);
  console.log('\n📋 Next steps:');
  console.log('1. Copy the entire folder to a USB drive');
  console.log('2. Transfer to your new Windows laptop');
  console.log('3. Follow the README.md instructions inside');
  console.log('='.repeat(50));
}