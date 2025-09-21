# Landlord Dashboard - Troubleshooting Guide

This guide provides solutions to common issues encountered in the Landlord Dashboard system. For each problem, we provide the error symptoms, root causes, and step-by-step solutions.

## Table of Contents

1. [Sync Issues](#sync-issues)
2. [Payment Request Problems](#payment-request-problems)
3. [Database Issues](#database-issues)
4. [Email/Venmo Matching](#emailvenmo-matching)
5. [Frontend Issues](#frontend-issues)
6. [Docker Problems](#docker-problems)
7. [Quick Diagnostic Commands](#quick-diagnostic-commands)
8. [Data Recovery](#data-recovery)

---

## Sync Issues

### SimpleFIN Timeout Errors

**Symptoms:**
- `Error: timeout of 30000ms exceeded` in sync logs
- Transactions not appearing in dashboard
- SimpleFIN sync shows as failed

**Root Cause:** SimpleFIN API timeouts during large data fetches or network connectivity issues.

**Solutions:**

1. **Check SimpleFIN Connection Status:**
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query('SELECT * FROM simplefin_connections ORDER BY created_at DESC LIMIT 1')
  .then(result => console.log('Connection:', result.rows[0]))
  .catch(err => console.error('DB Error:', err));
"
```

2. **Retry with Shorter Date Range:**
```bash
# Instead of 90 days, try 30 days
node src/scripts/daily/full-sync.js catch_up 30
```

3. **Manual Token Refresh:**
```bash
# Check if token is expired
node src/scripts/setup/setup-simplefin.js
```

4. **Increase Timeout in Code:**
```javascript
// In src/services/simplefinService.js, increase timeout:
const response = await axios.get(url, { 
  timeout: 60000,  // Increase from 30000
  headers: { Authorization: `Bearer ${token}` }
});
```

### Stuck Sync Processes

**Symptoms:**
- Sync status shows "in_progress" indefinitely
- New syncs won't start
- Error: "Sync already in progress"

**Root Cause:** Previous sync process didn't complete properly and left status locked.

**Solution:**
```bash
cd backend
node src/scripts/maintenance/fix-stuck-sync.js
```

**Manual Fix:**
```sql
-- Check stuck syncs
SELECT * FROM sync_history WHERE status = 'in_progress' ORDER BY created_at DESC;

-- Reset stuck sync
UPDATE sync_history 
SET status = 'failed', error_message = 'Manually reset - process stuck'
WHERE status = 'in_progress' AND created_at < NOW() - INTERVAL '2 hours';
```

### Missing Transactions

**Symptoms:**
- Bank account shows transactions that don't appear in dashboard
- Gaps in transaction history
- Sync completes but transaction count is low

**Root Cause:** Date range issues, account filtering, or duplicate detection removing valid transactions.

**Solutions:**

1. **Check Raw Transactions:**
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query('SELECT COUNT(*) as raw_count FROM raw_transactions WHERE created_at > NOW() - INTERVAL \\'7 days\\'')
  .then(result => console.log('Raw transactions (7 days):', result.rows[0].raw_count));
"
```

2. **Check ETL Processing:**
```bash
node src/scripts/maintenance/process-all-raw-transactions.js
```

3. **Manual Date Range Sync:**
```javascript
// Edit src/scripts/daily/full-sync.js to specify exact dates
const startDate = '2024-01-01';
const endDate = '2024-01-31';
```

### Duplicate Imports

**Symptoms:**
- Same transaction appears multiple times
- Constraint violation errors
- Inflated expense totals

**Root Cause:** Multiple sync processes running simultaneously or CSV imports overlapping with API sync.

**Solutions:**

1. **Remove Recent Duplicates:**
```bash
cd backend
node src/scripts/remove-recent-duplicates.js
```

2. **Check for Duplicate Sources:**
```sql
-- Find duplicate transactions
SELECT description, amount, date, COUNT(*) as count
FROM expenses 
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY description, amount, date
HAVING COUNT(*) > 1;
```

3. **Prevent Future Duplicates:**
```bash
# Ensure only one sync process runs
ps aux | grep "full-sync.js"
kill -9 [PID_IF_RUNNING]
```

---

## Payment Request Problems

### Duplicate Payment Requests

**Symptoms:**
- Multiple payment requests for same bill
- Roommates receive duplicate Venmo requests
- Database constraint errors on tracking_id

**Root Cause:** Bill processing running multiple times or failed transaction rollbacks.

**Solutions:**

1. **Remove Duplicates:**
```sql
-- Find duplicates
SELECT tracking_id, COUNT(*) as count
FROM payment_requests 
GROUP BY tracking_id
HAVING COUNT(*) > 1;

-- Remove duplicates (keep oldest)
DELETE FROM payment_requests 
WHERE id NOT IN (
  SELECT MIN(id) 
  FROM payment_requests 
  GROUP BY tracking_id
);
```

2. **Check Bill Processing Status:**
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query('SELECT * FROM utility_bills WHERE created_at > NOW() - INTERVAL \\'7 days\\' ORDER BY created_at DESC')
  .then(result => console.log('Recent bills:', result.rows.length));
"
```

### Missing Payment Requests for Roommates

**Symptoms:**
- Utility bills exist but no payment requests created
- Only some roommates get requests
- `total_amount` field is null

**Root Cause:** Bill processing incomplete or roommate configuration issues.

**Solutions:**

1. **Check Roommate Configuration:**
```bash
cd backend
node -e "console.log('Roommates:', require('./config/roommate.config.js'));"
```

2. **Reprocess Bills:**
```bash
node src/scripts/maintenance/process-all-bills.js
```

3. **Manual Payment Request Creation:**
```bash
# For specific bill
node scripts/utilities/create-rent-payment-request.js
```

### Wrong Amounts or Splits

**Symptoms:**
- Payment requests show incorrect amounts
- Splits not dividing by 3 properly
- Rounding errors in totals

**Root Cause:** Calculation errors in bill splitting logic or missing total_amount.

**Solutions:**

1. **Recalculate Totals:**
```sql
-- Update missing totals
UPDATE payment_requests 
SET total_amount = (
  SELECT amount FROM utility_bills 
  WHERE utility_bills.tracking_id = payment_requests.tracking_id
)
WHERE total_amount IS NULL;
```

2. **Fix Splitting Logic:**
```javascript
// In src/services/paymentRequestService.js
const individualAmount = Math.round((totalAmount / 3) * 100) / 100;
```

### Venmo Link Issues

**Symptoms:**
- Venmo links don't work on mobile
- Links show wrong amounts
- Links missing recipient information

**Root Cause:** URL encoding issues or Venmo deep link format changes.

**Solutions:**

1. **Test Link Generation:**
```bash
cd backend
node -e "
const venmoService = require('./src/services/venmoLinkService');
const link = venmoService.generateVenmoLink('John Doe', 50.00, 'Test payment');
console.log('Generated link:', link);
"
```

2. **Update Link Format:**
```javascript
// In src/services/venmoLinkService.js
const venmoUrl = `venmo://pay?recipients=${encodeURIComponent(recipientName)}&amount=${amount}&note=${encodeURIComponent(note)}`;
```

---

## Database Issues

### Connection Errors (EAI_AGAIN landlord-postgres)

**Symptoms:**
- `Error: getaddrinfo EAI_AGAIN landlord-postgres`
- Database connection refused
- App crashes on startup

**Root Cause:** Docker container not running or network connectivity issues.

**Solutions:**

1. **Check Docker Status:**
```bash
docker ps | grep postgres
docker-compose ps
```

2. **Restart Database:**
```bash
docker-compose down
docker-compose up -d postgres
```

3. **Check Network Configuration:**
```bash
# Test connection
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d landlord_dashboard -c "SELECT 1;"
```

4. **Update Connection String:**
```bash
# If using localhost instead of container name
export DATABASE_URL="postgresql://postgres:password@localhost:5432/landlord_dashboard"
```

### Migration Failures

**Symptoms:**
- `Migration failed: duplicate column name`
- `relation "table_name" does not exist`
- App won't start due to schema mismatch

**Root Cause:** Migrations running out of order or partial migration completion.

**Solutions:**

1. **Check Migration Status:**
```sql
SELECT * FROM schema_migrations ORDER BY version;
```

2. **Run Specific Migration:**
```bash
cd backend
node src/db/migrate.js 024_create_unified_transactions_table.sql
```

3. **Reset and Rerun:**
```bash
# Backup first!
pg_dump landlord_dashboard > backup_before_reset.sql

# Drop and recreate
dropdb landlord_dashboard
createdb landlord_dashboard
npm run migrate
```

### Constraint Violations

**Symptoms:**
- `duplicate key value violates unique constraint`
- `foreign key constraint violates`
- Insert/update operations failing

**Root Cause:** Data integrity issues or concurrent operations.

**Solutions:**

1. **Find Constraint Violations:**
```sql
-- Check for orphaned records
SELECT * FROM payment_requests p
LEFT JOIN utility_bills u ON p.tracking_id = u.tracking_id
WHERE u.tracking_id IS NULL;

-- Check for duplicates
SELECT tracking_id, COUNT(*) 
FROM payment_requests 
GROUP BY tracking_id 
HAVING COUNT(*) > 1;
```

2. **Fix Data Issues:**
```sql
-- Remove orphaned payment requests
DELETE FROM payment_requests 
WHERE tracking_id NOT IN (SELECT tracking_id FROM utility_bills);

-- Update invalid foreign keys
UPDATE expenses 
SET category = 'other' 
WHERE category NOT IN (SELECT name FROM expense_categories);
```

### Data Integrity Issues

**Symptoms:**
- Totals don't match between tables
- Missing related records
- Inconsistent timestamps

**Root Cause:** Failed transactions, incomplete data migrations, or concurrent updates.

**Solutions:**

1. **Run Data Validation:**
```bash
cd backend
node src/scripts/development/check-all-transactions.js
```

2. **Fix Income/Expense Mismatches:**
```sql
-- Check for unmatched payment requests
SELECT pr.*, vr.status 
FROM payment_requests pr
LEFT JOIN venmo_emails ve ON pr.tracking_id = ve.tracking_id
WHERE pr.status = 'paid' AND ve.id IS NULL;
```

---

## Email/Venmo Matching

### Gmail OAuth Token Expiration

**Symptoms:**
- `Error: invalid_grant` in Gmail sync logs
- Venmo payments not being detected
- Email monitoring stops working

**Root Cause:** OAuth refresh token expired or revoked.

**Solutions:**

1. **Check Token Status:**
```bash
cd backend
node src/scripts/development/test-gmail-sync.js
```

2. **Reauthorize Gmail:**
```bash
# Delete existing token
rm config/gmail-token.json

# Start reauth process
node src/scripts/setup/setup-gmail.js
```

3. **Manual Token Refresh:**
```javascript
// In src/services/gmailService.js
async function refreshToken() {
  const { client_secret, client_id, refresh_token } = credentials;
  // Implementation for token refresh
}
```

### Unmatched Payment Emails

**Symptoms:**
- Venmo emails in database but payments still show as pending
- Wrong payment amounts being matched
- Multiple emails for same payment

**Root Cause:** Fuzzy matching algorithm failing or tracking ID format changes.

**Solutions:**

1. **Check Unmatched Emails:**
```sql
SELECT * FROM venmo_emails 
WHERE tracking_id IS NULL 
AND ignored = false 
ORDER BY created_at DESC;
```

2. **Manual Matching:**
```bash
cd backend
node -e "
const matcher = require('./src/services/venmoMatchingService');
matcher.matchUnprocessedEmails();
"
```

3. **Adjust Matching Logic:**
```javascript
// In src/services/venmoMatchingService.js
// Increase fuzzy matching threshold
const similarity = stringSimilarity.compareTwoStrings(description, emailNote);
if (similarity > 0.6) { // Lower from 0.8 for more matches
  // Match found
}
```

### Wrong Payment Associations

**Symptoms:**
- Payment marked as paid but for wrong bill
- Multiple bills marked as paid from single Venmo
- Incorrect payment amounts

**Root Cause:** Ambiguous tracking IDs or timing issues in email processing.

**Solutions:**

1. **Check Payment Associations:**
```sql
SELECT ve.email_subject, ve.amount, pr.amount, pr.tracking_id
FROM venmo_emails ve
JOIN payment_requests pr ON ve.tracking_id = pr.tracking_id
WHERE ve.created_at > NOW() - INTERVAL '7 days';
```

2. **Reset Wrong Associations:**
```sql
-- Unlink wrong associations
UPDATE venmo_emails 
SET tracking_id = NULL 
WHERE id = [WRONG_EMAIL_ID];

UPDATE payment_requests 
SET status = 'pending', paid_date = NULL 
WHERE tracking_id = '[WRONG_TRACKING_ID]';
```

### Tracking ID Mismatches

**Symptoms:**
- Email mentions bill but tracking ID doesn't match
- Case sensitivity issues in matching
- Format differences between systems

**Root Cause:** Inconsistent tracking ID generation or user input variations.

**Solutions:**

1. **Standardize Tracking IDs:**
```javascript
// In src/utils/trackingId.js
function normalizeTrackingId(id) {
  return id.toLowerCase().replace(/[^a-z0-9]/g, '');
}
```

2. **Bulk Fix Tracking IDs:**
```sql
-- Standardize format
UPDATE payment_requests 
SET tracking_id = LOWER(REGEXP_REPLACE(tracking_id, '[^a-zA-Z0-9]', '', 'g'));
```

---

## Frontend Issues

### White Screen/502 Errors

**Symptoms:**
- Frontend shows blank white page
- 502 Bad Gateway errors
- Console shows network errors

**Root Cause:** Backend API not responding or CORS configuration issues.

**Solutions:**

1. **Check Backend Status:**
```bash
curl http://localhost:3002/health
```

2. **Restart Backend:**
```bash
cd backend
npm run dev
```

3. **Check CORS Configuration:**
```javascript
// In src/server.js
app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:3003'],
  credentials: true
}));
```

### Data Not Updating

**Symptoms:**
- Page shows stale data
- Manual refresh required to see changes
- Real-time updates not working

**Root Cause:** Caching issues or polling intervals too long.

**Solutions:**

1. **Clear Browser Cache:**
```bash
# Force refresh
Ctrl+Shift+R (Windows/Linux)
Cmd+Shift+R (Mac)
```

2. **Check Polling Intervals:**
```javascript
// In frontend components
useEffect(() => {
  const interval = setInterval(fetchData, 5000); // Reduce from 30000
  return () => clearInterval(interval);
}, []);
```

3. **Disable Cache in Development:**
```javascript
// In vite.config.ts
export default defineConfig({
  server: {
    headers: {
      'Cache-Control': 'no-cache'
    }
  }
});
```

### Login Problems

**Symptoms:**
- Can't login to tenant portal
- Authentication redirects failing
- Session expires immediately

**Root Cause:** JWT configuration or tenant authentication issues.

**Solutions:**

1. **Check JWT Secret:**
```bash
cd backend
echo $JWT_SECRET
```

2. **Test Authentication:**
```bash
curl -X POST http://localhost:3002/api/tenant/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"test","password":"test"}'
```

3. **Reset Tenant Credentials:**
```sql
-- Update tenant password
UPDATE tenants 
SET password_hash = '$2b$10$...' -- Use bcrypt to hash new password
WHERE username = 'tenant1';
```

### CORS Errors

**Symptoms:**
- `Access-Control-Allow-Origin` errors
- OPTIONS requests failing
- Cross-origin requests blocked

**Root Cause:** CORS middleware not configured for all required origins.

**Solutions:**

1. **Update CORS Configuration:**
```javascript
// In src/server.js
app.use(cors({
  origin: function (origin, callback) {
    const allowedOrigins = [
      'http://localhost:3000',
      'http://localhost:3003',
      'https://your-domain.com'
    ];
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true
}));
```

2. **Add Preflight Handling:**
```javascript
app.options('*', cors()); // Enable preflight for all routes
```

---

## Docker Problems

### Container Not Starting

**Symptoms:**
- `docker-compose up` fails
- Container exits immediately
- Port binding errors

**Root Cause:** Port conflicts, missing environment variables, or image build issues.

**Solutions:**

1. **Check Port Conflicts:**
```bash
netstat -tulpn | grep :5432
lsof -i :5432
```

2. **Check Container Logs:**
```bash
docker-compose logs postgres
docker logs [container_id]
```

3. **Rebuild Containers:**
```bash
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

### Network Connectivity

**Symptoms:**
- Containers can't communicate
- Database connection refused
- Service discovery failing

**Root Cause:** Docker network configuration or firewall issues.

**Solutions:**

1. **Check Network:**
```bash
docker network ls
docker network inspect landlord-dashboard_default
```

2. **Test Container Communication:**
```bash
docker exec -it backend_container ping postgres_container
```

3. **Recreate Network:**
```bash
docker-compose down
docker network prune
docker-compose up -d
```

### Port Conflicts

**Symptoms:**
- `Port already in use` errors
- Can't bind to localhost ports
- Services inaccessible

**Root Cause:** Other services using same ports.

**Solutions:**

1. **Find Process Using Port:**
```bash
sudo lsof -i :3002
sudo netstat -tulpn | grep :3002
```

2. **Kill Conflicting Process:**
```bash
sudo kill -9 [PID]
```

3. **Change Port Configuration:**
```yaml
# In docker-compose.yml
services:
  backend:
    ports:
      - "3004:3002"  # Use different external port
```

### Volume Mounting Issues

**Symptoms:**
- Database data not persisting
- File changes not reflected in container
- Permission denied errors

**Root Cause:** Volume mount configuration or file permissions.

**Solutions:**

1. **Check Volume Mounts:**
```bash
docker inspect [container_id] | grep -A 10 "Mounts"
```

2. **Fix Permissions:**
```bash
sudo chown -R 999:999 ./postgres_data
chmod -R 755 ./postgres_data
```

3. **Recreate Volumes:**
```bash
docker-compose down -v
docker volume prune
docker-compose up -d
```

---

## Quick Diagnostic Commands

### Check Database Connection
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query('SELECT NOW() as current_time')
  .then(result => {
    console.log('✅ Database connected:', result.rows[0].current_time);
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Database error:', err.message);
    process.exit(1);
  });
"
```

### Verify Sync Status
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query('SELECT * FROM sync_history ORDER BY created_at DESC LIMIT 5')
  .then(result => {
    console.log('Recent syncs:');
    result.rows.forEach(row => {
      console.log(\`\${row.created_at}: \${row.status} (\${row.transaction_count || 0} transactions)\`);
    });
  });
"
```

### List Pending Transactions
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query('SELECT COUNT(*) as count FROM raw_transactions WHERE processed = false')
  .then(result => console.log('Pending transactions:', result.rows[0].count));
"
```

### Check Payment Request Status
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query('SELECT status, COUNT(*) as count FROM payment_requests GROUP BY status')
  .then(result => {
    console.log('Payment request status:');
    result.rows.forEach(row => console.log(\`\${row.status}: \${row.count}\`));
  });
"
```

### View Recent Errors
```bash
cd backend
tail -n 50 backend.log | grep -i error
```

### Check Service Health
```bash
curl -s http://localhost:3002/health | jq '.'
```

### Verify Docker Services
```bash
docker-compose ps
docker stats --no-stream
```

---

## Data Recovery

### Restore from Backup

**Complete Database Restore:**
```bash
# Stop applications
docker-compose down

# Restore database
psql -U postgres -d postgres -c "DROP DATABASE IF EXISTS landlord_dashboard;"
psql -U postgres -d postgres -c "CREATE DATABASE landlord_dashboard;"
psql -U postgres -d landlord_dashboard < backups/landlord_dashboard_latest_backup.sql

# Restart services
docker-compose up -d
```

**Selective Table Restore:**
```bash
# Extract specific table
pg_restore -t payment_requests backup.sql > payment_requests_only.sql
psql -U postgres -d landlord_dashboard < payment_requests_only.sql
```

### Fix Corrupt Data

**Rebuild Payment Requests:**
```bash
cd backend

# Backup current state
pg_dump landlord_dashboard > backup_before_rebuild.sql

# Clear corrupted payment requests
node -e "
const db = require('./src/db/connection');
db.query('DELETE FROM payment_requests WHERE created_at > NOW() - INTERVAL \\'7 days\\'')
  .then(() => console.log('Cleared recent payment requests'));
"

# Regenerate from bills
node src/scripts/maintenance/process-all-bills.js
```

**Fix Transaction Categories:**
```sql
-- Reset uncategorized transactions
UPDATE expenses 
SET category = 'other', 
    subcategory = 'miscellaneous'
WHERE category IS NULL OR category = '';

-- Reprocess with ETL rules
```

### Undo Wrong Payments

**Mark Payment as Unpaid:**
```bash
cd backend
node scripts/utilities/undo-payment.js [TRACKING_ID]
```

**Manual SQL Approach:**
```sql
-- Find the payment
SELECT * FROM payment_requests WHERE tracking_id = 'YOUR_TRACKING_ID';

-- Reset payment status
UPDATE payment_requests 
SET status = 'pending', 
    paid_date = NULL 
WHERE tracking_id = 'YOUR_TRACKING_ID';

-- Remove from income if already recorded
DELETE FROM income 
WHERE source_type = 'utility_reimbursement' 
AND reference_id = 'YOUR_TRACKING_ID';

-- Unlink from venmo email
UPDATE venmo_emails 
SET tracking_id = NULL 
WHERE tracking_id = 'YOUR_TRACKING_ID';
```

### Recreate Missing Records

**Regenerate Missing Bills:**
```bash
cd backend

# Find date range with missing bills
node -e "
const db = require('./src/db/connection');
db.query('SELECT DISTINCT DATE_TRUNC(\\'month\\', date) as month FROM expenses WHERE category IN (\\'electricity\\', \\'water\\', \\'internet\\') ORDER BY month')
  .then(result => {
    console.log('Months with utility expenses:');
    result.rows.forEach(row => console.log(row.month));
  });
"

# Reprocess specific month
node src/scripts/catch-up-utility-bills.js 2024-01-01 2024-01-31
```

**Recreate ETL Rules:**
```bash
cd backend
node src/scripts/setup/setup-etl-rules.js
```

**Rebuild Indexes:**
```bash
cd backend
node src/scripts/maintenance/add-performance-indexes.js
```

---

## Emergency Procedures

### Complete System Reset (Development Only)

⚠️ **WARNING: This will delete ALL data!**

```bash
# Stop all services
docker-compose down -v

# Remove database volumes
docker volume prune -f

# Rebuild everything
docker-compose build --no-cache
docker-compose up -d postgres

# Wait for postgres to start
sleep 10

# Run migrations
cd backend
npm run migrate

# Seed sample data
node src/seed-sample-data.js

# Start services
cd ..
docker-compose up -d
```

### Production Recovery

```bash
# 1. Create immediate backup
pg_dump landlord_dashboard > emergency_backup_$(date +%Y%m%d_%H%M%S).sql

# 2. Check system status
curl http://localhost:3002/health

# 3. If database is corrupted, restore from latest backup
# 4. If sync is stuck, reset sync status
# 5. If payments are wrong, use undo scripts

# 6. Restart all services
docker-compose restart

# 7. Verify functionality
curl http://localhost:3002/api/payments/requests | jq '.length'
```

---

## Getting Help

### Log Locations
- Backend logs: `backend/backend.log`
- Docker logs: `docker-compose logs [service_name]`
- System logs: `/var/log/syslog`

### Debug Mode
```bash
cd backend
DEBUG=* npm run dev
```

### Health Check Endpoint
```bash
curl http://localhost:3002/health
```

### Database Console
```bash
docker exec -it $(docker ps -q -f name=postgres) psql -U postgres -d landlord_dashboard
```

For issues not covered in this guide, check the application logs and database state using the diagnostic commands above. Most problems stem from sync timing, data integrity, or configuration issues that can be resolved by following the systematic approaches outlined here.