const db = require('../src/db/connection');

async function addIncomeConstraint() {
  try {
    console.log('Adding unique constraint to income table...');
    
    await db.query(`
      ALTER TABLE income 
      ADD CONSTRAINT income_unique_constraint 
      UNIQUE (date, amount, description, income_type, payer_name)
    `);
    
    console.log('✅ Successfully added unique constraint to income table');
    console.log('This prevents duplicate income records based on:');
    console.log('  - date');
    console.log('  - amount'); 
    console.log('  - description');
    console.log('  - income_type');
    console.log('  - payer_name');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.message.includes('already exists')) {
      console.log('✅ Constraint already exists - income table is protected');
    }
  } finally {
    process.exit(0);
  }
}

addIncomeConstraint();