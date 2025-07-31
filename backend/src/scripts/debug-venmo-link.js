require('dotenv').config();
const db = require('../db/connection');

async function debugVenmoLink() {
  console.log('🔍 DEBUGGING VENMO LINK GENERATION\n');
  console.log('='.repeat(50));
  
  // 1. Check environment variable
  console.log('1. ENVIRONMENT VARIABLE:');
  console.log(`   ROOMMATE_VENMO_USERNAME = "${process.env.ROOMMATE_VENMO_USERNAME}"`);
  
  // 2. Check roommate config
  console.log('\n2. ROOMMATE CONFIG:');
  const roommateConfig = require('../../config/roommate.config');
  console.log(`   roommateConfig.roommate.venmoUsername = "${roommateConfig.roommate.venmoUsername}"`);
  
  // 3. Check a specific payment request
  const request = await db.getOne(
    'SELECT * FROM payment_requests WHERE status = \'pending\' LIMIT 1'
  );
  
  console.log('\n3. PAYMENT REQUEST FROM DB:');
  console.log(`   ID: ${request.id}`);
  console.log(`   venmo_username: "${request.venmo_username}"`);
  console.log(`   venmo_link: "${request.venmo_link}"`);
  
  // 4. Test venmoLinkService
  console.log('\n4. TESTING VENMO LINK SERVICE:');
  const venmoLinkService = require('../services/venmoLinkService');
  
  // Test with different usernames
  const testCases = [
    '@UshiLo',
    'UshiLo',
    '@roommate1-venmo',
    request.venmo_username || roommateConfig.roommate.venmoUsername
  ];
  
  testCases.forEach(username => {
    const link = venmoLinkService.generateVenmoLink(username, 100, 'Test');
    console.log(`   generateVenmoLink("${username}", 100, "Test")`);
    console.log(`   → ${link}`);
  });
  
  // 5. Simulate what happens in send-sms endpoint
  console.log('\n5. SIMULATING SEND-SMS ENDPOINT:');
  console.log(`   request.venmo_username = "${request.venmo_username}"`);
  console.log(`   roommateConfig.roommate.venmoUsername = "${roommateConfig.roommate.venmoUsername}"`);
  console.log(`   Username that would be used: "${request.venmo_username || roommateConfig.roommate.venmoUsername}"`);
  
  // 6. Test actual link generation as in endpoint
  const usernameToUse = request.venmo_username || roommateConfig.roommate.venmoUsername;
  const generatedLink = venmoLinkService.generateVenmoLink(
    usernameToUse,
    parseFloat(request.amount),
    `${request.bill_type} bill - ${request.merchant_name || ''} - Your share: $${request.amount}`
  );
  
  console.log('\n6. LINK THAT WOULD BE GENERATED:');
  console.log(`   ${generatedLink}`);
  
  // 7. Check where "account.venmo.com" might come from
  console.log('\n7. CHECKING FOR "account.venmo.com":');
  console.log('   Is it in the generated link?', generatedLink.includes('account.venmo.com') ? 'YES ❌' : 'NO ✅');
  console.log('   Is it in the DB link?', request.venmo_link.includes('account.venmo.com') ? 'YES ❌' : 'NO ✅');
  
  process.exit(0);
}

debugVenmoLink().catch(console.error);