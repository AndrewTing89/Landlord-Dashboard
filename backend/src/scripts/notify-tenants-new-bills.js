#!/usr/bin/env node

require('dotenv').config();
const db = require('../db/connection');
const axios = require('axios');

class TenantNotificationService {
  constructor() {
    this.webhookUrl = process.env.DISCORD_WEBHOOK_PAYMENT_REQUESTS;
  }

  async notifyNewBill(paymentRequest) {
    if (!this.webhookUrl) {
      console.error('Discord webhook URL not configured');
      return;
    }

    const billType = paymentRequest.bill_type;
    const monthName = new Date(paymentRequest.year, paymentRequest.month - 1).toLocaleString('default', { month: 'long' });
    const color = billType === 'electricity' ? 0xFFD700 : billType === 'water' ? 0x4169E1 : 0x32CD32;
    const icon = billType === 'electricity' ? '⚡' : billType === 'water' ? '💧' : '🌐';
    const companyName = billType === 'electricity' ? 'PG&E' : billType === 'water' ? 'Water Company' : paymentRequest.merchant_name;
    
    // Generate Venmo link with @andrewhting
    const venmoAmount = parseFloat(paymentRequest.amount).toFixed(2);
    const trackingId = paymentRequest.tracking_id || `${monthName} ${billType}`;
    const venmoUrl = `https://venmo.com/andrewhting?txn=charge&amount=${venmoAmount}&note=${encodeURIComponent(trackingId)}`;

    const embed = {
      content: '@everyone New utility bill ready for payment!',
      embeds: [{
        title: `${icon} New ${monthName} ${billType.charAt(0).toUpperCase() + billType.slice(1)} Bill`,
        description: `Your portion of the ${companyName} bill is now ready for payment.`,
        color: color,
        fields: [
          {
            name: '💵 Total Bill',
            value: `$${paymentRequest.total_amount}`,
            inline: true
          },
          {
            name: '👥 Your Share',
            value: `**$${paymentRequest.amount}**`,
            inline: true
          },
          {
            name: '📅 Bill Period',
            value: `${monthName} ${paymentRequest.year}`,
            inline: true
          },
          {
            name: '🏢 Company',
            value: companyName,
            inline: true
          },
          {
            name: '📱 Status',
            value: '✅ Landlord has paid in full',
            inline: true
          },
          {
            name: '🏷️ Tracking ID',
            value: `\`${trackingId}\``,
            inline: true
          },
          {
            name: '\u200B',
            value: '\u200B',
            inline: false
          },
          {
            name: '💳 Quick Payment Options',
            value: `**[Pay with Venmo](${venmoUrl})** | [View in Portal](https://landlord-dashboard.com/tenant/payments)`,
            inline: false
          }
        ],
        footer: {
          text: 'Thank you for your prompt payment! 🏠',
          icon_url: 'https://cdn.discordapp.com/embed/avatars/0.png'
        },
        timestamp: new Date().toISOString(),
        thumbnail: {
          url: billType === 'electricity' 
            ? 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/9b/Lightning_strike_jan_2007.jpg/120px-Lightning_strike_jan_2007.jpg'
            : 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c0/Drop-of-water.png/120px-Drop-of-water.png'
        }
      }]
    };

    try {
      const response = await axios.post(this.webhookUrl, embed);
      console.log(`✅ Discord notification sent for ${billType} bill`);
      return { success: true };
    } catch (error) {
      console.error('Failed to send Discord notification:', error.message);
      return { success: false, error: error.message };
    }
  }

  async notifyAllPendingBills() {
    try {
      // Get all pending payment requests from January 2025 onwards
      const pendingRequests = await db.query(`
        SELECT * FROM payment_requests 
        WHERE status = 'pending' 
        AND ((year = 2025 AND month >= 1) OR year > 2025)
        ORDER BY year DESC, month DESC
      `);

      if (pendingRequests.rows.length === 0) {
        console.log('No pending payment requests to notify about.');
        return;
      }

      console.log(`Found ${pendingRequests.rows.length} pending payment requests to notify about.`);
      
      for (const request of pendingRequests.rows) {
        await this.notifyNewBill(request);
        // Add a small delay between notifications to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 1000));
      }

      console.log('✅ All notifications sent successfully!');
    } catch (error) {
      console.error('Error notifying tenants:', error);
    }
  }
}

// Main execution
async function main() {
  const service = new TenantNotificationService();
  
  // Check command line arguments
  const command = process.argv[2];
  
  if (command === '--all') {
    // Notify about all pending bills
    await service.notifyAllPendingBills();
  } else if (command === '--help') {
    console.log(`
Usage: node notify-tenants-new-bills.js [options]

Options:
  --all     Send notifications for all pending bills
  --help    Show this help message

This script sends Discord notifications to tenants about new utility bills.
Make sure DISCORD_WEBHOOK_PAYMENT_REQUESTS is set in your .env file.
    `);
  } else {
    console.log('No command specified. Use --help for usage information.');
  }
  
  await db.close();
}

// Run if called directly
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}

module.exports = TenantNotificationService;