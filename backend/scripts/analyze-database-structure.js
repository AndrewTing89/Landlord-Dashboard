const db = require('../src/db/connection');

async function analyzeDatabaseStructure() {
  try {
    console.log('📊 DATABASE STRUCTURE ANALYSIS');
    console.log('='.repeat(60));
    
    // Get all table names
    const tablesQuery = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);
    
    const tables = tablesQuery.rows.map(row => row.table_name);
    
    // Primary source tables (where data originates)
    const primarySources = [];
    // Auxiliary/processed tables (derived from primary sources)
    const auxiliaryTables = [];
    
    console.log('\n🗃️  ALL TABLES:');
    
    for (const tableName of tables) {
      // Get table info including constraints
      const constraintsQuery = await db.query(`
        SELECT 
          tc.constraint_name,
          tc.constraint_type,
          kcu.column_name
        FROM information_schema.table_constraints tc
        LEFT JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        WHERE tc.table_name = $1 
          AND tc.table_schema = 'public'
        ORDER BY tc.constraint_type, kcu.column_name
      `, [tableName]);
      
      const rowCountQuery = await db.query(`SELECT COUNT(*) as count FROM "${tableName}"`);
      const rowCount = rowCountQuery.rows[0].count;
      
      // Categorize tables
      let category = 'auxiliary';
      if (['raw_transactions', 'venmo_emails', 'maintenance_tickets'].includes(tableName)) {
        category = 'primary';
        primarySources.push(tableName);
      } else if (['etl_rules', 'estimated_taxes'].includes(tableName)) {
        category = 'configuration';
      } else {
        auxiliaryTables.push(tableName);
      }
      
      console.log(`  ${category === 'primary' ? '📥' : category === 'configuration' ? '⚙️' : '🔄'} ${tableName} (${rowCount} rows)`);
      
      // Show unique constraints for duplicate prevention
      const uniqueConstraints = constraintsQuery.rows.filter(c => c.constraint_type === 'UNIQUE');
      if (uniqueConstraints.length > 0) {
        console.log(`    🔐 Unique constraints:`);
        uniqueConstraints.forEach(constraint => {
          console.log(`      - ${constraint.column_name}`);
        });
      }
    }
    
    console.log(`\n📈 SUMMARY:`);
    console.log(`  Primary Source Tables: ${primarySources.length}`);
    console.log(`  Auxiliary/Processed Tables: ${auxiliaryTables.length}`);
    console.log(`  Total Tables: ${tables.length}`);
    
    console.log(`\n📥 PRIMARY SOURCE TABLES (where data enters):`);
    primarySources.forEach(table => console.log(`  - ${table}`));
    
    console.log(`\n🔄 AUXILIARY TABLES (processed/derived data):`);
    auxiliaryTables.forEach(table => console.log(`  - ${table}`));
    
    // Check specific duplicate prevention measures
    console.log(`\n🔐 DUPLICATE PREVENTION ANALYSIS:`);
    
    // Raw transactions
    console.log(`\n1. raw_transactions:`);
    const rawTxConstraints = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition 
      FROM pg_constraint 
      WHERE conrelid = 'raw_transactions'::regclass
    `);
    rawTxConstraints.rows.forEach(c => {
      if (c.definition.includes('UNIQUE')) {
        console.log(`   ✅ ${c.definition}`);
      }
    });
    
    // Expenses table
    console.log(`\n2. expenses:`);
    const expensesConstraints = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition 
      FROM pg_constraint 
      WHERE conrelid = 'expenses'::regclass
    `);
    expensesConstraints.rows.forEach(c => {
      if (c.definition.includes('UNIQUE')) {
        console.log(`   ✅ ${c.definition}`);
      }
    });
    
    // Income table
    console.log(`\n3. income:`);
    const incomeConstraints = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition 
      FROM pg_constraint 
      WHERE conrelid = 'income'::regclass
    `);
    incomeConstraints.rows.forEach(c => {
      if (c.definition.includes('UNIQUE')) {
        console.log(`   ✅ ${c.definition}`);
      }
    });
    
    // Venmo emails
    console.log(`\n4. venmo_emails:`);
    const venmoConstraints = await db.query(`
      SELECT conname, pg_get_constraintdef(oid) as definition 
      FROM pg_constraint 
      WHERE conrelid = 'venmo_emails'::regclass
    `);
    venmoConstraints.rows.forEach(c => {
      if (c.definition.includes('UNIQUE')) {
        console.log(`   ✅ ${c.definition}`);
      }
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

analyzeDatabaseStructure();