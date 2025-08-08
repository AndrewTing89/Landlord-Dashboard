const db = require('../src/db/connection');

async function documentDatabaseSchema() {
  try {
    console.log('='.repeat(80));
    console.log('LANDLORD DASHBOARD DATABASE SCHEMA');
    console.log('='.repeat(80));
    console.log();

    // Get all tables
    const tables = await db.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);

    console.log(`Found ${tables.rows.length} tables in the database.\n`);

    // For each table, get its columns and details
    for (const table of tables.rows) {
      const tableName = table.table_name;
      
      console.log('─'.repeat(80));
      console.log(`📊 TABLE: ${tableName.toUpperCase()}`);
      console.log('─'.repeat(80));

      // Get column information
      const columns = await db.query(`
        SELECT 
          column_name,
          data_type,
          character_maximum_length,
          is_nullable,
          column_default,
          udt_name
        FROM information_schema.columns
        WHERE table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      // Get foreign key relationships
      const foreignKeys = await db.query(`
        SELECT
          kcu.column_name,
          ccu.table_name AS foreign_table_name,
          ccu.column_name AS foreign_column_name
        FROM information_schema.table_constraints AS tc
        JOIN information_schema.key_column_usage AS kcu
          ON tc.constraint_name = kcu.constraint_name
          AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage AS ccu
          ON ccu.constraint_name = tc.constraint_name
          AND ccu.table_schema = tc.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY' 
          AND tc.table_name = $1
      `, [tableName]);

      // Get row count
      const countResult = await db.query(`SELECT COUNT(*) as count FROM ${tableName}`);
      const rowCount = countResult.rows[0].count;

      console.log(`\n📈 Rows: ${rowCount}`);
      console.log('\n📋 Columns:');
      console.log('-'.repeat(80));

      // Create FK lookup
      const fkLookup = {};
      foreignKeys.rows.forEach(fk => {
        fkLookup[fk.column_name] = `→ ${fk.foreign_table_name}.${fk.foreign_column_name}`;
      });

      // Print columns
      columns.rows.forEach(col => {
        let type = col.data_type;
        if (col.character_maximum_length) {
          type += `(${col.character_maximum_length})`;
        } else if (col.udt_name === 'numeric') {
          type = 'numeric(10,2)';
        }

        const nullable = col.is_nullable === 'YES' ? 'NULL' : 'NOT NULL';
        const defaultVal = col.column_default ? ` DEFAULT ${col.column_default.substring(0, 30)}` : '';
        const fk = fkLookup[col.column_name] || '';

        console.log(`  ${col.column_name.padEnd(30)} ${type.padEnd(20)} ${nullable.padEnd(10)} ${defaultVal.padEnd(20)} ${fk}`);
      });

      // Get sample data for context
      if (rowCount > 0 && rowCount <= 100) {
        const sampleData = await db.query(`
          SELECT * FROM ${tableName} 
          ORDER BY ${columns.rows[0].column_name} DESC 
          LIMIT 3
        `);
        
        if (sampleData.rows.length > 0) {
          console.log('\n📌 Sample Data (Latest 3):');
          console.log(JSON.stringify(sampleData.rows, null, 2).substring(0, 500) + '...');
        }
      }

      console.log();
    }

    // Document key relationships
    console.log('='.repeat(80));
    console.log('🔗 KEY RELATIONSHIPS');
    console.log('='.repeat(80));
    console.log(`
1. FINANCIAL FLOW:
   - expenses → utility_adjustments (via expense_id)
   - income → payment_requests (via payment_request_id)
   - payment_requests → utility_bills (via utility_bill_id)

2. TRANSACTION PROCESSING:
   - raw_transactions → expenses (after ETL processing)
   - etl_rules → automatic categorization of transactions

3. PAYMENT TRACKING:
   - venmo_emails → payment_requests (via payment_request_id)
   - payment_requests → income (when paid)

4. SYNC TRACKING:
   - simplefin_connections → API credentials
   - sync_status → daily sync status
    `);

  } catch (error) {
    console.error('Error documenting schema:', error);
  } finally {
    process.exit(0);
  }
}

documentDatabaseSchema();