# OAuth Redirect URI Setup Guide

## Where to Add Redirect URIs

When you click on your OAuth 2.0 Client ID, you should see:

1. **Client ID**: 843141311633-kc0tdttd3j4gsaflvh3tebilq6d913fj.apps.googleusercontent.com
2. **Client Secret**: (hidden)
3. **Application type**: Web application
4. **Name**: Your app name

Then below that:

### Authorized JavaScript origins
(This can be empty for now)

### Authorized redirect URIs ← This is what you need!
- Look for an "ADD URI" button or "+" icon
- Click it to add a new URI
- Enter: `http://localhost:3002/api/gmail/oauth2callback`
- You might see a text field appear

## If You Don't See These Sections

The OAuth client might be the wrong type. You need:
- **Application type**: Web application (not Desktop, Android, iOS, etc.)

If it's the wrong type:
1. Go back to Credentials page
2. Click "CREATE CREDENTIALS" → "OAuth client ID"
3. Choose "Web application"
4. Give it a name (e.g., "Landlord Dashboard Web")
5. In "Authorized redirect URIs", add:
   ```
   http://localhost:3002/api/gmail/oauth2callback
   ```
6. Click "CREATE"
7. Copy the new Client ID and Secret
8. Update your `.env` file with the new credentials

## Common UI Locations

The "Authorized redirect URIs" section might appear as:
- A section with an "ADD URI" button
- A "+" button next to "Authorized redirect URIs"
- An expandable section you need to click on
- A text field where you can type/paste URIs

## After Adding the URI

1. Make sure to click "SAVE" (usually at the bottom)
2. Wait 30 seconds for changes to propagate
3. Try the authentication flow again

## Verification

After saving, you should see:
```
Authorized redirect URIs
✓ http://localhost:3002/api/gmail/oauth2callback
```

With possibly an "x" or trash icon to remove it.