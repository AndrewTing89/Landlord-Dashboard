#!/bin/bash
# Quick test script for Gmail connection

echo "🧪 Testing Gmail Connection..."
echo ""

# Test connection status
echo "1. Checking connection status..."
curl -s http://localhost:3002/api/gmail/status | jq '.'

echo ""
echo "2. To connect Gmail, visit:"
echo "   http://localhost:3002/api/gmail/auth"
echo ""
echo "3. After connecting, test sync with:"
echo "   node src/scripts/development/test-gmail-sync.js"
echo ""