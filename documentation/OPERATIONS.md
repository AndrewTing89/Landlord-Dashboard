# LANDLORD DASHBOARD - OPERATIONS GUIDE

**Last Updated:** September 21, 2025 8:45 AM UTC

This document provides comprehensive guidance for day-to-day operations of the Landlord Dashboard system. It covers all routine tasks, commands, and procedures needed to manage rental property operations effectively.

## Table of Contents

1. [Daily Operations](#daily-operations)
2. [Payment Management](#payment-management)
3. [Bank Transaction Processing](#bank-transaction-processing)
4. [Month-End Procedures](#month-end-procedures)
5. [Tax Reporting](#tax-reporting)
6. [Data Management](#data-management)
7. [Monitoring & Alerts](#monitoring--alerts)
8. [Troubleshooting](#troubleshooting)

---

## Daily Operations

### Running Daily Sync

The daily sync is the core operational process that imports bank transactions, processes bills, and creates payment requests.

```bash
cd /home/beehiveting/apps/landlord-dashboard/backend

# Standard daily sync (looks back 7 days)
node src/scripts/daily/full-sync.js daily 7

# Catch-up sync for missed days (looks back 90 days)
node src/scripts/daily/full-sync.js catch_up 90

# Quick sync (3 days)
node src/scripts/daily/full-sync.js daily 3
```

**What the daily sync does:**
1. Imports new transactions from SimpleFIN (Bank of America)
2. Applies ETL rules to categorize transactions automatically
3. Detects new utility bills and creates payment requests
4. Generates Venmo links for roommate payments
5. Processes Gmail for Venmo payment confirmations
6. Sends Discord notifications for new transactions and bills

**Best Practice:** Run daily sync every morning to catch up on overnight transactions.

### Checking Sync Status

Monitor sync operations and detect stuck processes:

```bash
# Check recent sync history and status
node src/scripts/maintenance/check-sync-status.js

# Fix stuck syncs (running for more than 10 minutes)
node src/scripts/maintenance/fix-stuck-sync.js
```

### Processing Pending Transactions

Review and process transactions that need manual categorization:

```bash
# Process high-confidence auto-categorizable transactions
node src/scripts/maintenance/process-pending-transactions.js

# Process all raw transactions through ETL rules
node src/scripts/maintenance/process-all-raw-transactions.js

# Process unmatched Venmo payments
node src/scripts/maintenance/process-unmatched-transactions.js
```

### Review Page Workflow

Access the Review page in the web interface (`http://localhost:3000/review`) to:

1. **Review Pending Transactions:** Manually categorize transactions that couldn't be auto-processed
2. **Apply ETL Rules:** Create new categorization rules for recurring merchants
3. **Bulk Actions:** Approve multiple similar transactions at once
4. **Confidence Scoring:** View AI-suggested categories with confidence levels

**Daily Review Checklist:**
- [ ] Check for new pending transactions
- [ ] Review high-confidence suggestions (>90%)
- [ ] Create ETL rules for new recurring merchants
- [ ] Approve legitimate transactions
- [ ] Mark irrelevant transactions as "other"

---

## Payment Management

### Creating Utility Payment Requests

Utility bills are automatically processed during daily sync, but you can manually create requests:

```bash
# Process all utility bills (electricity, water)
node src/scripts/maintenance/process-all-bills.js
```

### Tracking Venmo Payments

Payment confirmations are automatically tracked via Gmail integration:

**Venmo Email Processing:**
1. Gmail API monitors for Venmo payment emails
2. Fuzzy matching links payments to outstanding requests
3. Status automatically updates from `pending` → `paid`
4. Income records are created in the correct accounting month

**Manual Payment Tracking:**
- Access Payment Requests page (`http://localhost:3000/payments`)
- Mark payments as `paid` or `foregone` manually
- View payment history and outstanding amounts

### Creating Rent Payment Requests

Rent requests are created automatically, but can be managed manually:

```bash
# Create rent payment request for specific month/year
cd /home/beehiveting/apps/landlord-dashboard/backend/scripts/utilities
node create-rent-payment-request.js

# Process all missing rent requests for 2025
node create-rent-payment-request.js --cleanup
```

**Rent Payment Process:**
1. Rent requests are created on the 1st of each month
2. Full rent amount ($1685) is requested (not split)
3. Tracking ID format: `{YYYY}{MM}rent` (e.g., `202409rent`)
4. Venmo link includes month, amount, and tracking ID

### Handling Payment Issues

**Common Payment Issues:**

1. **Unmatched Venmo Emails:**
   ```bash
   # Check for unmatched payments
   node src/scripts/development/check-utility-transactions.js
   ```

2. **Duplicate Payments:**
   ```bash
   # Remove duplicate transactions
   node src/scripts/remove-duplicate-transactions.js
   ```

3. **Incorrect Payment Attribution:**
   - Check Payment Requests page for mismatched payments
   - Use `foregone` status for payments that won't be collected
   - Manually create income records if needed

---

## Bank Transaction Processing

### SimpleFIN Automatic Sync

The system automatically syncs with Bank of America via SimpleFIN:

**Configuration:**
- Requires `SIMPLEFIN_TOKEN` in environment variables
- Syncs checking account transactions
- Handles connection timeouts gracefully

**Sync Process:**
1. Fetches transactions from last N days
2. Stores raw data in `raw_transactions` table
3. Applies ETL rules for automatic categorization
4. Moves categorized transactions to `expenses` table
5. Sends Discord notifications for manual review needed

### CSV Import for Manual Transactions

Import Bank of America CSV files for historical data or manual transactions:

```bash
# Import BofA CSV file
node scripts/import-bofa-csv.js "/path/to/bofa_history.csv"

# Simple import (minimal processing)
node scripts/import-bofa-csv-simple.js "/path/to/bofa_history.csv"
```

**CSV Import Process:**
1. Validates CSV format and headers
2. Filters out duplicates using transaction IDs
3. Applies ETL rules for categorization
4. Creates entries in `raw_transactions` for review

### ETL Rule Application

ETL rules automatically categorize transactions based on merchant names and patterns:

**Rule Priority System:**
- Priority >= 100: Auto-approve (high confidence)
- Priority 50-99: Manual review required
- Priority < 50: Low confidence suggestions

**Common ETL Rules:**
- Property taxes: Auto-approve
- Known utility providers (PG&E, EBMUD): Auto-approve
- Venmo rent payments: Auto-categorize as income
- Home Depot, Lowe's: Categorize as supplies

**Creating New Rules:**
1. Use Review page to identify recurring merchants
2. Set appropriate priority level
3. Choose correct expense category
4. Test with existing transactions

### Manual Categorization

For transactions requiring manual review:

**IRS Schedule E Categories:**
- `cleaning_maintenance` - Line 7 (landscape, cleaning)
- `repairs` - Line 14 (contractor services, maintenance)
- `supplies` - Line 15 (Home Depot, materials)
- `property_tax` - Line 16
- `electricity`, `water`, `internet` - Line 17 (utilities)
- `insurance` - Line 9
- `depreciation` - Line 18

**Categorization Guidelines:**
- **Repairs:** Service-based work (plumber, electrician)
- **Supplies:** Retail purchases (hardware, materials)
- **Maintenance:** Regular upkeep (gardening, cleaning)
- **Utilities:** Split 3-ways with roommates
- **Other:** Non-deductible or personal expenses

---

## Month-End Procedures

### Rent Payment Request Creation

Ensure all rent requests are created for the current month:

```bash
# Verify rent requests for current month
node scripts/utilities/create-rent-payment-request.js
```

### Utility Bill Reconciliation

Verify all utility bills have been processed and payment requests created:

```bash
# Process any missed utility bills
node src/scripts/maintenance/process-all-bills.js

# Check for utility transactions without payment requests
node src/scripts/development/check-utility-transactions.js
```

### Income Verification

Verify all payments are properly recorded:

**Income Attribution Rules:**
- Income is recorded in the **bill month**, not payment month
- Example: March water bill paid in August = March income
- Ensures accurate P&L for each accounting period

**Verification Process:**
1. Review Payment Requests page for all `paid` statuses
2. Check income records in database match payment requests
3. Verify utility reimbursements are properly split
4. Confirm rent payments are recorded in correct month

### Missing Payment Follow-up

Identify and follow up on overdue payments:

**Payment Status Review:**
1. Access Payment Requests page
2. Filter by `pending` status and past due date
3. Send follow-up Discord notifications
4. Mark as `foregone` if payment won't be collected

**Discord Notifications:**
```bash
# Send manual Discord notification for overdue payments
node src/scripts/development/send-all-pending-to-discord.js
```

---

## Tax Reporting

### Running Tax Reports

Generate comprehensive tax reports following IRS Schedule E format:

**Via Web Interface:**
1. Access Reports page (`http://localhost:3000/reports`)
2. Select tax year
3. Click "Generate Tax Report"
4. Download Excel file with 5 detailed sheets

**Via Command Line:**
```bash
# Generate tax report via API endpoint
curl -X POST http://localhost:3002/api/reports/tax/2024
```

**Report Contents:**
1. **Summary Sheet:** High-level income and expense totals
2. **Income Details:** All rental income and utility reimbursements
3. **Expense Details:** All categorized expenses with vendor info
4. **Monthly Breakdown:** Month-by-month P&L analysis
5. **Schedule E Format:** IRS-compliant tax form format

### IRS Schedule E Categories

The system maps expenses to specific IRS Schedule E lines:

| Line | Category | System Field | Examples |
|------|----------|--------------|----------|
| 7 | Cleaning and Maintenance | `cleaning_maintenance` | Gardening, housekeeping |
| 9 | Insurance | `insurance` | Property insurance |
| 14 | Repairs | `repairs` | Plumber, electrician |
| 15 | Supplies | `supplies` | Home Depot, materials |
| 16 | Taxes | `property_tax` | County property taxes |
| 17 | Utilities | `electricity`, `water`, `internet` | PG&E, EBMUD |
| 18 | Depreciation | `depreciation` | Manual entry only |

### Income vs Expense Tracking

**Income Categories:**
- `rent` - Monthly rent payments ($1685)
- `utility_reimbursement` - Roommate utility payments
- `other` - Miscellaneous property income

**Expense Tracking:**
- All property-related expenses are tax deductible
- Utility reimbursements offset utility expenses
- Personal expenses should be categorized as `other`

### Year-End Procedures

**December Year-End Checklist:**
- [ ] Process all December transactions
- [ ] Generate final tax report for the year
- [ ] Verify all income is properly attributed
- [ ] Check for any unprocessed bank transactions
- [ ] Archive completed payment requests
- [ ] Backup database before new year

---

## Data Management

### Database Backups

Regular backups are essential for data protection:

```bash
# Create database backup
pg_dump landlord_dashboard > backups/landlord_dashboard_$(date +%Y%m%d).sql

# Restore from backup
psql landlord_dashboard < backups/landlord_dashboard_20240915.sql
```

**Backup Schedule:**
- Daily automated backups via cron
- Weekly full database dumps
- Monthly archived backups
- Before major system updates

### Cleaning Old Data

Remove old demo data and test transactions:

```bash
# Clean test data for July-August demo period
node scripts/reset-demo-data.js

# Remove duplicate transactions
node src/scripts/remove-duplicate-transactions.js

# Clean up old raw transactions
node src/scripts/clear-simplefin-transactions.js
```

### Archiving Completed Months

Archive old data to improve performance:

```bash
# Archive transactions older than 2 years
node src/scripts/archive/clean-old-payment-requests.js
```

**Data Retention Policy:**
- Keep all tax-related data for 7 years
- Archive payment requests after 1 year
- Maintain raw transaction history indefinitely
- Clean up test/demo data regularly

---

## Monitoring & Alerts

### Discord Notifications

The system sends automatic Discord notifications for:

**Payment Activities:**
- New utility bills requiring payment
- Payment confirmations from Venmo
- Overdue payment reminders
- Failed payment processing

**System Activities:**
- Daily sync completion summaries
- Transaction review requirements
- System errors and failures
- Database connection issues

**Configuration:**
```bash
# Environment variables for Discord
DISCORD_WEBHOOK_PAYMENT=https://discord.com/api/webhooks/...
```

### Health Check Endpoint

Monitor system health via the health check endpoint:

```bash
# Check system health
curl http://localhost:3002/api/health

# Detailed health status via web interface
http://localhost:3000/health
```

**Health Check Components:**
- Database connectivity
- SimpleFIN API status
- Gmail OAuth connection
- Discord webhook functionality
- Recent sync status

### Sync Failure Alerts

Monitor and respond to sync failures:

**Common Failure Causes:**
1. SimpleFIN timeout (retry with smaller lookback period)
2. Database connection issues
3. Gmail OAuth token expiration
4. Network connectivity problems

**Response Procedures:**
1. Check health endpoint for specific error
2. Retry sync with reduced scope
3. Check environment variable configuration
4. Restart services if needed

### Payment Reminders

Automated reminders for overdue payments:

**Reminder Schedule:**
- Day 7: First reminder (gentle)
- Day 14: Second reminder (firm)
- Day 30: Final notice (mark as foregone if no response)

**Manual Reminders:**
```bash
# Send manual payment reminder
node src/scripts/development/send-all-pending-to-discord.js
```

---

## Troubleshooting

### Common Issues and Solutions

#### 1. SimpleFIN Sync Failures

**Symptoms:**
- Daily sync reports "SimpleFIN sync error"
- No new transactions imported
- Timeout errors in logs

**Solutions:**
```bash
# Check SimpleFIN connection
node src/scripts/development/test-simplefin-connection.js

# Retry with smaller lookback period
node src/scripts/daily/full-sync.js daily 3

# Check token expiration
# Renew SimpleFIN token if necessary
```

#### 2. Gmail OAuth Issues

**Symptoms:**
- Venmo emails not being processed
- Gmail authentication errors
- No payment confirmations updating

**Solutions:**
```bash
# Test Gmail connection
node src/scripts/development/test-gmail-connection.sh

# Re-authenticate Gmail OAuth
# Visit: http://localhost:3002/api/gmail/auth

# Check OAuth tokens
node src/scripts/development/gmail-quick-check.js
```

#### 3. Payment Request Mismatches

**Symptoms:**
- Venmo payments not matching requests
- Duplicate payment requests
- Incorrect payment amounts

**Solutions:**
```bash
# Check payment matching
node src/scripts/development/check-utility-transactions.js

# Manually match payments in web interface
# Mark incorrect requests as 'foregone'

# Recreate payment requests if needed
node src/scripts/maintenance/process-all-bills.js
```

#### 4. Database Connection Issues

**Symptoms:**
- Scripts fail with database errors
- Web interface won't load
- Health check fails

**Solutions:**
```bash
# Check database status
systemctl status postgresql

# Test database connection
psql landlord_dashboard -c "SELECT NOW();"

# Restart database if needed
sudo systemctl restart postgresql

# Check connection pool
node -e "const db = require('./src/db/connection'); db.query('SELECT 1');"
```

#### 5. Duplicate Transactions

**Symptoms:**
- Same transaction appears multiple times
- Incorrect expense totals
- CSV import creates duplicates

**Solutions:**
```bash
# Remove duplicate transactions
node src/scripts/remove-duplicate-transactions.js

# Remove recent duplicates only
node src/scripts/remove-recent-duplicates.js

# Check for duplicate rules
# Review ETL rules for conflicts
```

### Emergency Procedures

#### System Recovery

If the system becomes unresponsive:

1. **Check Health Status:**
   ```bash
   curl http://localhost:3002/api/health
   ```

2. **Restart Services:**
   ```bash
   sudo systemctl restart landlord-dashboard
   pm2 restart all
   ```

3. **Database Recovery:**
   ```bash
   # Restore from latest backup
   psql landlord_dashboard < backups/landlord_dashboard_latest.sql
   ```

4. **Clear Stuck Syncs:**
   ```bash
   node src/scripts/maintenance/fix-stuck-sync.js
   ```

#### Data Corruption Recovery

If data appears corrupted:

1. **Stop All Services:**
   ```bash
   sudo systemctl stop landlord-dashboard
   ```

2. **Restore from Backup:**
   ```bash
   dropdb landlord_dashboard
   createdb landlord_dashboard
   psql landlord_dashboard < backups/landlord_dashboard_clean.sql
   ```

3. **Re-run Recent Syncs:**
   ```bash
   node src/scripts/daily/full-sync.js catch_up 30
   ```

4. **Verify Data Integrity:**
   ```bash
   node src/scripts/development/check-all-transactions.js
   ```

### Logging and Debugging

**Log Locations:**
- Application logs: `/var/log/landlord-dashboard/`
- Database logs: `/var/log/postgresql/`
- System logs: `journalctl -u landlord-dashboard`

**Debug Commands:**
```bash
# Enable debug logging
DEBUG=* node src/scripts/daily/full-sync.js

# Check recent transactions
node src/scripts/development/check-recent-transactions.js

# Verify database structure
node src/scripts/development/check-table-structure.js
```

---

## Quick Reference

### Daily Commands
```bash
# Essential daily operations
node src/scripts/daily/full-sync.js daily 7
node src/scripts/maintenance/check-sync-status.js
```

### Weekly Commands
```bash
# Weekly maintenance
node src/scripts/maintenance/process-pending-transactions.js
node src/scripts/remove-duplicate-transactions.js
```

### Monthly Commands
```bash
# Month-end procedures
node scripts/utilities/create-rent-payment-request.js
node src/scripts/maintenance/process-all-bills.js
```

### Emergency Commands
```bash
# Emergency procedures
node src/scripts/maintenance/fix-stuck-sync.js
curl http://localhost:3002/api/health
```

### File Paths
- Scripts: `/home/beehiveting/apps/landlord-dashboard/backend/src/scripts/`
- Config: `/home/beehiveting/apps/landlord-dashboard/backend/config/`
- Logs: `/var/log/landlord-dashboard/`
- Backups: `/home/beehiveting/apps/landlord-dashboard/backend/backups/`

---

**Last Updated:** September 2024  
**Version:** 2.0  
**Maintainer:** Property Management System

For additional support, check the health dashboard at `http://localhost:3000/health` or review recent Discord notifications for system status updates.