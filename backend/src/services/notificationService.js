const nodemailer = require('nodemailer');

// Initialize email transporter (using Gmail example)
const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_APP_PASSWORD
  }
});

// Twilio configuration
const twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
const twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
const twilioFromNumber = process.env.TWILIO_FROM_NUMBER;

let twilioClient;
if (twilioAccountSid && twilioAuthToken && 
    twilioAccountSid.startsWith('AC') && twilioAuthToken.length > 0) {
  try {
    const twilio = require('twilio');
    twilioClient = twilio(twilioAccountSid, twilioAuthToken);
    console.log('Twilio client initialized');
  } catch (error) {
    console.warn('Failed to initialize Twilio:', error.message);
  }
}

/**
 * Send SMS notification
 */
async function sendSMS(to, message) {
  if (!twilioClient) {
    console.warn('Twilio not configured, skipping SMS');
    return null;
  }

  try {
    const result = await twilioClient.messages.create({
      body: message,
      from: twilioFromNumber,
      to: to
    });
    
    console.log(`SMS sent successfully: ${result.sid}`);
    return result;
  } catch (error) {
    console.error('SMS send error:', error);
    throw error;
  }
}

/**
 * Send email notification
 */
async function sendEmail(to, subject, html) {
  if (!process.env.EMAIL_USER) {
    console.warn('Email not configured, skipping email');
    return null;
  }

  try {
    const result = await emailTransporter.sendMail({
      from: `"Landlord Dashboard" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html
    });
    
    console.log(`Email sent successfully: ${result.messageId}`);
    return result;
  } catch (error) {
    console.error('Email send error:', error);
    throw error;
  }
}

/**
 * Send bill split notification via SMS and email
 */
async function sendBillSplitNotification(data) {
  const {
    billType,
    totalAmount,
    splitAmount,
    dueDate,
    venmoLink,
    recipientPhone,
    recipientEmail,
    recipientName,
    month,
    year
  } = data;

  // Format message
  const billTypeName = billType === 'electricity' ? 'PG&E' : 'Great Oaks Water';
  const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
  
  // SMS message - Keep under 160 chars for trial accounts
  // Short format: "Water $300, pay $100: [link]"
  const smsMessage = `${billTypeName} $${totalAmount}, pay $${splitAmount}: ${venmoLink}`;

  // Email HTML
  const emailHtml = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Monthly Utility Bill - ${monthName} ${year}</h2>
      
      <div style="background-color: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
        <h3 style="color: #555; margin-top: 0;">${billTypeName}</h3>
        
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <td style="padding: 8px 0; color: #666;">Total Bill Amount:</td>
            <td style="padding: 8px 0; text-align: right; font-weight: bold;">$${totalAmount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Split (3 ways):</td>
            <td style="padding: 8px 0; text-align: right;">÷ 3</td>
          </tr>
          <tr style="border-top: 2px solid #ddd;">
            <td style="padding: 12px 0 8px 0; color: #333; font-weight: bold;">Your Share:</td>
            <td style="padding: 12px 0 8px 0; text-align: right; font-size: 20px; color: #2196f3; font-weight: bold;">$${splitAmount}</td>
          </tr>
          <tr>
            <td style="padding: 8px 0; color: #666;">Due Date:</td>
            <td style="padding: 8px 0; text-align: right; color: #f44336; font-weight: bold;">${dueDate}</td>
          </tr>
        </table>
      </div>
      
      <div style="text-align: center; margin: 30px 0;">
        <a href="${venmoLink}" style="display: inline-block; background-color: #3d95ce; color: white; text-decoration: none; padding: 12px 30px; border-radius: 25px; font-weight: bold;">
          Pay with Venmo
        </a>
      </div>
      
      <p style="color: #666; font-size: 14px; text-align: center;">
        Click the button above or copy this link to pay:<br>
        <code style="background-color: #f5f5f5; padding: 5px; border-radius: 3px; word-break: break-all;">${venmoLink}</code>
      </p>
      
      <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;">
      
      <p style="color: #999; font-size: 12px; text-align: center;">
        This is an automated message from your Landlord Dashboard.<br>
        Please pay by the due date to avoid late fees.
      </p>
    </div>
  `;

  const results = {
    sms: null,
    email: null
  };

  // Send SMS
  if (recipientPhone) {
    try {
      results.sms = await sendSMS(recipientPhone, smsMessage);
    } catch (error) {
      console.error('Failed to send SMS:', error);
    }
  }

  // Send Email
  if (recipientEmail) {
    try {
      results.email = await sendEmail(
        recipientEmail,
        `${monthName} ${billTypeName} Bill - $${splitAmount} Due`,
        emailHtml
      );
    } catch (error) {
      console.error('Failed to send email:', error);
    }
  }

  return results;
}

module.exports = {
  sendSMS,
  sendEmail,
  sendBillSplitNotification
};