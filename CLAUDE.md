# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a comprehensive Landlord Dashboard system for automated rental property management. The platform handles financial tracking, payment collection, maintenance requests, and tax reporting.

### System Components
- **Backend**: Node.js/Express API with PostgreSQL database (Port 3002)
- **Landlord Frontend**: React/TypeScript dashboard with Material-UI (Port 3000)  
- **Tenant Portal**: React self-service portal for maintenance requests (Port 3003)
- **Integrations**: SimpleFIN (bank sync), Gmail OAuth (Venmo tracking), Discord (notifications)

## Key Commands

### Backend Development

```bash
cd backend

# Start development server (with hot reload)
npm run dev

# Run database migrations
npm run migrate

# Run tests
npm test

# Start Docker services (PostgreSQL, LocalStack S3)
docker-compose up -d
```

### Frontend Development

```bash
cd frontend

# Start development server
npm run dev

# Build for production
npm run build

# Run linting
npm run lint
```

### Daily Operations Scripts

```bash
cd backend

# Manual daily sync (fetches bank transactions, processes bills)
node src/scripts/daily/full-sync.js daily 7

# Catch-up sync for missed days
node src/scripts/daily/full-sync.js catch_up 90

# Check sync status
node src/scripts/maintenance/check-sync-status.js

# Fix stuck syncs
node src/scripts/maintenance/fix-stuck-sync.js

# Generate tax report
node test-tax-report.js
```

### Data Import/Export

```bash
# Import Bank of America CSV
node scripts/import-bofa-csv.js "/path/to/bofa history.csv"

# Add rent income for 2025
node scripts/add-rent-income-2025.js

# Reset demo data (Jul-Aug)
node scripts/reset-demo-data.js
```

## Architecture & Data Flow

### Transaction Processing Pipeline

1. **Bank Sync** → SimpleFIN API fetches transactions → stored in `raw_transactions`
2. **ETL Processing** → Rules in `etl_rules` table categorize → moved to `expenses`
3. **Bill Detection** → Utility transactions create entries in `utility_bills`
4. **Payment Requests** → Bills are split 3 ways → `payment_requests` with Venmo links
5. **Email Monitoring** → Gmail API tracks Venmo confirmations → updates payment status
6. **Income Recording** → Payments create entries in `income` table with proper month attribution

### Key Database Tables

- `income` - All revenue (rent, utility reimbursements) with accounting period tracking
- `expenses` - Property expenses with IRS Schedule E categorization
- `payment_requests` - Roommate payment tracking with Venmo integration
- `maintenance_tickets` - Tenant maintenance requests with priority/status tracking
- `venmo_emails` - Gmail-synced payment confirmations
- `etl_rules` - Transaction categorization rules (priority 100+ = auto-approve)
- `raw_transactions` - Unprocessed bank data requiring review

### IRS Schedule E Expense Categories

Updated to match tax form line items:
- `cleaning_maintenance` - Line 7 (was landscape)
- `repairs` - Line 14 (service-based maintenance)
- `supplies` - Line 15 (retail purchases from Home Depot, etc.)
- `property_tax` - Line 16
- `electricity`, `water`, `internet` - Line 17 (utilities)
- `insurance` - Line 9
- `depreciation` - Line 18

## Critical Business Logic

### Payment Request Flow

1. Utility bills automatically split 3 ways
2. Tracking ID format: `{YYYY}{MM}{type}` (e.g., `202407electricity`)
3. Status progression: `pending` → `sent` → `paid` or `foregone`
4. Venmo deep links generated with pre-filled amounts

### Income Attribution Rules

- Income recorded in the **bill month**, not payment month
- Example: March water bill paid in August = March income
- Ensures accurate P&L for each accounting period

### Auto-Approval Rules

Transactions with ETL rules having `priority >= 100` are auto-approved:
- Property tax payments
- Known utility providers
- Regular maintenance vendors

### Maintenance Ticket System

- Priority levels: `urgent`, `high`, `medium`, `low`
- Status workflow: `open` → `in_progress` → `completed` or `cancelled`
- Cost tracking: estimated vs actual
- Shared database with tenant portal for two-way visibility

## Environment Variables

Required in backend/.env:

```
DATABASE_URL=postgresql://user:pass@localhost:5432/landlord_dashboard
PORT=3002
SIMPLEFIN_TOKEN=your_token
DISCORD_WEBHOOK_PAYMENT=https://discord.com/api/webhooks/...
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
```

## Common Issues & Solutions

### Utility Reimbursements as Expenses
- Ensure filters exclude `utility_reimbursement` type
- This represents income, not expenses

### Payment Requests Missing Totals
- Run `node scripts/populate-payment-request-totals.js`
- New requests must include `total_amount` field

### Transactions Stuck in Review
- Check `raw_transactions` table
- Update ETL rules or manually approve in Review page

### SimpleFIN Sync Failures
- Token may be expired - check `simplefin_connections` table
- API timeout common - retry with catch-up sync

## Quality of Life Features

### Intelligent Transaction Review
- Confidence scoring for category suggestions
- Bulk approval workflows
- Learning system creates rules from decisions
- One-click approval for high-confidence matches

### Smart Email Processing
- Fuzzy matching for Venmo payment emails
- Handles name variations and typos
- Unmatched email detection and flagging
- Ignore functionality for irrelevant emails

### Health Monitoring System
- Real-time status dashboard at `/health`
- Process Pending button for bulk operations
- Automatic issue detection
- Data integrity validation

### Tax Report Generation
- IRS Schedule E compliant categorization
- 5-sheet Excel report with complete documentation
- Tracks tax year vs payment year for property taxes
- One-click generation for any year

## Testing Approach

When testing payment flows:
1. Import test transactions via CSV
2. Process bills with catch-up scripts
3. Verify payment requests created correctly
4. Mark payments as paid/foregone in UI
5. Check income records in correct accounting month
6. Verify expense reductions via utility_adjustments

## Frontend State Management

- React 18 with TypeScript
- Material-UI component library
- Payment requests grouped by month
- Real-time updates via polling
- Responsive design for mobile/desktop

## Performance Optimizations

- Database indexes on all foreign keys
- No ORM for complex queries (raw SQL)
- In-memory caching with TTL
- Batch processing for bulk operations
- Connection pooling for database

## Security Measures

- Environment-based configuration
- SQL injection prevention via parameterized queries
- CORS properly configured
- Rate limiting on API endpoints
- Audit logging for all changes

# Important Instruction Reminders

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary
- ALWAYS prefer editing existing files
- NEVER proactively create documentation unless requested
- When running commands, prefer using npm scripts over direct node execution
- Always check for existing ETL rules before creating new ones
- Ensure income is attributed to the correct accounting period