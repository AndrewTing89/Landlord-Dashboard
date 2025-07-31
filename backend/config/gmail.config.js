module.exports = {
  // Gmail OAuth2 configuration
  oauth2: {
    clientId: process.env.GMAIL_CLIENT_ID,
    clientSecret: process.env.GMAIL_CLIENT_SECRET,
    redirectUri: process.env.GMAIL_REDIRECT_URI || 'http://localhost:3002/api/gmail/oauth2callback',
    scopes: [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.modify' // To mark emails as read
    ]
  },
  
  // Email search configuration
  search: {
    // Search for Venmo emails from the last N days
    lookbackDays: 30,
    
    // Gmail search queries for different Venmo email types
    queries: {
      paymentReceived: 'from:venmo@venmo.com (subject:"paid you" OR subject:"paid your")',
      requestSent: 'from:venmo@venmo.com subject:"You requested"',
      requestReminder: 'from:venmo@venmo.com subject:"Reminder:"',
      requestCancelled: 'from:venmo@venmo.com subject:"cancelled the request"'
    },
    
    // Maximum emails to process per sync
    maxResults: 50
  },
  
  // Parsing patterns for Venmo emails
  patterns: {
    // Pattern to extract amount from email
    amount: /\$([0-9,]+\.?\d{0,2})/,
    
    // Patterns for different email types
    paymentReceived: {
      actor: /^(.+?) paid you/,
      amount: /paid you \$([0-9,]+\.?\d{0,2})/,
      note: /Payment note: "(.+?)"/,
      // Alternative patterns for different email formats
      bodyAmount: /paid you \$ ?([0-9,]+\.?\d{0,2})/i,
      bodyNote: /([🏠💸📝].+?)(?:See transaction|Money credited)/
    },
    
    requestSent: {
      actor: /You requested \$[0-9,]+\.?\d{0,2} from (.+)/,
      amount: /You requested \$([0-9,]+\.?\d{0,2})/,
      note: /Request note: "(.+?)"/
    }
  },
  
  // Matching thresholds
  matching: {
    // Amount tolerance for matching (in dollars)
    amountTolerance: 0.01,
    
    // Time window for matching (in hours)
    timeWindowHours: 48,
    
    // Minimum confidence score to auto-match
    minConfidence: 0.90,
    
    // Name matching similarity threshold
    nameSimilarityThreshold: 0.85
  }
};