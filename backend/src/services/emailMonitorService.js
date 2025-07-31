const Imap = require('imap');
const { simpleParser } = require('mailparser');
const db = require('../db/connection');

class EmailMonitorService {
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

  async startMonitoring() {
    if (this.isMonitoring) {
      console.log('Email monitoring already running');
      return;
    }

    console.log('Starting email monitoring for Venmo confirmations...');
    this.isMonitoring = true;

    // Schedule checks at 9 AM and 6 PM
    this.scheduleNextCheck();
  }

  scheduleNextCheck() {
    const now = new Date();
    const next9AM = new Date(now);
    next9AM.setHours(9, 0, 0, 0);
    
    const next6PM = new Date(now);
    next6PM.setHours(18, 0, 0, 0);
    
    // If we've passed both times today, schedule for tomorrow 9 AM
    if (now > next6PM) {
      next9AM.setDate(next9AM.getDate() + 1);
    }
    
    // Find the next check time
    let nextCheck;
    if (now < next9AM) {
      nextCheck = next9AM;
    } else if (now < next6PM) {
      nextCheck = next6PM;
    } else {
      nextCheck = next9AM;
    }
    
    const timeUntilNext = nextCheck.getTime() - now.getTime();
    console.log(`Next email check scheduled for ${nextCheck.toLocaleString()}`);
    
    this.checkInterval = setTimeout(async () => {
      await this.checkForVenmoEmails();
      // Schedule the next check
      if (this.isMonitoring) {
        this.scheduleNextCheck();
      }
    }, timeUntilNext);
  }

  stopMonitoring() {
    if (this.checkInterval) {
      clearTimeout(this.checkInterval);
      this.checkInterval = null;
    }
    this.isMonitoring = false;
    if (this.imap) {
      this.imap.end();
    }
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

          // Search for unread Venmo emails
          const searchCriteria = [
            'UNSEEN',
            ['FROM', 'venmo@venmo.com'],
            ['OR', 
              ['SUBJECT', 'paid you'],
              ['SUBJECT', 'completed your request']
            ]
          ];

          this.imap.search(searchCriteria, (err, results) => {
            if (err) {
              console.error('Search error:', err);
              return reject(err);
            }

            if (results.length === 0) {
              console.log('No new Venmo payment emails found');
              this.imap.end();
              return resolve();
            }

            console.log(`Found ${results.length} Venmo payment emails`);

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
      // Extract payment information from email
      const emailText = email.text || '';
      const emailHtml = email.html || '';

      // Look for payment amount and payer name
      const amountMatch = emailText.match(/\$(\d+(?:\.\d{2})?)/);
      const amount = amountMatch ? parseFloat(amountMatch[1]) : null;

      // Check if this is a payment confirmation
      if (email.subject.includes('paid you') || email.subject.includes('completed your request')) {
        // Extract payer name from subject or body
        const payerMatch = email.subject.match(/^(.+?) (paid you|completed your request)/);
        const payerName = payerMatch ? payerMatch[1] : 'Unknown';

        console.log(`Payment received: ${payerName} paid $${amount}`);

        // Find matching payment request
        if (amount) {
          const matchingRequest = await db.getOne(
            `SELECT pr.* FROM payment_requests pr
             WHERE pr.amount = $1 
             AND pr.status = 'pending'
             AND pr.created_at > NOW() - INTERVAL '30 days'
             ORDER BY pr.created_at DESC
             LIMIT 1`,
            [amount.toFixed(2)]
          );

          if (matchingRequest) {
            // Update payment status
            await db.query(
              `UPDATE payment_requests 
               SET status = 'paid', 
                   paid_date = NOW(),
                   updated_at = NOW() 
               WHERE id = $1`,
              [matchingRequest.id]
            );

            console.log(`Updated payment request ${matchingRequest.id} to paid status`);
            
            // Find the original utility expense transaction to adjust
            const utilityExpense = await db.getOne(
              `SELECT t.id, t.amount 
               FROM transactions t
               JOIN utility_bills ub ON ub.bill_type = $1
               WHERE t.expense_type = $1 
               AND t.date >= ub.created_at::date - INTERVAL '5 days'
               AND t.date <= ub.created_at::date + INTERVAL '5 days'
               AND ub.id = $2
               ORDER BY ABS(t.amount - ub.total_amount) ASC
               LIMIT 1`,
              [matchingRequest.bill_type, matchingRequest.utility_bill_id]
            );
            
            if (utilityExpense) {
              // Create an adjustment record
              await db.insert('utility_adjustments', {
                transaction_id: utilityExpense.id,
                payment_request_id: matchingRequest.id,
                adjustment_amount: parseFloat(matchingRequest.amount),
                adjustment_type: 'reimbursement',
                description: `Venmo payment from ${payerName} for ${matchingRequest.bill_type} bill`,
                applied_date: new Date()
              });
              
              console.log(`Created adjustment of $${matchingRequest.amount} for transaction ${utilityExpense.id}`);
            }

            // Log the payment confirmation
            await db.insert('payment_confirmations', {
              payment_request_id: matchingRequest.id,
              payer_name: payerName,
              amount: amount,
              email_subject: email.subject,
              email_date: email.date,
              processed_at: new Date()
            });
          } else {
            console.log(`No matching payment request found for $${amount}`);
            
            // Still log unmatched payments for manual review
            await db.insert('unmatched_payments', {
              payer_name: payerName,
              amount: amount,
              email_subject: email.subject,
              email_date: email.date,
              processed_at: new Date()
            });
          }
        }
      }
    } catch (error) {
      console.error('Error processing Venmo email:', error);
    }
  }
}

// Create singleton instance
const emailMonitor = new EmailMonitorService();

module.exports = emailMonitor;