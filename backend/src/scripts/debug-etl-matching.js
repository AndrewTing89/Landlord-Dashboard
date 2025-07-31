const db = require('../db/connection');

async function debugMatching() {
  try {
    // Get a sample transaction
    const sample = await db.getOne(
      `SELECT * FROM raw_transactions 
       WHERE description LIKE '%GREAT OAKS%' 
       LIMIT 1`
    );
    
    if (sample) {
      console.log('📄 Sample transaction:');
      console.log(`Description: "${sample.description}"`);
      console.log(`Payee: "${sample.payee}"`);
      console.log(`Amount: ${sample.amount}`);
      console.log('');
    }
    
    // Get the water rule
    const waterRule = await db.getOne(
      `SELECT * FROM etl_rules WHERE rule_name = 'Great Oaks Water'`
    );
    
    if (waterRule) {
      console.log('💧 Water rule:');
      console.log(`Pattern: "${waterRule.description_pattern}"`);
      console.log('');
      
      // Test the pattern
      const regex = new RegExp(waterRule.description_pattern, 'i');
      const testString = 'GREAT OAKS WATER DES:WATER BILL';
      console.log(`Testing: "${testString}"`);
      console.log(`Matches: ${regex.test(testString)}`);
    }
    
    // Check actual matching logic
    console.log('\n🔍 Debug actual matching:');
    const description = (sample?.description || '').toLowerCase();
    console.log(`Lowercased description: "${description}"`);
    console.log(`Contains "great oaks": ${description.includes('great oaks')}`);
    console.log(`Contains "water": ${description.includes('water')}`);
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugMatching();