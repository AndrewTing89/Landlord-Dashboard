# Gmail Integration Testing Checklist

## 🔧 Setup Verification

### 1. Environment Variables
```bash
# Check if Gmail OAuth is configured
grep "GMAIL_" .env
```
Should see:
- GMAIL_CLIENT_ID (not the placeholder)
- GMAIL_CLIENT_SECRET (not the placeholder)
- GMAIL_REDIRECT_URI=http://localhost:3002/api/gmail/oauth2callback

### 2. Database Tables
```bash
# Check if tables exist
node -e "
const db = require('./src/db/connection');
db.query('SELECT COUNT(*) FROM venmo_emails').then(r => console.log('venmo_emails:', r.rows[0].count));
db.query('SELECT COUNT(*) FROM gmail_sync_state').then(r => console.log('gmail_sync_state:', r.rows[0].count));
"
```

## 🧪 Frontend Testing

### Settings Page
1. Navigate to Settings
2. Find "Gmail Integration" section
3. Should show:
   - [ ] Connection status (Connected/Not Connected)
   - [ ] "Connect Gmail Account" button (if not connected)
   - [ ] "Sync Now" button (if connected)
   - [ ] Privacy note

### Connect Gmail Flow
1. Click "Connect Gmail Account"
2. Should redirect to Google OAuth
3. Select your Gmail account
4. Review permissions (read & modify emails)
5. Click "Allow"
6. Should redirect back to Settings with `?gmail=connected`
7. Should show "Connected" status

### Manual Sync
1. With Gmail connected, click "Sync Now"
2. Should show loading spinner
3. Should display alert with results:
   - Processed: X emails
   - Matched: Y payments

### Email Review Page
1. Navigate to Venmo Tracking → Email Review
2. Should show:
   - [ ] List of unmatched emails (if any)
   - [ ] Amount, sender, date, confidence score
   - [ ] "Match" button for each email
   - [ ] Orange badge in sidebar shows count

### Manual Matching
1. Click "Match" on an unmatched email
2. Dialog should show:
   - Email details (amount, sender, note)
   - Dropdown of pending payment requests
   - Suggested matches with confidence scores
3. Select a payment request
4. Click "Confirm Match"
5. Should update and remove from list

## 🔧 Backend Testing

### Quick Status Check
```bash
node src/scripts/development/gmail-quick-check.js
```

### Full Gmail Tools
```bash
# Check connection
node src/scripts/development/gmail-tools.js status

# Manual sync
node src/scripts/development/gmail-tools.js sync

# View statistics
node src/scripts/development/gmail-tools.js stats

# View unmatched emails
node src/scripts/development/gmail-tools.js review

# View processing history
node src/scripts/development/gmail-tools.js history

# Test email parsing
node src/scripts/development/gmail-tools.js test-parse
```

### API Endpoints
```bash
# Check connection status
curl http://localhost:3002/api/gmail/status

# Trigger manual sync
curl -X POST http://localhost:3002/api/gmail/sync

# Get unmatched emails
curl http://localhost:3002/api/gmail/unmatched
```

## 🔄 Automated Sync Testing

### During Daily Sync
```bash
# Run full sync and watch for Gmail processing
node src/scripts/daily/full-sync.js daily 7
```

Should see:
```
📧 Processing Gmail for Venmo payment confirmations...
✅ Processed X emails, matched Y payments
```

## 🎯 Expected Behaviors

### Successful Payment Match
When a Venmo payment email matches a payment request:
1. ✅ Payment request status → "paid"
2. ✅ Recuperation transaction created (negative amount)
3. ✅ Utility adjustment record created
4. ✅ Discord notification sent
5. ✅ Email marked as matched

### Low Confidence Match
When confidence < 90%:
1. ⚠️ Email flagged for manual review
2. ⚠️ Shows in Email Review page
3. ⚠️ Orange badge count increases
4. ⚠️ Potential matches listed with confidence scores

### No Match Found
When no payment requests match:
1. ❌ Email marked as unmatched
2. ❌ Added to manual review queue
3. ❌ No automatic actions taken

## 📊 Useful Queries

```sql
-- Check recent email processing
SELECT email_type, venmo_amount, venmo_actor, matched, received_date
FROM venmo_emails
ORDER BY received_date DESC
LIMIT 10;

-- Check unmatched payments
SELECT * FROM venmo_emails
WHERE email_type = 'payment_received'
AND matched = false;

-- Check recuperation transactions
SELECT * FROM transactions
WHERE expense_type = 'utility_recuperation'
ORDER BY date DESC
LIMIT 5;
```

## 🐛 Troubleshooting

### "Gmail not configured" error
- Check GMAIL_CLIENT_ID and GMAIL_CLIENT_SECRET in .env
- Restart backend server after updating .env

### OAuth redirect error
- Verify redirect URI matches exactly in Google Console
- Must be: http://localhost:3002/api/gmail/oauth2callback

### No emails found during sync
- Check Gmail account has Venmo emails
- Verify search is looking back 30 days
- Try test-parse command to verify parsing logic

### Emails not matching
- Check payment requests exist for the amounts
- Verify roommate name matches
- Check time window (48 hours)
- Review confidence scoring in unmatched emails