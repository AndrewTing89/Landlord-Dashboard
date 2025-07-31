# Landlord Dashboard

A comprehensive property management system for tracking rental income, expenses, and automating roommate payment requests.

## Overview

This system automates the financial management of a rental property with roommates, handling everything from bank transaction syncing to splitting utility bills and tracking payments through Venmo.

## Features

### 🏦 Transaction Management
- **Bank Sync**: Automated daily sync with Bank of America via SimpleFIN API
- **CSV Import**: Bulk import historical transactions from Bank of America exports
- **Smart Categorization**: ETL rules automatically classify transactions by type
- **Manual Review**: Interface for reviewing and approving pending transactions

### 💰 Payment Tracking
- **Bill Splitting**: Automatically splits utility bills 3 ways with roommates
- **Venmo Integration**: Generates payment request links with tracking IDs
- **Gmail Monitoring**: Tracks Venmo payment confirmations via email
- **Payment Status**: Real-time tracking of pending, sent, paid, and foregone payments

### 📊 Dashboard & Analytics
- **YTD Summary**: Year-to-date totals with rent income tracking
- **Expense Breakdown**: Visual charts showing expense distribution
- **Monthly Comparison**: Revenue vs expenses trend analysis
- **Transaction History**: Searchable database of all transactions

### 🤖 Automation
- **Daily Sync**: Automated transaction import at 8 AM
- **Monthly Rent**: Automatic rent income entry on the 1st ($1,685/month)
- **Discord Notifications**: Real-time alerts for new bills and payments
- **Auto-Approval**: High-confidence transactions approved automatically

## Tech Stack

- **Frontend**: React, TypeScript, Material-UI, Recharts
- **Backend**: Node.js, Express, PostgreSQL
- **Integrations**: SimpleFIN (bank sync), Gmail API, Discord webhooks
- **Infrastructure**: Docker, LocalStack (S3 emulation)

## Quick Start

### Prerequisites
- Node.js 18+
- Docker & Docker Compose
- PostgreSQL client (optional)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/AndrewTing89/Landlord-Dashboard.git
cd Landlord-Dashboard
```

2. **Install dependencies**
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install
```

3. **Configure environment**
```bash
cd backend
cp .env.example .env
# Edit .env with your credentials
```

4. **Start services**
```bash
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

5. **Access the application**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3001

## Key Features Explained

### Transaction Processing Pipeline
1. SimpleFIN fetches bank transactions → stored in `raw_transactions`
2. ETL rules categorize transactions → approved ones move to `transactions`
3. Utility bills detected → payment requests created with 3-way split
4. Venmo links generated with tracking IDs (format: `YYYYMM{type}`)
5. Gmail monitors for payment confirmations → auto-updates status

### Expense Categories
- `electricity` - PG&E electric bills
- `water` - Water utility bills
- `maintenance` - Home repairs, hardware stores
- `property_tax` - Property tax payments
- `insurance` - Property insurance
- `landscape` - Landscaping services
- `internet` - Internet/cable bills
- `rent` - Rental income
- `utility_reimbursement` - Roommate payments (income)
- `other` - Uncategorized (excluded from reports)

### Payment Request States
- `pending` - Created, not yet sent
- `sent` - Discord notification sent
- `paid` - Payment confirmed via Gmail
- `foregone` - Waived without payment

## Common Operations

### Import Historical Data
```bash
cd backend
node scripts/import-bofa-csv.js "../bofa history.csv"
```

### Manual Sync
```bash
# Daily sync (7 days lookback)
node src/scripts/daily/full-sync.js daily 7

# Catch-up sync (90 days)
node src/scripts/daily/full-sync.js catch_up 90
```

### Process Utility Bills
```bash
# Find and create payment requests for unbilled utilities
node scripts/catch-up-utility-bills.js
```

### Add Rent Income
```bash
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
DISCORD_WEBHOOK_PAYMENT=https://discord.com/api/webhooks/...
DISCORD_WEBHOOK_SYNC=https://discord.com/api/webhooks/...

# Gmail API
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret

# Optional: Twilio SMS
TWILIO_ACCOUNT_SID=your_sid
TWILIO_AUTH_TOKEN=your_token
TWILIO_PHONE_NUMBER=+1234567890
```

## Automated Schedules

### Daily Sync (8 AM)
- Fetches new bank transactions
- Applies ETL categorization rules
- Detects utility bills
- Creates payment requests
- Sends Discord notifications

### Monthly Rent (1st at 9 AM)
- Adds $1,685 rent income transaction
- Only for months that have started

### Continuous Gmail Monitoring
- Checks for Venmo payment emails
- Matches to payment requests via tracking IDs
- Updates payment status automatically

## Troubleshooting

### Transaction Issues
- Check `raw_transactions` table for unprocessed items
- Review ETL rules in database
- Use Review page to manually approve

### Payment Tracking
- Verify tracking IDs match between Venmo and system
- Check Gmail sync is working
- Review `venmo_emails` table for matches

### Sync Failures
- SimpleFIN token may be expired
- Check `sync_logs` table for errors
- Run catch-up sync to recover

## Development

See [CLAUDE.md](./CLAUDE.md) for detailed development guidance and architecture notes.

## License

Private project - All rights reserved