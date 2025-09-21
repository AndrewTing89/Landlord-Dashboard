const Imap = require('imap');
const { simpleParser } = require('mailparser');
const db = require('../db/connection');

class VenmoEmailMonitorService {
  constructor() {
    this.imap = null;
    this.isMonitoring = false;
    this.checkInterval = null;
  }

  initialize() {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_APP_PASSWORD) {
      console.log('Email monitoring not configured');
      return;
    }

    this.imap = new Imap({
      user: process.env.EMAIL_USER,
      password: process.env.EMAIL_APP_PASSWORD,
      host: 'imap.gmail.com',
      port: 993,
      tls: true,
      tlsOptions: { rejectUnauthorized: false }
    });

    this.imap.on('error', (err) => {
      console.error('IMAP error:', err);
    });

    this.imap.on('end', () => {
      console.log('IMAP connection ended');
      this.isMonitoring = false;
    });
  }

  async checkForVenmoEmails() {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        console.log('IMAP not initialized');
        return resolve();
      }

      this.imap.once('ready', () => {
        this.imap.openBox('INBOX', false, (err, box) => {
          if (err) {
            console.error('Error opening inbox:', err);
            return reject(err);
          }

          // Search for ALL unread Venmo emails
          const searchCriteria = [
            'UNSEEN',
            ['FROM', 'venmo@venmo.com']
          ];

          this.imap.search(searchCriteria, (err, results) => {
            if (err) {
              console.error('Search error:', err);
              return reject(err);
            }

            if (results.length === 0) {
              console.log('No new Venmo emails found');
              this.imap.end();
              return resolve();
            }

            console.log(`Found ${results.length} Venmo emails`);

            const fetch = this.imap.fetch(results, { 
              bodies: '',
              markSeen: true 
            });

            fetch.on('message', (msg, seqno) => {
              msg.on('body', (stream, info) => {
                simpleParser(stream, async (err, parsed) => {
                  if (err) {
                    console.error('Parse error:', err);
                    return;
                  }

                  await this.processVenmoEmail(parsed);
                });
              });
            });

            fetch.once('error', (err) => {
              console.error('Fetch error:', err);
              reject(err);
            });

            fetch.once('end', () => {
              console.log('Done fetching Venmo emails');
              this.imap.end();
              resolve();
            });
          });
        });
      });

      this.imap.once('error', (err) => {
        reject(err);
      });

      this.imap.connect();
    });
  }

  async processVenmoEmail(email) {
    console.log('Processing Venmo email:', email.subject);

    try {
      const emailText = email.text || '';
      const subject = email.subject || '';

      // Determine email type and process accordingly
      if (subject.includes('paid you') || subject.includes('completed your request')) {
        await this.processPaymentReceived(email);
      } else if (subject.includes('You requested')) {
        await this.processPaymentRequestSent(email);
      } else if (subject.includes('declined your request')) {
        await this.processPaymentDeclined(email);
      } else if (subject.includes('Reminder:')) {
        await this.processPaymentReminder(email);
      } else if (subject.includes('request expired') || subject.includes('request has expired')) {
        await this.processPaymentExpired(email);
      }
    } catch (error) {
      console.error('Error processing Venmo email:', error);
    }
  }

  async processPaymentRequestSent(email) {
    console.log('Processing payment request sent email');
    
    const emailText = email.text || '';
    const subject = email.subject || '';
    
    // Extract amount from subject: "You requested $XX.XX from Name"
    const amountMatch = subject.match(/\$(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    // Extract recipient name
    const recipientMatch = subject.match(/You requested \$[\d.]+ from (.+)$/);
    const recipientName = recipientMatch ? recipientMatch[1].trim() : 'Unknown';
    
    // Extract request note/description from email body
    const noteMatch = emailText.match(/Note: "(.+?)"/);
    const note = noteMatch ? noteMatch[1] : '';
    
    if (amount && recipientName) {
      // Check if this request already exists (avoid duplicates)
      const existing = await db.getOne(
        `SELECT id FROM venmo_payment_requests 
         WHERE amount = $1 
         AND recipient_name = $2 
         AND request_date >= $3::timestamp - INTERVAL '1 minute'
         AND request_date <= $3::timestamp + INTERVAL '1 minute'`,
        [amount, recipientName, email.date]
      );
      
      if (!existing) {
        // Create new payment request record
        const request = await db.insert('venmo_payment_requests', {
          recipient_name: recipientName,
          amount: amount,
          description: note,
          status: 'pending',
          request_date: email.date,
          email_subject: subject
        });
        
        console.log(`Created payment request: ${recipientName} for $${amount}`);
        
        // Try to match this with a pending payment request and update status to 'sent'
        const pendingRequest = await db.getOne(
          `SELECT id FROM payment_requests 
           WHERE amount::numeric = $1 
           AND roommate_name ILIKE $2
           AND status = 'pending'
           ORDER BY created_at DESC
           LIMIT 1`,
          [amount, `%${recipientName.split(' ')[0]}%`] // Match by first name
        );
        
        if (pendingRequest) {
          await db.query(
            'UPDATE payment_requests SET status = $1, updated_at = NOW() WHERE id = $2',
            ['sent', pendingRequest.id]
          );
          console.log(`✅ Updated payment request #${pendingRequest.id} status to 'sent'`);
        }
        
        // Link to utility bill if this matches a recent bill split
        if (note.toLowerCase().includes('pge') || note.toLowerCase().includes('water')) {
          await this.linkToUtilityBill(request.id, amount, note);
        }
      }
    }
  }

  async processPaymentReceived(email) {
    console.log('Processing payment received email');
    
    const subject = email.subject || '';
    const emailText = email.text || '';
    
    // Extract payment details
    const amountMatch = emailText.match(/\$(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    // Extract payer name from subject
    const payerMatch = subject.match(/^(.+?) (paid you|completed your request)/);
    const payerName = payerMatch ? payerMatch[1].trim() : 'Unknown';
    
    if (amount && payerName) {
      // Find matching pending request
      const matchingRequest = await db.getOne(
        `SELECT * FROM venmo_payment_requests
         WHERE amount = $1 
         AND status = 'pending'
         AND (recipient_name = $2 OR recipient_name ILIKE $3)
         AND request_date > NOW() - INTERVAL '30 days'
         ORDER BY request_date DESC
         LIMIT 1`,
        [amount, payerName, `%${payerName.split(' ')[0]}%`]
      );
      
      if (matchingRequest) {
        // Update request status to paid
        await db.query(
          `UPDATE venmo_payment_requests 
           SET status = 'paid',
               paid_date = $1,
               payment_email_subject = $2,
               updated_at = NOW()
           WHERE id = $3`,
          [email.date, subject, matchingRequest.id]
        );
        
        console.log(`Payment request ${matchingRequest.id} marked as paid`);
        
        // If linked to a utility bill, update that too
        if (matchingRequest.utility_bill_id) {
          await db.query(
            `UPDATE payment_requests
             SET status = 'paid',
                 paid_date = $1,
                 updated_at = NOW()
             WHERE utility_bill_id = $2 
             AND roommate_name = $3`,
            [email.date, matchingRequest.utility_bill_id, matchingRequest.recipient_name]
          );
        }
        
        // Create a transaction record for tracking
        await this.createPaymentTransaction(matchingRequest, email.date);
      } else {
        console.log(`No matching request found for ${payerName} - $${amount}`);
        
        // Log unmatched payment for manual review
        await db.insert('venmo_unmatched_payments', {
          payer_name: payerName,
          amount: amount,
          email_subject: subject,
          email_date: email.date,
          processed_at: new Date()
        });
      }
    }
  }

  async processPaymentDeclined(email) {
    console.log('Processing payment declined email');
    
    const subject = email.subject || '';
    
    // Extract details: "Name declined your request for $XX.XX"
    const match = subject.match(/(.+?) declined your request for \$(\d+(?:\.\d{2})?)/);
    if (match) {
      const recipientName = match[1].trim();
      const amount = parseFloat(match[2]);
      
      // Update matching request
      const updated = await db.query(
        `UPDATE venmo_payment_requests
         SET status = 'declined',
             declined_date = $1,
             updated_at = NOW()
         WHERE amount = $2
         AND recipient_name = $3
         AND status = 'pending'
         AND request_date > NOW() - INTERVAL '30 days'`,
        [email.date, amount, recipientName]
      );
      
      if (updated.rowCount > 0) {
        console.log(`Payment request declined by ${recipientName} for $${amount}`);
      }
    }
  }

  async processPaymentReminder(email) {
    console.log('Processing payment reminder email');
    
    const subject = email.subject || '';
    
    // Extract details from reminder
    const match = subject.match(/Reminder: You requested \$(\d+(?:\.\d{2})?) from (.+)$/);
    if (match) {
      const amount = parseFloat(match[1]);
      const recipientName = match[2].trim();
      
      // Update reminder count
      await db.query(
        `UPDATE venmo_payment_requests
         SET reminder_count = COALESCE(reminder_count, 0) + 1,
             last_reminder_date = $1,
             updated_at = NOW()
         WHERE amount = $2
         AND recipient_name = $3
         AND status = 'pending'
         AND request_date > NOW() - INTERVAL '30 days'`,
        [email.date, amount, recipientName]
      );
      
      console.log(`Reminder sent to ${recipientName} for $${amount}`);
    }
  }

  async processPaymentExpired(email) {
    console.log('Processing payment expired email');
    
    const subject = email.subject || '';
    const emailText = email.text || '';
    
    // Extract recipient name and amount
    const amountMatch = emailText.match(/\$(\d+(?:\.\d{2})?)/);
    const amount = amountMatch ? parseFloat(amountMatch[1]) : null;
    
    const recipientMatch = subject.match(/Your request to (.+?) has expired/);
    const recipientName = recipientMatch ? recipientMatch[1].trim() : null;
    
    if (amount && recipientName) {
      // Update request status to expired
      await db.query(
        `UPDATE venmo_payment_requests
         SET status = 'expired',
             expired_date = $1,
             updated_at = NOW()
         WHERE amount = $2
         AND recipient_name = $3
         AND status = 'pending'
         AND request_date > NOW() - INTERVAL '60 days'`,
        [email.date, amount, recipientName]
      );
      
      console.log(`Payment request to ${recipientName} for $${amount} expired`);
    }
  }

  async linkToUtilityBill(requestId, amount, description) {
    // This function is deprecated - payment requests now link via month/year/bill_type
    console.log('linkToUtilityBill is deprecated');
  }

  async createPaymentTransaction(paymentRequest, paidDate) {
    // Instead of creating a revenue transaction, create an adjustment
    if (!paymentRequest.utility_bill_id) {
      console.log('No utility bill linked to this payment request');
      return;
    }
    
    // Find the original utility expense transaction based on payment request details
    const utilityExpense = await db.getOne(
      `SELECT t.id, t.amount 
       FROM expenses t
       WHERE t.expense_type = $1
       AND EXTRACT(MONTH FROM t.date) = $2
       AND EXTRACT(YEAR FROM t.date) = $3
       ORDER BY t.date DESC
       LIMIT 1`,
      [paymentRequest.bill_type, paymentRequest.month, paymentRequest.year]
    );
    
    if (utilityExpense) {
      // Check if adjustment already exists
      const existingAdjustment = await db.getOne(
        `SELECT id FROM utility_adjustments 
         WHERE transaction_id = $1 
         AND payment_request_id IS NOT NULL`,
        [utilityExpense.id]
      );
      
      if (!existingAdjustment) {
        // Create adjustment record
        await db.insert('utility_adjustments', {
          transaction_id: utilityExpense.id,
          payment_request_id: null, // Since this is from venmo_payment_requests
          adjustment_amount: parseFloat(paymentRequest.amount),
          adjustment_type: 'reimbursement',
          description: `Venmo payment from ${paymentRequest.recipient_name} for ${paymentRequest.bill_type} bill`,
          applied_date: paidDate
        });
        
        console.log(`Created adjustment of $${paymentRequest.amount} for transaction ${utilityExpense.id}`);
      }
    } else {
      console.log('Could not find matching utility expense transaction');
    }
  }
}

// Create singleton instance
const venmoEmailMonitor = new VenmoEmailMonitorService();

module.exports = venmoEmailMonitor;