const db = require('../db/connection');
const discordService = require('./discordService');

class PaymentRequestService {
  // Create payment requests for utility bills
  async createUtilityPaymentRequests(expense) {
    try {
      // Handle both direct expense object and expense with utility_bill_id
      const utility_bill_id = expense.utility_bill_id || expense.id;
      const { date, amount, expense_type, merchant_name } = expense;
      
      // Only create payment requests for splittable utilities (electricity and water)
      // Internet is NOT split among roommates
      if (!['electricity', 'water'].includes(expense_type)) {
        console.log(`Skipping payment request creation for ${expense_type} - not a splittable utility`);
        return null;
      }

      // Check if payment requests already exist for this utility bill
      const existing = await db.query(
        'SELECT id FROM payment_requests WHERE utility_bill_id = $1',
        [utility_bill_id]
      );
      
      if (existing.rows.length > 0) {
        console.log(`Payment requests already exist for utility bill ${utility_bill_id}`);
        return null;
      }

      // Split the bill 3 ways
      const splitAmount = (amount / 3).toFixed(2);
      const month = new Date(date).toISOString().substring(0, 7);
      
      const results = [];
      
      // Load roommate configuration
      const roommateConfig = require('../../config/roommate.config.js');
      const roommates = roommateConfig.roommates;
      
      // Create payment request for each roommate (excluding landlord)
      for (let i = 0; i < roommates.length; i++) {
        const roommate = roommates[i];
        let paymentRequest;
        try {
          paymentRequest = await db.insert('payment_requests', {
            roommate_name: roommate.name,
            venmo_username: roommate.venmoUsername,
            bill_type: expense_type,
            merchant_name: merchant_name,
            charge_date: date,
            utility_bill_id: utility_bill_id,
            status: 'pending',
            amount: splitAmount,
            total_amount: amount,
            request_date: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          });
          
          // Generate Venmo link
          const venmoLink = this.generateVenmoLink(splitAmount, expense_type, month);
          await db.query(
            'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
            [venmoLink, paymentRequest.id]
          );
          
          results.push(paymentRequest);
        } catch (err) {
          if (err.code === '23505') { // Unique constraint violation
            console.log(`Payment request already exists for expense ${id}`);
            continue;
          }
          throw err;
        }
      }
      
      // Send Discord notification
      await discordService.sendPaymentRequest(expense_type, amount, splitAmount, month);
      
      console.log(`Created ${results.length} payment requests for ${expense_type} bill`);
      return results;
      
    } catch (error) {
      console.error('Error creating utility payment requests:', error);
      throw error;
    }
  }

  // Create rent payment requests for the current month
  async createRentPaymentRequests() {
    try {
      const now = new Date();
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const monthName = now.toLocaleString('default', { month: 'long' });
      const trackingId = `${year}-${monthName}-Rent`;
      
      // Check if rent request already exists for this month
      const existing = await db.query(
        'SELECT id FROM payment_requests WHERE tracking_id = $1',
        [trackingId]
      );
      
      if (existing.rows.length > 0) {
        console.log(`Rent payment request already exists for ${monthName} ${year}`);
        return null;
      }
      
      // Create rent payment request
      const rentRequest = await db.insert('payment_requests', {
        roommate_name: 'Ushi Lo',
        venmo_username: '@UshiLo',
        utility_bill_id: null,
        bill_type: 'rent',
        merchant_name: 'Rent',
        charge_date: new Date(year, month - 1, 1),
        status: 'pending',
        amount: 1685,
        total_amount: 1685,
        tracking_id: trackingId,
        request_date: new Date(),
        created_at: new Date(),
        updated_at: new Date()
      });
      
      console.log(`Created rent payment request for ${monthName} ${year}`);
      return rentRequest;
      
    } catch (error) {
      console.error('Error creating rent payment request:', error);
      throw error;
    }
  }

  generateVenmoLink(amount, type, month) {
    const description = `${type} reimbursement for ${month}`;
    const encodedDescription = encodeURIComponent(description);
    return `venmo://paycharge?txn=pay&recipients=Andrew-Ting-29&amount=${amount}&note=${encodedDescription}`;
  }
}

module.exports = new PaymentRequestService();