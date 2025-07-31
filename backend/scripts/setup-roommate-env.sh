#!/bin/bash

echo "🏠 Setting up roommate configuration..."
echo ""
echo "This script will help you configure the roommate payment settings."
echo "Please have your roommate's Venmo username ready."
echo ""

# Check if .env file exists
if [ ! -f ../.env ]; then
    echo "Creating .env file..."
    cp ../.env.example ../.env 2>/dev/null || touch ../.env
fi

# Function to update or add env variable
update_env() {
    local key=$1
    local value=$2
    if grep -q "^${key}=" ../.env; then
        # Update existing
        sed -i '' "s/^${key}=.*/${key}=${value}/" ../.env
    else
        # Add new
        echo "${key}=${value}" >> ../.env
    fi
}

# Get roommate information
read -p "Enter roommate's name: " ROOMMATE_NAME
read -p "Enter roommate's Venmo username (without @): " ROOMMATE_VENMO
read -p "Enter roommate's phone (optional, format: +1XXXXXXXXXX): " ROOMMATE_PHONE
read -p "Enter roommate's email (optional): " ROOMMATE_EMAIL

# Update .env file
update_env "ROOMMATE_NAME" "${ROOMMATE_NAME}"
update_env "ROOMMATE_VENMO_USERNAME" "${ROOMMATE_VENMO}"
update_env "ROOMMATE_PHONE" "${ROOMMATE_PHONE}"
update_env "ROOMMATE_EMAIL" "${ROOMMATE_EMAIL}"

# Your phone is already configured in roommate.config.js
echo ""
echo "✅ Configuration saved!"
echo ""
echo "📋 Summary:"
echo "  Roommate: ${ROOMMATE_NAME}"
echo "  Venmo: @${ROOMMATE_VENMO}"
echo "  Phone: ${ROOMMATE_PHONE:-Not set}"
echo "  Email: ${ROOMMATE_EMAIL:-Not set}"
echo "  Your notification phone: +19298884132"
echo ""
echo "🧪 To test the setup, run:"
echo "  cd .. && node src/scripts/test-venmo-sms.js"
echo ""
echo "📱 When bills are processed:"
echo "  1. Payment requests will be created automatically"
echo "  2. You'll receive an SMS with a Venmo link"
echo "  3. Click the link to send the payment request"
echo "  4. The system will track when payment is received"