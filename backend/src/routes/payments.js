const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const discordService = require('../services/discordService');

// Get payment requests
router.get('/requests', async (req, res) => {
  try {
    const { month, year, status } = req.query;
    
    let query = `
      SELECT 
        pr.*,
        pr.bill_type,
        pr.month,
        pr.year,
        pr.total_amount as bill_total_amount,
        CASE 
          WHEN pr.bill_type = 'electricity' THEN 'PG&E'
          WHEN pr.bill_type = 'water' THEN 'Great Oaks Water'
          ELSE pr.merchant_name
        END as company_name,
        pr.charge_date
      FROM payment_requests pr
      WHERE 1=1
    `;
    const params = [];
    
    if (month) {
      params.push(month);
      query += ` AND pr.month = $${params.length}`;
    }
    
    if (year) {
      params.push(year);
      query += ` AND pr.year = $${params.length}`;
    }
    
    if (status) {
      params.push(status);
      query += ` AND pr.status = $${params.length}`;
    }
    
    query += ` ORDER BY pr.year DESC, pr.month DESC, pr.created_at DESC`;
    
    const paymentRequests = await db.getMany(query, params);
    res.json(paymentRequests);
  } catch (error) {
    console.error('Error fetching payment requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Mark payment as paid
router.post('/requests/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    
    // First get the payment request details
    const paymentRequest = await db.getOne(
      'SELECT * FROM payment_requests WHERE id = $1',
      [id]
    );
    
    if (!paymentRequest) {
      return res.status(404).json({ error: 'Payment request not found' });
    }
    
    // Start a transaction
    await db.query('BEGIN');
    
    try {
      // Update payment request status
      await db.query(
        'UPDATE payment_requests SET status = $1, paid_date = $2 WHERE id = $3',
        ['paid', new Date(), id]
      );
      
      // Create a recuperation transaction
      const utilityName = paymentRequest.bill_type === 'electricity' ? 'PG&E' : 
                         paymentRequest.bill_type === 'water' ? 'Great Oaks Water' : 
                         paymentRequest.bill_type;
      
      await db.insert('transactions', {
        plaid_transaction_id: `recuperation_${paymentRequest.id}_${Date.now()}`,
        plaid_account_id: 'manual_entry',
        amount: parseFloat(paymentRequest.amount),
        date: new Date(),
        name: `${paymentRequest.roommate_name} - ${utilityName} Payment`,
        merchant_name: paymentRequest.roommate_name,
        expense_type: 'utility_reimbursement',
        category: 'Reimbursement',
        subcategory: `${paymentRequest.bill_type} payment`
      });
      
      await db.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: 'Payment marked as paid and recuperation transaction created' 
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error marking payment as paid:', error);
    res.status(500).json({ error: error.message });
  }
});

// Send payment request to Discord
router.post('/requests/:id/send-notification', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the payment request
    const request = await db.getOne(
      'SELECT * FROM payment_requests WHERE id = $1',
      [id]
    );
    
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }
    
    // Send Discord notification
    const notificationData = {
      billType: request.bill_type,
      totalAmount: request.total_amount || (parseFloat(request.amount) * 3),
      splitAmount: request.amount,
      merchantName: request.merchant_name || request.company_name,
      venmoLink: request.venmo_link,
      dueDate: request.due_date ? new Date(request.due_date).toLocaleDateString() : 'N/A',
      month: request.month,
      year: request.year
    };
    
    try {
      await discordService.sendPaymentRequest(notificationData);
      
      // Update payment request status to 'sent'
      await db.query(
        'UPDATE payment_requests SET status = $1 WHERE id = $2',
        ['sent', id]
      );
      
      res.json({ 
        success: true, 
        message: 'Discord notification sent successfully',
        venmoLink: request.venmo_link
      });
    } catch (discordError) {
      console.error('Discord error:', discordError);
      res.status(500).json({ 
        error: 'Failed to send Discord notification', 
        details: discordError.message 
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get payment confirmations
router.get('/confirmations', async (req, res) => {
  try {
    const confirmations = await db.getMany(
      `SELECT pc.*, pr.roommate_name, pr.bill_type
       FROM payment_confirmations pc
       JOIN payment_requests pr ON pc.payment_request_id = pr.id
       ORDER BY pc.created_at DESC
       LIMIT 50`
    );
    res.json(confirmations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;