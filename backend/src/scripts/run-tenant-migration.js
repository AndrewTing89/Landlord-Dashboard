const fs = require('fs');
const path = require('path');
const db = require('../db/connection');

async function runTenantMigration() {
  console.log('Running tenant portal migration...');
  
  try {
    // Read the migration file
    const migrationPath = path.join(__dirname, '../../migrations/011_create_tenant_portal_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    // Split into individual statements (handle both ; and GO as delimiters)
    const statements = migrationSQL
      .split(/;\s*$/gm)
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(`Found ${statements.length} SQL statements to execute`);
    
    let successCount = 0;
    let errorCount = 0;
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip empty statements
      if (!statement || statement.length === 0) continue;
      
      console.log(`\nExecuting statement ${i + 1}/${statements.length}:`);
      console.log(statement.substring(0, 100) + (statement.length > 100 ? '...' : ''));
      
      try {
        await db.query(statement);
        console.log('✓ Success');
        successCount++;
      } catch (error) {
        console.error('✗ Error:', error.message);
        errorCount++;
        
        // If it's a critical table creation error, stop
        if (error.message.includes('syntax error') || 
            (error.message.includes('does not exist') && statement.includes('REFERENCES'))) {
          console.error('Critical error encountered. Stopping migration.');
          throw error;
        }
        // Otherwise continue with other statements
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`Migration Summary:`);
    console.log(`✅ Successful statements: ${successCount}`);
    console.log(`❌ Failed statements: ${errorCount}`);
    console.log('='.repeat(50));
    
    if (errorCount === 0) {
      console.log('\n🎉 Tenant portal tables created successfully!');
    } else {
      console.log('\n⚠️  Migration completed with some errors. Please review.');
    }
    
  } catch (error) {
    console.error('\n❌ Migration failed:', error.message);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run the migration
runTenantMigration();