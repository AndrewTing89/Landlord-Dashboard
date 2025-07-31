# Gmail OAuth Setup Guide

## Prerequisites
- A Google account
- Access to Google Cloud Console

## Steps to Set Up Gmail OAuth

### 1. Create a Google Cloud Project
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name it "Landlord Dashboard" or similar
4. Click "Create"

### 2. Enable Gmail API
1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Gmail API"
3. Click on it and press "Enable"

### 3. Configure OAuth Consent Screen
1. Go to "APIs & Services" → "OAuth consent screen"
2. Choose "External" (unless you have a Google Workspace account)
3. Fill in the required fields:
   - App name: "Landlord Dashboard"
   - User support email: Your email
   - Developer contact: Your email
4. Add scopes:
   - Click "Add or Remove Scopes"
   - Add these scopes:
     - `https://www.googleapis.com/auth/gmail.readonly`
     - `https://www.googleapis.com/auth/gmail.modify`
5. Add your email as a test user (if in testing mode)
6. Save and continue

### 4. Create OAuth Credentials
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "OAuth client ID"
3. Choose "Web application"
4. Name it "Landlord Dashboard Web"
5. Add Authorized redirect URIs:
   - `http://localhost:3002/api/gmail/oauth2callback`
   - If deploying to production, also add your production URL
6. Click "Create"
7. Copy the Client ID and Client Secret

### 5. Update Your .env File
Replace the placeholder values in your `.env` file:
```
GMAIL_CLIENT_ID=your_actual_client_id_here
GMAIL_CLIENT_SECRET=your_actual_client_secret_here
GMAIL_REDIRECT_URI=http://localhost:3002/api/gmail/oauth2callback
```

### 6. Connect Gmail Account
1. Start your backend server: `npm run dev`
2. Visit: `http://localhost:3002/api/gmail/auth`
3. Authorize the application
4. You'll be redirected back to your frontend with a success message

## Important Notes

### Security
- Never commit your Client ID and Secret to version control
- Keep your `.env` file in `.gitignore`

### Quotas
- Gmail API has usage quotas (250 quota units per user per second)
- Our implementation uses batch processing to stay within limits

### Scopes
- `gmail.readonly`: Read emails
- `gmail.modify`: Mark emails as read (not delete)
- We don't request delete permissions for safety

### Testing
After setup, test with:
```bash
node src/scripts/development/test-gmail-sync.js
```

## Troubleshooting

### "Access blocked" error
- Make sure redirect URI in Google Console matches exactly (including port)
- Ensure Gmail API is enabled
- Check that OAuth consent screen is configured

### "Invalid client" error
- Verify Client ID and Secret are correct in `.env`
- Make sure there are no extra spaces or quotes

### Rate limit errors
- Gmail API has quotas
- Our sync runs every 30 minutes max to avoid limits