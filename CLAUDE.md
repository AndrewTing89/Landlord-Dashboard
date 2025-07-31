---
editor_options: 
  markdown: 
    wrap: 72
---

# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working
with code in this repository.

## Project Overview

This is a Landlord Dashboard system for automated rental property
financial management. The system consists of: - **Backend**:
Node.js/Express API with PostgreSQL database - **Frontend**:
React/TypeScript application with Material-UI - **Integrations**:
SimpleFIN (bank sync), Gmail API (Venmo tracking), Discord
(notifications)

## Key Commands

### Backend Development

``` bash
cd backend

# Start development server (with hot reload)
npm run dev

# Run database migrations
npm run migrate

# Seed initial data
npm run seed

# Run tests
npm test

# Start Docker services (PostgreSQL, LocalStack S3)
docker-compose up -d
```

### Frontend Development

``` bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

### Daily Operations Scripts

``` bash
cd backend

# Manual daily sync (fetches bank transactions, processes bills)
node src/scripts/daily/full-sync.js daily 7

# Catch-up sync for missed days
node src/scripts/daily/full-sync.js catch_up 90

# Check sync status
node src/scripts/maintenance/check-sync-status.js

# Fix stuck syncs
node src/scripts/maintenance/fix-stuck-sync.js
```

### Data Import/Export

``` bash
# Import Bank of America CSV
node scripts/import-bofa-csv.js "/path/to/bofa history.csv"

# Add rent income for 2025
node scripts/add-rent-income-2025.js

# Mass forego 2024 payments
node scripts/forego-2024-payments.js --no-confirm
```

## Architecture & Data Flow

### Transaction Processing Pipeline

1.  **Bank Sync** → SimpleFIN API fetches transactions → stored in
    `raw_transactions`
2.  **ETL Processing** → Rules in `etl_rules` table categorize
    transactions → moved to `transactions`
3.  **Bill Detection** → Utility transactions create entries in
    `utility_bills`
4.  **Payment Requests** → Bills are split 3 ways → `payment_requests`
    with Venmo links
5.  **Email Monitoring** → Gmail API tracks Venmo confirmations →
    updates payment status

### Key Database Tables

-   `transactions` - Categorized financial transactions
-   `raw_transactions` - Unprocessed bank data (requires manual review)
-   `payment_requests` - Roommate payment tracking (split bills)
-   `etl_rules` - Transaction categorization rules (priority 100+ =
    auto-approve)
-   `venmo_emails` - Gmail-synced payment confirmations

### Expense Categories

-   `electricity` - PG&E bills
-   `water` - Water utility bills
-   `maintenance` - Home Depot, Lowe's, repairs
-   `property_tax` - Property tax payments
-   `insurance` - Property insurance
-   `landscape` - Landscaping services
-   `internet` - Internet bills
-   `rent` - Rental income
-   `utility_reimbursement` - Roommate utility payments (treated as
    income)
-   `other` - Uncategorized (excluded from reports)

## Critical Business Logic

### Payment Request Flow

1.  Utility bills (electricity/water) are automatically split 3 ways
2.  Total amount = bill amount, split amount = total/3
3.  Tracking ID format: `{YYYY}{MM}{type}` (e.g., `202407electricity`)
4.  Status progression: `pending` → `sent` → `paid` or `foregone`

### Auto-Approval Rules

Transactions with ETL rules having `priority >= 100` are
auto-approved: - Property tax payments - Maintenance expenses - Utility
bills from known merchants

### Sync Timing

-   **Daily sync**: Runs at 8 AM, looks back 7 days
-   **Monthly rent**: Added on 1st at 9 AM (\$1,685)
-   **Email check**: Continuous monitoring for Venmo payments

## Environment Variables

Required in backend/.env:

```         
DATABASE_URL=postgresql://user:pass@localhost:5432/landlord_dashboard
SIMPLEFIN_TOKEN=your_token
DISCORD_WEBHOOK_PAYMENT=https://discord.com/api/webhooks/...
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
```

## Common Issues & Solutions

### Utility Reimbursements Showing as Expenses

-   Check that filters exclude `utility_reimbursement` type
-   This type represents income, not expenses

### Payment Requests Missing Total Amount

-   Run `node scripts/populate-payment-request-totals.js`
-   Ensure new requests include `total_amount` field

### Transactions Stuck in Review

-   Check `raw_transactions` table for unprocessed items
-   Update ETL rules or manually approve in Review page

### SimpleFIN Sync Failures

-   Token may be expired - check `simplefin_connections` table
-   API timeout is common - retry with catch-up sync

## Testing Approach

When testing payment flows: 1. Import test transactions via CSV 2.
Process bills with `node scripts/catch-up-utility-bills.js` 3. Check
payment requests were created correctly 4. Mark payments as
paid/foregone in UI 5. Verify utility_reimbursement transactions are
created

## Frontend State Management

The frontend uses React hooks for state: - Payment requests grouped by
month in Active Requests tab - Only `pending` and `sent` statuses shown
in card view - All payment history available in "All Requests" tab -
Real-time status updates via polling
