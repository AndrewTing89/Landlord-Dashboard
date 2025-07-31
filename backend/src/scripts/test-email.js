require('dotenv').config();
const notificationService = require('../services/notificationService');

async function testEmail() {
  console.log('🔍 Testing Email Configuration...\n');
  
  // Check environment variables
  const emailUser = process.env.EMAIL_USER;
  const emailPassword = process.env.EMAIL_APP_PASSWORD;
  
  console.log('Environment Variables:');
  console.log(`  EMAIL_USER: ${emailUser || 'NOT SET'}`);
  console.log(`  EMAIL_APP_PASSWORD: ${emailPassword ? '***SET***' : 'NOT SET'}`);
  
  if (!emailUser || !emailPassword) {
    console.log('\n❌ Email is not configured!');
    console.log('\nTo configure Gmail:');
    console.log('1. Go to Google Account settings');
    console.log('2. Enable 2-factor authentication');
    console.log('3. Generate an App Password:');
    console.log('   https://myaccount.google.com/apppasswords');
    console.log('4. Add to your .env file:');
    console.log('   EMAIL_USER=your-email@gmail.com');
    console.log('   EMAIL_APP_PASSWORD=your-16-char-app-password');
    return;
  }
  
  console.log('\n✅ Email credentials found!\n');
  
  // Test email data
  const testData = {
    billType: 'water',
    totalAmount: 300,
    splitAmount: 100,
    dueDate: new Date().toLocaleDateString(),
    venmoLink: 'https://venmo.com/@andrewhting?txn=charge&amount=100&note=Test%20water%20bill',
    recipientPhone: null,
    recipientEmail: 'andrewhting@gmail.com',
    recipientName: 'Andrew',
    month: new Date().getMonth() + 1,
    year: new Date().getFullYear()
  };
  
  console.log('📧 Sending test email to:', testData.recipientEmail);
  console.log('Test bill details:');
  console.log(`  Type: ${testData.billType}`);
  console.log(`  Total: $${testData.totalAmount}`);
  console.log(`  Your share: $${testData.splitAmount}`);
  console.log('');
  
  try {
    const result = await notificationService.sendBillSplitNotification(testData);
    
    if (result.email) {
      console.log('✅ Email sent successfully!');
      console.log('   Message ID:', result.email.messageId);
      console.log('\n🎉 Email is working! Check your inbox.');
    } else {
      console.log('⚠️  Email was not sent (no result returned)');
    }
  } catch (error) {
    console.error('❌ Failed to send email:', error.message);
    console.log('\nCommon issues:');
    console.log('- Wrong email or password');
    console.log('- Need to use App Password (not regular password)');
    console.log('- 2-factor authentication not enabled');
    console.log('- Less secure app access blocked');
  }
}

testEmail();