const db = require('../db/connection');
const discordService = require('./discordService');

class PaymentRequestService {
  // Create payment requests for utility bills
  async createUtilityPaymentRequests(expense) {
    try {
      // Use the expense transaction ID to link payment requests to the expense
      const expense_transaction_id = expense.expense_transaction_id || expense.id;
      const { date, amount, expense_type, merchant_name, month, year } = expense;
      
      // Only create payment requests for splittable utilities (electricity and water)
      // Internet is NOT split among roommates
      if (!['electricity', 'water'].includes(expense_type)) {
        console.log(`Skipping payment request creation for ${expense_type} - not a splittable utility`);
        return null;
      }

      // Using month, year, and bill_type as unique identifiers
      const billMonth = month || (new Date(date).getMonth() + 1);
      const billYear = year || new Date(date).getFullYear();
      
      // Split the bill 3 ways
      const splitAmount = (amount / 3).toFixed(2);
      
      // Get month and year from the date
      const billDate = new Date(date);
      const monthName = billDate.toLocaleString('default', { month: 'long' });
      
      // Capitalize the expense type for the tracking ID
      const typeCapitalized = expense_type.charAt(0).toUpperCase() + expense_type.slice(1);
      
      const results = [];
      
      // Load roommate configuration
      const roommateConfig = require('../../config/roommate.config.js');
      const roommates = roommateConfig.roommates;
      
      // Create payment request for each roommate (excluding landlord)
      for (let i = 0; i < roommates.length; i++) {
        const roommate = roommates[i];
        
        // First check if this specific roommate already has a payment request
        const existingForRoommate = await db.query(
          'SELECT id FROM payment_requests WHERE month = $1 AND year = $2 AND bill_type = $3 AND roommate_name = $4',
          [billMonth, billYear, expense_type, roommate.name]
        );
        
        if (existingForRoommate.rows.length > 0) {
          console.log(`Payment request already exists for ${roommate.name} - ${expense_type} ${billMonth}/${billYear}`);
          continue; // Skip this roommate but continue with others
        }
        
        // Standardized tracking ID format: YYYY-MM-Type
        const monthPadded = billMonth.toString().padStart(2, '0');
        const trackingId = `${billYear}-${monthPadded}-${typeCapitalized}`;
        
        let paymentRequest;
        try {
          paymentRequest = await db.insert('payment_requests', {
            roommate_name: roommate.name,
            venmo_username: roommate.venmoUsername,
            bill_type: expense_type,
            merchant_name: merchant_name,
            charge_date: date,
            status: 'pending',
            amount: splitAmount,
            total_amount: amount,
            tracking_id: trackingId,
            month: billMonth,
            year: billYear,
            request_date: new Date(),
            created_at: new Date(),
            updated_at: new Date()
          });
          
          // Generate proper Venmo request link with total amount
          const venmoLink = this.generateVenmoRequestLink(
            roommate.venmoUsername,
            splitAmount,
            expense_type,
            monthName,
            billYear,
            trackingId,
            amount, // Pass the total amount for proper note formatting
            date // Pass the charge date for inclusion in note
          );
          
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
      await discordService.sendPaymentRequest(expense_type, amount, splitAmount, `${year}-${month.toString().padStart(2, '0')}`);
      
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
      // Standardized tracking ID format: YYYY-MM-Type
      const monthPadded = month.toString().padStart(2, '0');
      const trackingId = `${year}-${monthPadded}-Rent`;
      
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

  generateVenmoRequestLink(venmoUsername, amount, type, monthName, year, trackingId, totalAmount = null, chargeDate = null) {
    // Format the note with the standardized format
    const typeCapitalized = type.charAt(0).toUpperCase() + type.slice(1);
    
    let note;
    if (type === 'rent') {
      // For rent, simpler format
      note = `${trackingId} - Rent for ${year}-${trackingId.split('-')[1]}`;
    } else {
      // For utilities: tracking_id - Type bill for Mon YYYY: Total $X, your share is $Y (1/3). I've already paid the full amount.
      const total = totalAmount || (amount * 3).toFixed(2); // If no total provided, estimate it
      
      // Get month from tracking ID (format: YYYY-MM-Type)
      const trackingParts = trackingId.split('-');
      const monthNum = trackingParts[1];
      
      // Format the month display - use month name if available, otherwise YYYY-MM
      let monthDisplay = monthName ? `${monthName} ${year}` : `${year}-${monthNum}`;
      
      // Add the actual payment date if available
      let paymentDateStr = '';
      if (chargeDate) {
        const billDate = new Date(chargeDate);
        paymentDateStr = `. I paid the full amount on ${billDate.getMonth() + 1}/${billDate.getDate()}/${billDate.getFullYear()}`;
      } else {
        paymentDateStr = '. I\'ve already paid the full amount';
      }
      
      note = `${trackingId} - ${typeCapitalized} bill for ${monthDisplay}: Total $${total}, your share is $${amount} (1/3)${paymentDateStr}.`;
    }
    
    const encodedNote = encodeURIComponent(note);
    
    // Remove @ symbol and spaces if present in username
    const cleanUsername = venmoUsername.replace('@', '').replace(/\s+/g, '');
    
    // Use the correct Venmo payment link format
    return `https://account.venmo.com/pay?amount=${amount}&note=${encodedNote}&recipients=${cleanUsername}&txn=charge`;
  }
  
  // Updated method to use correct Venmo URL format
  generateVenmoLink(amount, type, month, username = 'Andrew-Ting-29') {
    const description = `${type} reimbursement for ${month}`;
    const encodedDescription = encodeURIComponent(description);
    // Use the correct Venmo web link format that works on both mobile and desktop
    return `https://account.venmo.com/payment-link?amount=${amount}&note=${encodedDescription}&recipients=${username}&txn=pay`;
  }
}

module.exports = new PaymentRequestService();