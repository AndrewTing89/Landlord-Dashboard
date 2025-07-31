const { google } = require('googleapis');
const db = require('../db/connection');
const gmailConfig = require('../../config/gmail.config');

class GmailService {
  constructor() {
    // Check if Gmail is configured
    if (!gmailConfig.oauth2.clientId || gmailConfig.oauth2.clientId === 'your_client_id_here') {
      console.log('⚠️  Gmail OAuth not configured - please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env');
      this.configured = false;
      return;
    }
    
    this.configured = true;
    this.oauth2Client = new google.auth.OAuth2(
      gmailConfig.oauth2.clientId,
      gmailConfig.oauth2.clientSecret,
      gmailConfig.oauth2.redirectUri
    );
  }

  /**
   * Generate OAuth2 authorization URL
   */
  getAuthUrl(referrer = null) {
    if (!this.configured) {
      throw new Error('Gmail OAuth not configured. Please set GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env file.');
    }
    
    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: gmailConfig.oauth2.scopes,
      prompt: 'consent', // Force consent to ensure we get refresh token
      state: referrer ? Buffer.from(referrer).toString('base64') : undefined
    });
  }

  /**
   * Exchange authorization code for tokens
   */
  async getTokensFromCode(code) {
    try {
      const { tokens } = await this.oauth2Client.getToken(code);
      this.oauth2Client.setCredentials(tokens);
      
      // Store tokens in database
      await this.saveTokens(tokens);
      
      return tokens;
    } catch (error) {
      console.error('Error getting tokens:', error);
      throw new Error('Failed to exchange authorization code');
    }
  }

  /**
   * Save OAuth tokens to database
   */
  async saveTokens(tokens) {
    // Get user email
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const profile = await gmail.users.getProfile({ userId: 'me' });
    
    await db.query(`
      INSERT INTO gmail_sync_state (account_email, sync_token, last_sync_date, active)
      VALUES ($1, $2, CURRENT_TIMESTAMP, true)
      ON CONFLICT (account_email) 
      DO UPDATE SET 
        sync_token = $2,
        last_sync_date = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
    `, [profile.data.emailAddress, JSON.stringify(tokens)]);
  }

  /**
   * Load tokens from database
   */
  async loadTokens() {
    const result = await db.getOne(`
      SELECT sync_token 
      FROM gmail_sync_state 
      WHERE active = true 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    if (result && result.sync_token) {
      const tokens = JSON.parse(result.sync_token);
      this.oauth2Client.setCredentials(tokens);
      return tokens; // Return the actual tokens
    }
    return null;
  }

  /**
   * Search for Venmo emails
   */
  async searchVenmoEmails(emailType = 'all') {
    if (!await this.loadTokens()) {
      throw new Error('Gmail not authenticated. Please complete OAuth flow first.');
    }

    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    const messages = [];

    try {
      // Determine which queries to use
      const queries = emailType === 'all' 
        ? Object.values(gmailConfig.search.queries)
        : [gmailConfig.search.queries[emailType]];

      // Search with each query
      for (const query of queries) {
        const searchQuery = `${query} newer_than:${gmailConfig.search.lookbackDays}d`;
        
        const response = await gmail.users.messages.list({
          userId: 'me',
          q: searchQuery,
          maxResults: gmailConfig.search.maxResults
        });

        if (response.data.messages) {
          messages.push(...response.data.messages);
        }
      }

      // Get full message details
      const fullMessages = await Promise.all(
        messages.map(msg => this.getMessage(msg.id))
      );

      return fullMessages;
    } catch (error) {
      console.error('Error searching emails:', error);
      throw error;
    }
  }

  /**
   * Get full message details
   */
  async getMessage(messageId) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId
    });

    return this.parseGmailMessage(response.data);
  }

  /**
   * Parse Gmail message into our format
   */
  parseGmailMessage(message) {
    const headers = message.payload.headers;
    const getHeader = (name) => headers.find(h => h.name === name)?.value || '';
    
    // Extract body text
    let bodyText = '';
    if (message.payload.parts) {
      const textPart = message.payload.parts.find(part => part.mimeType === 'text/plain');
      if (textPart && textPart.body.data) {
        bodyText = Buffer.from(textPart.body.data, 'base64').toString('utf-8');
      }
    } else if (message.payload.body.data) {
      bodyText = Buffer.from(message.payload.body.data, 'base64').toString('utf-8');
    }

    return {
      id: message.id,
      threadId: message.threadId,
      subject: getHeader('Subject'),
      from: getHeader('From'),
      date: new Date(parseInt(message.internalDate)),
      snippet: message.snippet,
      body: bodyText.substring(0, 2000), // Limit body size
      labels: message.labelIds || []
    };
  }

  /**
   * Parse Venmo email content
   */
  parseVenmoEmail(email) {
    const parsed = {
      gmail_message_id: email.id,
      gmail_thread_id: email.threadId,
      sender_email: this.extractEmail(email.from),
      subject: email.subject,
      body_snippet: email.snippet.substring(0, 500),
      received_date: email.date
    };

    // Determine email type
    if (email.subject.includes('paid you') || email.subject.includes('paid your')) {
      parsed.email_type = 'payment_received';
      const match = gmailConfig.patterns.paymentReceived;
      
      // Handle "paid your $X request" format
      if (email.subject.includes('paid your')) {
        const requestMatch = email.subject.match(/^(.+?) paid your \$([0-9,]+\.?\d{0,2})/);
        if (requestMatch) {
          parsed.venmo_actor = requestMatch[1].trim();
          parsed.venmo_amount = parseFloat(requestMatch[2].replace(/,/g, ''));
        }
      } else {
        // Handle "paid you $X" format
        const subjectActorMatch = email.subject.match(match.actor);
        const subjectAmountMatch = email.subject.match(match.amount);
        
        if (subjectActorMatch) parsed.venmo_actor = subjectActorMatch[1].trim();
        if (subjectAmountMatch) parsed.venmo_amount = parseFloat(subjectAmountMatch[1].replace(/,/g, ''));
      }
      
      // Try body patterns as fallback
      if (!parsed.venmo_amount) {
        const bodyAmountMatch = email.body.match(match.bodyAmount);
        if (bodyAmountMatch) parsed.venmo_amount = parseFloat(bodyAmountMatch[1].replace(/,/g, ''));
      }
      
      // Look for note in body - check for bill breakdown pattern
      const billPattern = /Pg&e.*?Water.*?\d+\.\d+/i;
      const billMatch = email.body.match(billPattern);
      if (billMatch) {
        parsed.venmo_note = billMatch[0];
      } else {
        const noteMatch = email.body.match(match.note) || email.body.match(match.bodyNote);
        if (noteMatch) parsed.venmo_note = noteMatch[1].trim();
      }
      
    } else if (email.subject.includes('You requested')) {
      parsed.email_type = 'request_sent';
      const match = gmailConfig.patterns.requestSent;
      
      const actorMatch = email.subject.match(match.actor);
      const amountMatch = email.subject.match(match.amount);
      const noteMatch = email.body.match(match.note);
      
      if (actorMatch) parsed.venmo_actor = actorMatch[1].trim();
      if (amountMatch) parsed.venmo_amount = parseFloat(amountMatch[1].replace(',', ''));
      if (noteMatch) parsed.venmo_note = noteMatch[1];
      
    } else if (email.subject.includes('Reminder:')) {
      parsed.email_type = 'request_reminder';
    } else if (email.subject.includes('cancelled the request')) {
      parsed.email_type = 'request_cancelled';
    }

    // Extract date from email body if possible
    const dateMatch = email.body.match(/(\w+ \d{1,2}, \d{4})/);
    if (dateMatch) {
      parsed.venmo_date = new Date(dateMatch[1]);
    }

    return parsed;
  }

  /**
   * Extract email address from "Name <email@domain.com>" format
   */
  extractEmail(fromString) {
    const match = fromString.match(/<(.+?)>/);
    return match ? match[1] : fromString;
  }

  /**
   * Process new Venmo emails
   */
  async processVenmoEmails(lookbackDays = 7) {
    console.log(`🔄 Starting Venmo email processing (${lookbackDays} days lookback)...`);
    
    try {
      // Search for all Venmo emails
      const emails = await this.searchVenmoEmails('all', lookbackDays);
      console.log(`📧 Found ${emails.length} Venmo emails`);
      
      let processed = 0;
      let matched = 0;
      
      for (const email of emails) {
        // Check if already processed
        const existing = await db.getOne(
          'SELECT id FROM venmo_emails WHERE gmail_message_id = $1',
          [email.id]
        );
        
        if (existing) {
          console.log(`⏭️  Skipping already processed email: ${email.subject}`);
          continue;
        }
        
        // Parse and store email
        const parsed = this.parseVenmoEmail(email);
        const savedEmail = await db.insert('venmo_emails', parsed);
        processed++;
        
        // Try to match with payment requests
        if (parsed.email_type === 'payment_received' && parsed.venmo_amount) {
          const matchResult = await this.matchPaymentEmail(savedEmail);
          if (matchResult.matched) {
            matched++;
          }
        }
        
        // Mark Gmail message as read
        await this.markAsRead(email.id);
      }
      
      console.log(`✅ Processed ${processed} new emails, matched ${matched} payments`);
      
      return {
        total: emails.length,
        processed,
        matched
      };
      
    } catch (error) {
      console.error('❌ Error processing Venmo emails:', error);
      throw error;
    }
  }

  /**
   * Mark email as read in Gmail
   */
  async markAsRead(messageId) {
    const gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });
    
    await gmail.users.messages.modify({
      userId: 'me',
      id: messageId,
      requestBody: {
        removeLabelIds: ['UNREAD']
      }
    });
  }

  /**
   * Match payment email with payment request (implemented in next service)
   */
  async matchPaymentEmail(emailRecord) {
    // This will be implemented in the matching service
    const matchingService = require('./venmoMatchingService');
    return await matchingService.matchPaymentEmail(emailRecord);
  }
}

module.exports = new GmailService();