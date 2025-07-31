/**
 * Test Gmail sync functionality
 * Usage: node src/scripts/development/test-gmail-sync.js
 */

require('dotenv').config();
const gmailService = require('../../services/gmailService');
const venmoMatchingService = require('../../services/venmoMatchingService');
const db = require('../../db/connection');

async function testGmailSync() {
  console.log('🧪 Testing Gmail Sync...\n');
  
  try {
    // Check if Gmail is connected
    const isConnected = await gmailService.loadTokens();
    
    if (!isConnected) {
      console.log('❌ Gmail not connected!');
      console.log('Please visit: http://localhost:3002/api/gmail/auth');
      console.log('to connect your Gmail account\n');
      return;
    }
    
    console.log('✅ Gmail is connected\n');
    
    // Search for Venmo emails
    console.log('📧 Searching for Venmo emails...');
    const emails = await gmailService.searchVenmoEmails('all');
    console.log(`Found ${emails.length} Venmo emails\n`);
    
    // Show sample of emails
    console.log('Sample emails:');
    emails.slice(0, 5).forEach((email, i) => {
      console.log(`${i + 1}. ${email.subject}`);
      console.log(`   From: ${email.from}`);
      console.log(`   Date: ${email.date.toLocaleString()}`);
      console.log(`   Preview: ${email.snippet.substring(0, 100)}...`);
      console.log('');
    });
    
    // Process emails
    console.log('\n🔄 Processing emails...');
    const result = await gmailService.processVenmoEmails();
    
    console.log('\n📊 Results:');
    console.log(`   • Total emails found: ${result.total}`);
    console.log(`   • New emails processed: ${result.processed}`);
    console.log(`   • Payments matched: ${result.matched}`);
    
    // Check for unmatched emails
    const unmatched = await venmoMatchingService.getUnmatchedEmails();
    if (unmatched.length > 0) {
      console.log(`\n⚠️  ${unmatched.length} emails need manual review:`);
      unmatched.forEach((email, i) => {
        console.log(`${i + 1}. $${email.venmo_amount} from ${email.venmo_actor}`);
        console.log(`   Subject: ${email.subject}`);
        console.log(`   Date: ${new Date(email.received_date).toLocaleString()}`);
        
        if (email.potential_matches) {
          const matches = JSON.parse(email.potential_matches);
          console.log('   Potential matches:');
          matches.forEach(match => {
            console.log(`     - Request #${match.request_id}: ${(match.confidence * 100).toFixed(1)}% confidence`);
          });
        }
        console.log('');
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error.stack);
  } finally {
    await db.close();
    process.exit(0);
  }
}

testGmailSync();