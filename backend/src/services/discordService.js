const axios = require('axios');

class DiscordService {
  constructor() {
    // You'll add your webhook URLs here
    this.webhooks = {
      paymentRequests: process.env.DISCORD_WEBHOOK_PAYMENT_REQUESTS,
      paymentConfirmations: process.env.DISCORD_WEBHOOK_PAYMENT_CONFIRMATIONS,
      transactionReview: process.env.DISCORD_WEBHOOK_TRANSACTION_REVIEW,
      syncLogs: process.env.DISCORD_WEBHOOK_SYNC_LOGS,
      errorLogs: process.env.DISCORD_WEBHOOK_ERROR_LOGS
    };
  }

  /**
   * Send a payment request notification to Discord
   */
  async sendPaymentRequest(data) {
    const {
      billType,
      totalAmount,
      splitAmount,
      merchantName,
      venmoLink,
      dueDate,
      month,
      year,
      trackingId
    } = data;

    // Set color based on bill type
    const color = billType === 'electricity' ? 0xD4A017 : 0x1E88E5; // Mustard yellow : Blue
    const billIcon = billType === 'electricity' ? '⚡' : '💧';
    const companyName = billType === 'electricity' ? 'PG&E' : 'Great Oaks Water';

    const embed = {
      embeds: [{
        title: `${billIcon} New ${companyName} Payment Request`,
        description: `**${merchantName || companyName}** bill for ${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
        color: color,
        fields: [
          {
            name: '📊 Total Bill Amount',
            value: `$${totalAmount}`,
            inline: true
          },
          {
            name: '💰 Your Share (1/3)',
            value: `**$${splitAmount}**`,
            inline: true
          },
          {
            name: '🏢 Company',
            value: merchantName || companyName,
            inline: true
          },
          {
            name: '📅 Bill Date',
            value: `${new Date(year, month - 1).toLocaleString('default', { month: 'short', year: 'numeric' })}`,
            inline: true
          },
          {
            name: '✅ Status',
            value: 'Already paid in full',
            inline: true
          },
          {
            name: '🏷️ Tracking ID',
            value: `\`${trackingId || 'N/A'}\``,
            inline: true
          },
          {
            name: '💳 Venmo Payment Link',
            value: `**[Click to Request Payment](${venmoLink})**`,
            inline: false
          }
        ],
        footer: {
          text: `Sent on ${new Date().toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Los_Angeles'
          })}`
        },
        timestamp: new Date().toISOString()
      }]
    };

    try {
      if (!this.webhooks.paymentRequests) {
        console.error('Discord webhook URL not configured for paymentRequests');
        return { success: false, error: 'Webhook not configured' };
      }
      
      console.log('[Discord] Sending payment request to webhook');
      await axios.post(this.webhooks.paymentRequests, embed);
      return { success: true };
    } catch (error) {
      console.error('Discord webhook error:', error);
      console.error('Webhook URL:', this.webhooks.paymentRequests);
      if (error.code === 'ERR_INVALID_URL') {
        console.error('Invalid Discord webhook URL');
      }
      throw error;
    }
  }

  /**
   * Send payment confirmation notification
   */
  async sendPaymentConfirmation(data) {
    const { billType, amount, paidBy, month, year } = data;
    
    const embed = {
      embeds: [{
        title: '✅ Payment Received!',
        description: `${paidBy} has paid their share of the ${billType} bill`,
        color: 0x4CAF50, // Green
        fields: [
          {
            name: 'Amount Paid',
            value: `$${amount}`,
            inline: true
          },
          {
            name: 'Bill Period',
            value: `${new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })}`,
            inline: true
          }
        ],
        timestamp: new Date().toISOString()
      }]
    };

    try {
      await axios.post(this.webhooks.paymentConfirmations, embed);
      return { success: true };
    } catch (error) {
      console.error('Discord webhook error:', error);
      throw error;
    }
  }

  /**
   * Send transaction review notification
   */
  async sendTransactionReview(transactionCount) {
    const embed = {
      embeds: [{
        title: '🔍 New Transactions Need Review',
        description: `${transactionCount} new transaction${transactionCount > 1 ? 's' : ''} imported from Bank of America`,
        color: 0xFF9800, // Orange
        fields: [
          {
            name: 'Action Required',
            value: 'Please review and categorize these transactions'
          }
        ],
        timestamp: new Date().toISOString()
      }],
      components: [{
        type: 1,
        components: [{
          type: 2,
          style: 5,
          label: 'Review Transactions',
          url: 'http://localhost:3000/review',
          emoji: {
            name: '📋'
          }
        }]
      }]
    };

    try {
      if (!this.webhooks.transactionReview) {
        console.error('Discord webhook URL not configured for transactionReview');
        return { success: false, error: 'Webhook not configured' };
      }
      
      await axios.post(this.webhooks.transactionReview, embed);
      return { success: true };
    } catch (error) {
      console.error('Discord transaction review webhook error:', error);
      console.error('Transaction review webhook URL:', this.webhooks.transactionReview);
      if (error.code === 'ERR_INVALID_URL') {
        console.error('Invalid Discord transaction review webhook URL');
      }
      throw error;
    }
  }

  /**
   * Send daily sync summary
   */
  async sendDailySyncSummary(data) {
    const {
      startTime,
      endTime,
      duration,
      transactions = { imported: 0, pending: 0 },
      bills = { found: 0, processed: [] },
      paymentRequests = { created: 0, total: 0 },
      emails = { checked: 0, processed: 0 },
      errors = []
    } = data;
    
    const isSuccess = errors.length === 0;
    const statusEmoji = isSuccess ? '✅' : '⚠️';
    const color = isSuccess ? 0x4CAF50 : 0xFF9800; // Green or Orange
    
    // Build fields
    const fields = [
      {
        name: '🏦 Bank Sync',
        value: `${transactions.imported} new transactions\n${transactions.pending} pending review`,
        inline: true
      },
      {
        name: '💡 Utility Bills',
        value: `${bills.found} new bills found\n${paymentRequests.created} requests created`,
        inline: true
      },
      {
        name: '⏱️ Performance',
        value: `Duration: ${duration}s\nCompleted: ${new Date(endTime).toLocaleTimeString()}`,
        inline: true
      }
    ];
    
    // Add bill details if any
    if (bills.processed.length > 0) {
      const billList = bills.processed.map(b => 
        `• ${b.type === 'electricity' ? '⚡' : '💧'} ${b.type}: $${b.amount}`
      ).join('\n');
      fields.push({
        name: '📋 Bills Processed',
        value: billList || 'None',
        inline: false
      });
    }
    
    // Add errors if any
    if (errors.length > 0) {
      fields.push({
        name: '⚠️ Issues',
        value: errors.slice(0, 5).join('\n') || 'None',
        inline: false
      });
    }
    
    const embed = {
      embeds: [{
        title: `${statusEmoji} Daily Sync Report - ${new Date(startTime).toLocaleDateString()}`,
        description: isSuccess 
          ? '✨ All systems running smoothly!' 
          : `⚠️ Completed with ${errors.length} issue${errors.length !== 1 ? 's' : ''}`,
        color: color,
        fields: fields,
        footer: {
          text: `Next sync: Tomorrow at 8:00 AM PST`
        },
        timestamp: new Date().toISOString()
      }]
    };

    try {
      if (this.webhooks.syncLogs) {
        await axios.post(this.webhooks.syncLogs, embed);
      }
      return { success: true };
    } catch (error) {
      console.error('Discord webhook error:', error);
      // Don't throw - we don't want Discord errors to break the sync
      return { success: false, error: error.message };
    }
  }
  
  /**
   * Send sync status notification (simplified version)
   */
  async sendSyncStatus(status, details = '') {
    const isSuccess = status === 'success';
    
    const embed = {
      embeds: [{
        title: isSuccess ? '✅ Sync Complete' : '❌ Sync Failed',
        description: details,
        color: isSuccess ? 0x4CAF50 : 0xF44336,
        timestamp: new Date().toISOString()
      }]
    };

    try {
      if (this.webhooks.syncLogs) {
        await axios.post(this.webhooks.syncLogs, embed);
      }
      return { success: true };
    } catch (error) {
      console.error('Discord webhook error:', error);
      return { success: false };
    }
  }

  /**
   * Send payment received notification
   */
  async sendPaymentReceivedNotification(data) {
    const { amount, payer, bill_type, month, year, note } = data;
    
    const billIcon = bill_type === 'electricity' ? '⚡' : '💧';
    const companyName = bill_type === 'electricity' ? 'PG&E' : 'Great Oaks Water';
    const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
    
    const embed = {
      embeds: [{
        title: `💰 Payment Received!`,
        description: `**${payer}** has paid their share of the ${billIcon} ${companyName} bill`,
        color: 0x4CAF50, // Green
        fields: [
          {
            name: '💵 Amount Received',
            value: `**$${parseFloat(amount).toFixed(2)}**`,
            inline: true
          },
          {
            name: '📅 Bill Period',
            value: monthName,
            inline: true
          },
          {
            name: '📝 Payment Note',
            value: note || '_No note provided_',
            inline: false
          }
        ],
        footer: {
          text: `Received on ${new Date().toLocaleDateString('en-US', { 
            weekday: 'short', 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            timeZone: 'America/Los_Angeles'
          })}`
        },
        timestamp: new Date().toISOString()
      }]
    };

    try {
      const webhook = this.webhooks.paymentConfirmations || this.webhooks.paymentRequests;
      if (!webhook) {
        console.error('Discord webhook URL not configured for payment confirmations');
        return { success: false, error: 'Webhook not configured' };
      }
      
      console.log('[Discord] Sending payment confirmation to webhook');
      await axios.post(webhook, embed);
      return { success: true };
    } catch (error) {
      console.error('Discord webhook error:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send error notification
   */
  async sendError(errorTitle, errorDetails) {
    const embed = {
      embeds: [{
        title: `⚠️ ${errorTitle}`,
        description: `\`\`\`${errorDetails}\`\`\``,
        color: 0xF44336, // Red
        timestamp: new Date().toISOString()
      }]
    };

    try {
      if (this.webhooks.errorLogs) {
        await axios.post(this.webhooks.errorLogs, embed);
        return { success: true };
      } else {
        console.log('Error logs webhook not configured, skipping Discord notification');
        return { success: false };
      }
    } catch (error) {
      console.error('Discord webhook error:', error);
      // Don't throw here to avoid error loops
      return { success: false };
    }
  }
}

module.exports = new DiscordService();