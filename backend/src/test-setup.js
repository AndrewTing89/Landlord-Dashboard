const db = require('./db/connection');
const plaidService = require('./services/plaidService');
const s3Service = require('./services/s3Service');
require('dotenv').config();

async function setupTestData() {
  console.log('Setting up test data...');
  
  try {
    // 1. Create a sandbox link token
    console.log('\n1. Creating Plaid link token...');
    const linkToken = await plaidService.createLinkToken();
    console.log('Link token created:', linkToken.substring(0, 20) + '...');
    
    // 2. For sandbox, we'll create a test access token
    console.log('\n2. Creating sandbox access token...');
    // In sandbox mode, we can use a special public token
    const sandboxPublicToken = 'public-sandbox-5c224a01-8314-4491-a06f-39e193d5cddc';
    
    try {
      const tokenData = await plaidService.exchangePublicToken(sandboxPublicToken);
      
      // Save to database
      await db.insert('plaid_tokens', {
        access_token: tokenData.access_token,
        item_id: tokenData.item_id,
        institution_name: 'Chase'
      });
      
      console.log('Access token saved to database');
    } catch (error) {
      console.log('Note: Public token exchange failed (expected in sandbox). Using mock token...');
      
      // For pure testing, insert a mock token
      await db.insert('plaid_tokens', {
        access_token: 'access-sandbox-test-token',
        item_id: 'test-item-id',
        institution_name: 'Chase'
      });
    }
    
    // 3. Initialize S3 bucket
    console.log('\n3. Initializing S3 bucket...');
    await s3Service.initializeBucket();
    
    // 4. Test Lambda functions
    console.log('\n4. Testing Lambda functions...');
    
    // Test plaid sync
    console.log('\n   Testing plaidSync Lambda...');
    const plaidSync = require('./lambdas/plaidSync');
    const syncResult = await plaidSync.handler({}, {});
    console.log('   Result:', JSON.parse(syncResult.body));
    
    // Test bill processing
    console.log('\n   Testing processBills Lambda...');
    const processBills = require('./lambdas/processBills');
    const billsResult = await processBills.handler({}, {});
    console.log('   Result:', JSON.parse(billsResult.body));
    
    // Test report generation
    console.log('\n   Testing generateReport Lambda...');
    const generateReport = require('./lambdas/generateReport');
    const reportResult = await generateReport.handler({
      reportType: 'monthly',
      year: new Date().getFullYear(),
      month: new Date().getMonth() + 1
    }, {});
    console.log('   Result:', JSON.parse(reportResult.body));
    
    console.log('\n✅ Test setup complete!');
    console.log('\nYou can now:');
    console.log('1. Start the server: npm run dev:backend');
    console.log('2. Access the API at http://localhost:3001');
    console.log('3. View transactions: GET /api/transactions');
    console.log('4. Run sync manually: POST /api/lambda/plaid-sync');
    
  } catch (error) {
    console.error('Error in test setup:', error);
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  setupTestData();
}

module.exports = setupTestData;