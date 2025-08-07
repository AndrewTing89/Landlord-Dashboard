# Landlord Dashboard

A comprehensive property management system for tracking rental income, expenses, and automating roommate payment requests.

## Overview

This system automates the financial management of a rental property with roommates, handling everything from bank transaction syncing to splitting utility bills and tracking payments through Venmo.

## Features

### 🏦 Transaction Management

-   **Bank Sync**: Automated daily sync with Bank of America via SimpleFIN API
-   **CSV Import**: Bulk import historical transactions from Bank of America exports
-   **Smart Categorization**: ETL rules automatically classify transactions by type
-   **Manual Review**: Interface for reviewing and approving pending transactions

### 💰 Payment Tracking

-   **Bill Splitting**: Automatically splits utility bills 3 ways with roommates
-   **Venmo Integration**: Generates clean payment request links with all details
-   **Gmail Monitoring**: OAuth-based email sync for Venmo payment confirmations
-   **Smart Matching**: Auto-matches payments with rent detection (≥$1600 from Aug 2025)
-   **Payment Status**: Real-time tracking of pending, sent, paid, and foregone payments

### 📊 Dashboard & Analytics

-   **YTD Summary**: Year-to-date totals with rent income tracking
-   **Expense Breakdown**: Visual charts showing expense distribution
-   **Monthly Comparison**: Revenue vs expenses trend analysis
-   **Transaction History**: Searchable database of all transactions

### 🤖 Automation

-   **Daily Sync**: Automated transaction import at 8 AM
-   **Monthly Rent**: Automatic rent income entry on the 1st (\$1,685/month)
-   **Discord Notifications**: Real-time alerts for new bills and payments
-   **Auto-Approval**: High-confidence transactions approved automatically

## Tech Stack

-   **Frontend**: React, TypeScript, Material-UI, Recharts
-   **Backend**: Node.js, Express, PostgreSQL
-   **Integrations**: SimpleFIN (bank sync), Gmail API, Discord webhooks
-   **Infrastructure**: Docker, LocalStack (S3 emulation)

## Quick Start

### Prerequisites

-   Node.js 18+
-   Docker & Docker Compose
-   PostgreSQL client (optional)

### Installation

1.  **Clone the repository**

``` bash
git clone https://github.com/AndrewTing89/Landlord-Dashboard.git
cd Landlord-Dashboard
```

2.  **Install dependencies**

``` bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3.  **Configure environment**

``` bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

4.  **Start services**

``` bash
# Start Docker containers
docker-compose up -d

# Run database migrations
cd backend
npm run migrate

# Start backend (terminal 1)
npm run dev

# Start frontend (terminal 2)
cd frontend
npm run dev
```

5.  **Access the application**

-   Frontend: <http://localhost:5173>
-   Backend API: <http://localhost:3001>

## Key Features Explained

### Transaction Processing Pipeline

1.  SimpleFIN fetches bank transactions → stored in `raw_transactions`
2.  ETL rules categorize transactions → approved ones move to `transactions`
3.  Utility bills detected → payment requests created with 3-way split
4.  Venmo links generated with clean format: `https://venmo.com/USERNAME?txn=charge&amount=XX.XX&note=...`
5.  Gmail OAuth monitors Venmo emails → auto-matches payments and updates status

### Expense Categories

-   `electricity` - PG&E electric bills
-   `water` - Water utility bills
-   `maintenance` - Home repairs, hardware stores
-   `property_tax` - Property tax payments
-   `insurance` - Property insurance
-   `landscape` - Landscaping services
-   `internet` - Internet/cable bills
-   `rent` - Rental income
-   `utility_reimbursement` - Roommate payments (income)
-   `other` - Uncategorized (excluded from reports)

### Payment Request States

-   `pending` - Created, not yet sent
-   `sent` - Discord notification sent
-   `paid` - Payment confirmed via Gmail
-   `foregone` - Waived without payment

### Venmo Link Format

Payment request links use a clean key:value format that works on both web and mobile:

```
https://venmo.com/UshiLo?txn=charge&amount=107.43&note=Great_Oaks_Water%0ATotal:$322.29%0AYour_share(1/3):$107.43%0APaid:Mar_2025%0AID:2025-March-Water
```

The note includes:
- Company name (PG&E or Great_Oaks_Water)
- Total bill amount
- Roommate's 1/3 share
- Date the bill was paid
- Tracking ID for automatic matching

## Common Operations

### Import Historical Data

``` bash
cd backend
node scripts/import-bofa-csv.js "../bofa history.csv"
```

### Manual Sync

``` bash
# Daily sync (7 days lookback)
node src/scripts/daily/full-sync.js daily 7

# Catch-up sync (90 days)
node src/scripts/daily/full-sync.js catch_up 90
```

### Process Utility Bills

``` bash
# Find and create payment requests for unbilled utilities
node scripts/catch-up-utility-bills.js
```

### Add Rent Income

``` bash
# Add rent for 2025 ($1,685/month)
node scripts/add-rent-income-2025.js
```

## Environment Variables

Required in `backend/.env`:

```         
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/landlord_dashboard

# SimpleFIN (Bank Sync)
SIMPLEFIN_TOKEN=https://bridge.simplefin.org/simplefin/...

# Discord Webhooks
DISCORD_WEBHOOK_PAYMENT_REQUESTS=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_SYNC_LOGS=https://discord.com/api/webhooks/...

# Gmail API (OAuth)
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
GMAIL_REDIRECT_URI=http://localhost:3002/api/gmail/oauth2callback

# Roommate Configuration
ROOMMATE_VENMO_USERNAME=@Username
ROOMMATE_NAME=Name
SPLIT_COUNT=3

# Optional: Twilio SMS
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

## Automated Schedules

### Daily Sync (8 AM)

-   Fetches new bank transactions
-   Applies ETL categorization rules
-   Detects utility bills
-   Creates payment requests
-   Sends Discord notifications

### Monthly Rent (1st at 9 AM)

-   Adds \$1,685 rent income transaction
-   Only for months that have started

### Continuous Gmail Monitoring

-   Checks for Venmo payment emails
-   Matches to payment requests via tracking IDs
-   Updates payment status automatically

## Troubleshooting

### Transaction Issues

-   Check `raw_transactions` table for unprocessed items
-   Review ETL rules in database
-   Use Review page to manually approve

### Payment Tracking

-   Verify tracking IDs match between Venmo and system
-   Check Gmail sync is working
-   Review `venmo_emails` table for matches

### Sync Failures

-   SimpleFIN token may be expired
-   Check `sync_logs` table for errors
-   Run catch-up sync to recover

## Recent Improvements (January 2025)

### Gmail OAuth Integration
- Replaced basic email sync with OAuth 2.0 authentication
- Filters Venmo emails to only process roommate-related payments
- Removed 48-hour time window restriction for better matching flexibility

### Venmo Link Optimization
- Simplified URL format that works on both web and mobile
- Clean key:value note format without excessive URL encoding
- Automatic rent detection for payments ≥$1600 starting August 2025

### Payment Matching
- Smart confidence scoring (amount: 50%, name: 35%, note: 15%)
- Tracking ID system for exact matching
- Manual review interface for low-confidence matches

## Development

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance and architecture notes.

## License

Private project - All rights reserved
