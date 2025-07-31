const db = require('../db/connection');
const { sendSMS } = require('./notificationService');
const roommateConfig = require('../../config/roommate.config');
const moment = require('moment');
const discordService = require('./discordService');
const { generateTrackingId } = require('../utils/trackingId');

class VenmoLinkService {
  /**
   * Generate a Venmo payment request link
   * @param {string} username - Venmo username to request from
   * @param {number} amount - Amount to request
   * @param {string} note - Note for the payment
   * @returns {string} Venmo deep link URL
   */
  generateVenmoLink(username, amount, note) {
    // Venmo URL scheme for requesting money
    // Format: venmo://paycharge?txn=charge&recipients={username}&amount={amount}&note={note}
    
    // Remove @ symbol if present in username
    const cleanUsername = username.replace('@', '');
    
    // URL encode the note to handle special characters
    const encodedNote = encodeURIComponent(note);
    
    // Generate both web and app links
    // Use /u/ format to avoid issues with @ symbols and redirects
    const webLink = `https://venmo.com/u/${cleanUsername}?txn=charge&amount=${amount.toFixed(2)}&note=${encodedNote}`;
    const appLink = `venmo://paycharge?txn=charge&recipients=${cleanUsername}&amount=${amount.toFixed(2)}&note=${encodedNote}`;
    
    // Return web link as it works on both desktop and mobile
    return webLink;
  }

  /**
   * Create payment requests for a utility bill
   * @param {object} bill - Utility bill object
   * @param {array} transactions - Related transactions
   */
  async createPaymentRequestsForBill(bill, transactions) {
    try {
      console.log(`Creating payment requests for ${bill.bill_type} bill...`);
      
      // Only process bills that should be split
      if (!roommateConfig.billTypesForSplit.includes(bill.bill_type)) {
        console.log(`Bill type ${bill.bill_type} not configured for splitting`);
        return;
      }
      
      // Calculate total bill amount from transactions
      const totalAmount = transactions.reduce((sum, tx) => sum + parseFloat(tx.amount), 0);
      
      // Calculate roommate's share
      const roommateShare = totalAmount * roommateConfig.roommate.splitRatio;
      
      // Get the paid date (latest transaction date)
      const paidDate = transactions.reduce((latest, tx) => {
        const txDate = new Date(tx.date);
        return txDate > latest ? txDate : latest;
      }, new Date(transactions[0].date));
      
      const formattedDate = moment(paidDate).format('MMM YYYY');
      
      // Generate tracking ID for this request
      const trackingId = generateTrackingId(bill.month, bill.year, bill.bill_type);
      
      // Generate payment note with tracking ID
      const baseNote = roommateConfig.messageTemplates[bill.bill_type](
        totalAmount,
        roommateShare,
        formattedDate
      );
      const noteWithTracking = `${baseNote} [${trackingId}]`;
      
      // Create payment request record
      const paymentRequest = await db.insert('payment_requests', {
        utility_bill_id: bill.id,
        roommate_name: roommateConfig.roommate.name,
        venmo_username: roommateConfig.roommate.venmoUsername,
        amount: roommateShare.toFixed(2),
        total_amount: totalAmount.toFixed(2),
        bill_type: bill.bill_type,
        status: 'pending',
        request_date: new Date(),
        charge_date: paidDate,
        month: bill.month,
        year: bill.year,
        tracking_id: trackingId,
        venmo_link: this.generateVenmoLink(
          roommateConfig.roommate.venmoUsername,
          roommateShare,
          noteWithTracking
        )
      });
      
      console.log(`Created payment request: ${paymentRequest.id}`);
      
      // Create Venmo payment request record
      const venmoRequest = await db.insert('venmo_payment_requests', {
        recipient_name: roommateConfig.roommate.name,
        amount: roommateShare.toFixed(2),
        description: note,
        status: 'pending',
        request_date: new Date(),
        utility_bill_id: bill.id,
        bill_type: bill.bill_type
      });
      
      // Link payment request to venmo request
      await db.query(
        'UPDATE payment_requests SET venmo_request_id = $1 WHERE id = $2',
        [venmoRequest.id, paymentRequest.id]
      );
      
      // Generate Venmo link for SMS
      const venmoLink = this.generateVenmoLink(
        roommateConfig.roommate.venmoUsername,
        roommateShare,
        note
      );
      
      // Send SMS notification to landlord's phone
      const smsMessage = roommateConfig.messageTemplates.sms(bill.bill_type, venmoLink);
      
      try {
        await sendSMS(
          roommateConfig.landlord.phoneNumber,
          smsMessage
        );
        console.log(`SMS sent to ${roommateConfig.landlord.phoneNumber}`);
      } catch (smsError) {
        console.error('Failed to send SMS:', smsError);
        // Don't fail the whole process if SMS fails
      }
      
      // Send Discord notification
      try {
        const notificationData = {
          billType: bill.bill_type,
          totalAmount: totalAmount.toFixed(2),
          splitAmount: roommateShare.toFixed(2),
          merchantName: bill.merchant_name || (bill.bill_type === 'electricity' ? 'PG&E' : 'Great Oaks Water'),
          venmoLink: venmoLink,
          dueDate: bill.due_date ? new Date(bill.due_date).toLocaleDateString() : null,
          month: bill.month,
          year: bill.year,
          trackingId: trackingId
        };
        
        await discordService.sendPaymentRequest(notificationData);
        console.log('Discord notification sent successfully');
        
        // Update payment request status to 'sent'
        await db.query(
          'UPDATE payment_requests SET status = $1 WHERE id = $2',
          ['sent', paymentRequest.id]
        );
      } catch (discordError) {
        console.error('Failed to send Discord notification:', discordError);
        // Don't fail the whole process if Discord fails
      }
      
      return {
        paymentRequest,
        venmoRequest,
        venmoLink
      };
    } catch (error) {
      console.error('Error creating payment requests:', error);
      throw error;
    }
  }

  /**
   * Process all pending bills and create payment requests
   */
  async processPendingBills() {
    try {
      // Find bills that don't have payment requests yet
      const pendingBills = await db.query(`
        SELECT ub.* 
        FROM utility_bills ub
        LEFT JOIN payment_requests pr ON pr.utility_bill_id = ub.id
        WHERE pr.id IS NULL
        AND ub.bill_type IN ('electricity', 'water')
        AND ub.created_at > NOW() - INTERVAL '30 days'
      `);
      
      console.log(`Found ${pendingBills.rows.length} bills without payment requests`);
      
      for (const bill of pendingBills.rows) {
        // Get transactions for this bill
        const transactions = await db.query(
          `SELECT * FROM transactions 
           WHERE expense_type = $1 
           AND date >= $2::date - INTERVAL '5 days'
           AND date <= $2::date + INTERVAL '5 days'`,
          [bill.bill_type, bill.created_at]
        );
        
        if (transactions.rows.length > 0) {
          await this.createPaymentRequestsForBill(bill, transactions.rows);
        }
      }
      
      return pendingBills.rows.length;
    } catch (error) {
      console.error('Error processing pending bills:', error);
      throw error;
    }
  }
}

// Create singleton instance
const venmoLinkService = new VenmoLinkService();

module.exports = venmoLinkService;