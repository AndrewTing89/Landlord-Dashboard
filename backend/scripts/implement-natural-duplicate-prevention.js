const db = require('../src/db/connection');

async function implementNaturalDuplicatePrevention() {
  try {
    console.log('🔧 Implementing natural duplicate prevention system...');
    console.log('=' + '='.repeat(60));
    
    // STEP 1: Make SimpleFIN ID fields nullable
    console.log('\n📝 STEP 1: Making SimpleFIN ID fields nullable...');
    
    console.log('  Making raw_transactions.simplefin_id nullable...');
    await db.query(`
      ALTER TABLE raw_transactions 
      ALTER COLUMN simplefin_id DROP NOT NULL
    `);
    
    console.log('  Making expenses.simplefin_transaction_id nullable...');
    await db.query(`
      ALTER TABLE expenses 
      ALTER COLUMN simplefin_transaction_id DROP NOT NULL
    `);
    
    console.log('  Making expenses.simplefin_account_id nullable...');
    await db.query(`
      ALTER TABLE expenses 
      ALTER COLUMN simplefin_account_id DROP NOT NULL
    `);
    
    console.log('  ✅ SimpleFIN fields are now nullable');
    
    // STEP 2: Drop existing SimpleFIN-based unique constraints
    console.log('\n📝 STEP 2: Removing old SimpleFIN-based constraints...');
    
    try {
      await db.query(`
        ALTER TABLE raw_transactions 
        DROP CONSTRAINT IF EXISTS raw_transactions_simplefin_id_key
      `);
      console.log('  ✅ Dropped raw_transactions SimpleFIN constraint');
    } catch (e) {
      console.log('  ℹ️  Raw transactions SimpleFIN constraint already removed');
    }
    
    try {
      await db.query(`
        ALTER TABLE expenses 
        DROP CONSTRAINT IF EXISTS expenses_simplefin_transaction_id_key
      `);
      console.log('  ✅ Dropped expenses SimpleFIN constraint');
    } catch (e) {
      console.log('  ℹ️  Expenses SimpleFIN constraint already removed');
    }
    
    // STEP 3: Add natural key constraints for cross-source duplicate prevention
    console.log('\n📝 STEP 3: Adding natural key constraints...');
    
    console.log('  Adding raw_transactions natural key constraint...');
    await db.query(`
      ALTER TABLE raw_transactions 
      ADD CONSTRAINT raw_transactions_natural_key 
      UNIQUE (posted_date, amount, description)
    `);
    
    console.log('  Adding expenses natural key constraint...');
    await db.query(`
      ALTER TABLE expenses 
      ADD CONSTRAINT expenses_natural_key 
      UNIQUE (date, amount, name, expense_type)
    `);
    
    console.log('  ✅ Natural key constraints added');
    
    // STEP 4: Create indexes for performance
    console.log('\n📝 STEP 4: Creating performance indexes...');
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_raw_transactions_natural_lookup 
      ON raw_transactions (posted_date, amount, UPPER(description))
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_expenses_natural_lookup 
      ON expenses (date, amount, UPPER(name), expense_type)
    `);
    
    console.log('  ✅ Performance indexes created');
    
    // STEP 5: Verify the changes
    console.log('\n📝 STEP 5: Verifying schema changes...');
    
    const rawTxSchema = await db.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'raw_transactions' 
        AND column_name = 'simplefin_id'
    `);
    
    const expenseSchema = await db.query(`
      SELECT column_name, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'expenses' 
        AND column_name IN ('simplefin_transaction_id', 'simplefin_account_id')
      ORDER BY column_name
    `);
    
    console.log('  raw_transactions.simplefin_id:', rawTxSchema.rows[0]?.is_nullable === 'YES' ? '✅ NULLABLE' : '❌ NOT NULL');
    expenseSchema.rows.forEach(col => {
      console.log(`  expenses.${col.column_name}:`, col.is_nullable === 'YES' ? '✅ NULLABLE' : '❌ NOT NULL');
    });
    
    // STEP 6: Show current constraints
    console.log('\n📝 STEP 6: Current constraints summary...');
    
    const constraints = await db.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        tc.constraint_type,
        string_agg(kcu.column_name, ', ' ORDER BY kcu.ordinal_position) as columns
      FROM information_schema.table_constraints tc
      LEFT JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_name IN ('raw_transactions', 'expenses')
        AND tc.constraint_type = 'UNIQUE'
        AND tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name, tc.constraint_type
      ORDER BY tc.table_name, tc.constraint_name
    `);
    
    constraints.rows.forEach(c => {
      console.log(`  ${c.table_name}: ${c.constraint_name} (${c.columns})`);
    });
    
    console.log('\n🎉 IMPLEMENTATION COMPLETE!');
    console.log('\n🔍 What this enables:');
    console.log('  ✅ CSV data can have NULL SimpleFIN fields (semantically correct)');
    console.log('  ✅ Cross-source duplicate prevention (CSV + SimpleFIN)');
    console.log('  ✅ Natural transaction matching by (date, amount, description)');
    console.log('  ✅ Future-proof for other data sources (Quickbooks, Mint, etc.)');
    console.log('  ✅ No more fake ID generation required');
    
    console.log('\n⚠️  Next steps needed:');
    console.log('  1. Update CSV import to use NULL SimpleFIN fields');
    console.log('  2. Update duplicate detection logic in import scripts');
    console.log('  3. Update review routes to handle NULL SimpleFIN fields');
    console.log('  4. Test cross-source duplicate prevention');
    
  } catch (error) {
    console.error('❌ Error implementing natural duplicate prevention:', error);
    
    if (error.message.includes('violates unique constraint')) {
      console.log('\n🔍 CONSTRAINT VIOLATION DETECTED');
      console.log('This means there are existing duplicate records that prevent the natural key constraint.');
      console.log('You may need to clean up duplicates first before applying this constraint.');
    }
  } finally {
    process.exit(0);
  }
}

implementNaturalDuplicatePrevention();