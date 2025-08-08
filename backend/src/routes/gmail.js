const express = require('express');
const router = express.Router();
const gmailService = require('../services/gmailService');
const venmoMatchingService = require('../services/venmoMatchingService');
const { asyncHandler, sendSuccess, sendError } = require('../middleware/errorHandler');

// Initiate Gmail OAuth flow
router.get('/auth', (req, res) => {
  // Store the referrer so we can redirect back to the right page
  const referrer = req.get('referer') || `${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-sync`;
  const authUrl = gmailService.getAuthUrl(referrer);
  res.redirect(authUrl);
});

// OAuth2 callback
router.get('/oauth2callback', asyncHandler(async (req, res) => {
  console.log('OAuth callback received:', req.query);
  const { code, error: authError, state } = req.query;
  
  // Decode the original referrer from state
  let redirectBase = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/email-sync`;
  if (state) {
    try {
      redirectBase = Buffer.from(state, 'base64').toString('utf-8');
    } catch (e) {
      console.error('Error decoding state:', e);
    }
  }
  
  // Check for auth errors from Google
  if (authError) {
    console.error('Google OAuth error:', authError);
    return res.redirect(`${redirectBase}?gmail=error&reason=${authError}`);
  }
  
  if (!code) {
    console.error('No authorization code in callback');
    return res.status(400).send('Authorization code missing');
  }
  
  try {
    console.log('Exchanging code for tokens...');
    await gmailService.getTokensFromCode(code);
    console.log('OAuth tokens obtained successfully');
    
    // Redirect back to the original page
    const redirectUrl = `${redirectBase}?gmail=connected`;
    console.log('Redirecting to:', redirectUrl);
    res.redirect(redirectUrl);
  } catch (error) {
    console.error('OAuth callback error:', error);
    console.error('Error details:', error.response?.data || error.message);
    res.redirect(`${redirectBase}?gmail=error&details=${encodeURIComponent(error.message)}`);
  }
}));

// Check Gmail connection status
router.get('/status', asyncHandler(async (req, res) => {
  const tokens = await gmailService.loadTokens();
  const isConnected = !!tokens; // Convert to boolean
  sendSuccess(res, { connected: isConnected });
}));

// Process Venmo emails
router.post('/sync', asyncHandler(async (req, res) => {
  const { lookbackDays = 7 } = req.body;
  
  // Pass lookbackDays to the service
  const result = await gmailService.processVenmoEmails(lookbackDays);
  
  sendSuccess(res, {
    message: 'Email sync completed',
    lookbackDays,
    ...result
  });
}));

// Get unmatched emails for manual review
router.get('/unmatched', asyncHandler(async (req, res) => {
  const unmatched = await venmoMatchingService.getUnmatchedEmails();
  sendSuccess(res, unmatched);
}));

// Manual match endpoint
router.post('/match', asyncHandler(async (req, res) => {
  const { emailId, paymentRequestId } = req.body;
  
  if (!emailId || !paymentRequestId) {
    return sendError(res, 'Email ID and Payment Request ID are required', 400);
  }
  
  const result = await venmoMatchingService.manualMatch(emailId, paymentRequestId);
  sendSuccess(res, result, 'Payment matched successfully');
}));

// Ignore an unmatched email
router.post('/ignore/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const db = require('../db/connection');
  
  if (!id) {
    return sendError(res, 'Email ID is required', 400);
  }
  
  // Update the email to mark it as ignored
  const result = await db.query(`
    UPDATE venmo_emails 
    SET 
      ignored = true,
      manual_review_needed = false,
      updated_at = NOW()
    WHERE id = $1
    RETURNING *
  `, [id]);
  
  if (result.rowCount === 0) {
    return sendError(res, 'Email not found', 404);
  }
  
  sendSuccess(res, result.rows[0], 'Email ignored successfully');
}));

// Test email parsing (for debugging)
router.post('/test-parse', asyncHandler(async (req, res) => {
  const { subject, body } = req.body;
  
  const testEmail = {
    id: 'test',
    subject,
    body,
    snippet: body.substring(0, 200),
    date: new Date()
  };
  
  const parsed = gmailService.parseVenmoEmail(testEmail);
  sendSuccess(res, parsed);
}));

// Get email sync stats
router.get('/stats', asyncHandler(async (req, res) => {
  const db = require('../db/connection');
  
  const stats = await db.getOne(`
    SELECT 
      COUNT(*) as total_emails,
      COUNT(CASE WHEN matched = true THEN 1 END) as matched_emails,
      COUNT(CASE WHEN matched = false AND (ignored IS NULL OR ignored = false) THEN 1 END) as unmatched_emails,
      COUNT(CASE WHEN ignored = true THEN 1 END) as ignored_emails,
      MAX(received_date) as last_sync
    FROM venmo_emails
  `);
  
  const tokens = await gmailService.loadTokens();
  const isConnected = !!tokens; // Convert to boolean
  
  sendSuccess(res, {
    ...stats,
    gmail_connected: isConnected
  });
}));

// Get sync history
router.get('/sync-history', asyncHandler(async (req, res) => {
  const db = require('../db/connection');
  
  // For now, return empty array since we don't have email sync history table yet
  // In the future, we should create an email_sync_history table
  sendSuccess(res, []);
}));

// Full sync endpoint
router.post('/sync-all', asyncHandler(async (req, res) => {
  const result = await gmailService.processVenmoEmails(30); // 30 days lookback
  
  sendSuccess(res, {
    message: 'Full email sync completed',
    ...result
  });
}));

module.exports = router;