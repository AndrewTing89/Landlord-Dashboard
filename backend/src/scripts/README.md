# Scripts Directory Structure

This directory contains various scripts for maintaining and operating the Landlord Dashboard system.

## Directory Organization

### `/daily`
Scripts that run on a regular schedule:
- `full-sync.js` - Main sync script for SimpleFIN transactions and bill processing

### `/maintenance`
System maintenance and data cleanup scripts:
- `fix-stuck-sync.js` - Fix sync processes stuck in running state
- `check-sync-status.js` - Check current sync status and history
- `add-performance-indexes.js` - Add database indexes for performance
- `delete-jun-jul-data.js` - Clean up test data (move to archive after use)

### `/development`
Development and testing utilities:
- `check-recent-transactions.js` - Debug transaction import issues
- `check-invalid-transactions.js` - Find transactions with invalid data
- `check-utility-transactions.js` - Debug utility bill detection

### `/migrations`
One-time data migrations (move to `/archive` after running):
- `fix-payment-request-data.js` - Fix missing month/year in payment requests
- `fix-charge-dates.js` - Add charge dates to payment requests
- `fix-utility-transactions.js` - Fix utility transaction categorization
- `create-historical-payment-requests.js` - Create payment requests for past bills

### `/archive`
Completed migrations and old scripts (kept for reference)

## Common Scripts

### Daily Operations
```bash
# Run daily sync (7 days lookback)
node daily/full-sync.js daily 7

# Run catch-up sync (90 days lookback)
node daily/full-sync.js catch_up 90
```

### Troubleshooting
```bash
# Check sync status
node maintenance/check-sync-status.js

# Fix stuck syncs
node maintenance/fix-stuck-sync.js

# Check recent transactions
node development/check-recent-transactions.js
```

### Database Maintenance
```bash
# Add performance indexes
node maintenance/add-performance-indexes.js

# Clean old data
node maintenance/clean-old-data.js
```

## Script Naming Conventions

- Use descriptive names with hyphens (e.g., `check-sync-status.js`)
- Prefix with action verb (check-, fix-, create-, process-, etc.)
- Include date in migration scripts if relevant (e.g., `2025-07-migrate-expense-types.js`)

## Adding New Scripts

1. Determine the appropriate directory based on purpose
2. Follow the naming conventions
3. Add documentation here
4. Include a header comment in the script explaining its purpose
5. Move to `/archive` when no longer needed

## Environment Variables

All scripts inherit environment variables from the parent `.env` file. Key variables:
- `DATABASE_URL` - PostgreSQL connection string
- `SIMPLEFIN_TOKEN` - SimpleFIN API access
- `DISCORD_WEBHOOK_*` - Discord notification webhooks