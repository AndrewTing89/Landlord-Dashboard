# Backend Scripts

## Directory Structure

### /import
Scripts for importing data from external sources:
- `import-bofa-csv.js` - Import Bank of America CSV files

### /setup  
Initial configuration scripts:
- `setup-etl-rules.js` - Configure ETL processing rules
- `setup-simplefin.js` - Set up SimpleFIN bank sync
- `setup-daily-sync-cron.sh` - Configure daily sync cron job
- `setup-cron.sh` - General cron setup

### /utilities
Operational utility scripts:
- `create-rent-payment-request.js` - Create monthly rent payment requests
- `monthly-rent-check.js` - Check and create rent requests
- `add-rent-income-2025.js` - Add rent income for 2025
- `undo-payment.js` - Undo/reverse payment transactions

### Root Scripts
- `run-etl-processing.js` - Run ETL processing on raw transactions
- `reset-demo-data.js` - Reset database to demo state

## Daily Operations

### Bank Sync & Processing
```bash
# Run daily sync (in src/scripts/daily/)
node src/scripts/daily/full-sync.js

# Process unmatched transactions
node run-etl-processing.js
```

### Payment Management
```bash
# Create rent payment requests
node utilities/create-rent-payment-request.js

# Check for missing rent requests
node utilities/monthly-rent-check.js

# Undo a payment if needed
node utilities/undo-payment.js
```

### Import Data
```bash
# Import Bank of America CSV
node import/import-bofa-csv.js "/path/to/bofa.csv"
```

## Key Scripts in src/scripts

### Daily Operations
- `daily/full-sync.js` - Complete daily sync (transactions, bills, payments)
- `catch-up-utility-bills.js` - Create missing payment requests for utilities

### Maintenance
- `maintenance/check-sync-status.js` - Check sync health
- `maintenance/fix-stuck-sync.js` - Fix stuck sync processes
- `maintenance/process-pending-transactions.js` - Process pending transactions

### Development Tools (src/scripts/development)
- `gmail-tools.js` - Gmail OAuth utilities
- `send-all-pending-to-discord.js` - Send pending requests to Discord