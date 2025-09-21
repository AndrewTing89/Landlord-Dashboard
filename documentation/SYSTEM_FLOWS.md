# Landlord Dashboard - Detailed System Flows

**Last Updated:** September 21, 2025 8:45 AM UTC

## 1. 🏦 BANK TRANSACTION DATA FLOW

### Step 1: Daily Sync Initiation
- Cron job or manual script runs `backend/src/scripts/daily/full-sync.js`
- SimpleFIN API fetches transactions from connected bank accounts (last 7 days default)
- Supports catch-up syncs for longer periods

### Step 2: Raw Data Landing
- New transactions land in `raw_transactions` table with:
  - SimpleFIN transaction ID, amount, posted_date, description
  - Status: `processed = false` (needs review)
  - No categorization yet
  - Duplicate prevention via transaction fingerprinting

### Step 3: ETL Rule Matching
- System checks each raw transaction against `etl_rules` table
- Rules have patterns (description/payee matching) and priorities:
  - Priority < 100: Needs manual approval
  - Priority ≥ 100: Auto-approved
- Matches assign `expense_type` (electricity, water, maintenance, property_tax, etc.)
- Confidence scoring helps with category suggestions

### Step 4: Classification & Migration
- **If Expense** (any categorized transaction):
  - Moved to `expenses` table with IRS Schedule E category
  - Raw transaction marked as `processed = true`
  - Categories match IRS lines (cleaning_maintenance, repairs, supplies, etc.)
- **If No Match**: Stays in `raw_transactions` for manual review via UI

### Step 5: Utility Bill Detection
- If expense type = `electricity` or `water`:
  - Triggers automatic payment request creation (see flow #2)
  - No separate utility_bills table needed (simplified architecture)

## 2. 💸 PAYMENT REQUEST SYSTEM FLOW

### Step 1: Bill Detection
- When utility expense (`electricity` or `water`) lands in `expenses` table
- Daily sync or catch-up script detects bills without payment requests
- Checks for existing requests to prevent duplicates

### Step 2: Payment Request Creation
- Creates entries in `payment_requests` table for EACH roommate:
  - **Ushi** - 1/3 split
  - **Eileen** - 1/3 split
- Each request has:
  - `total_amount`: Full bill amount
  - `amount`: Individual share (total/3)
  - `tracking_id`: Format `YYYY-MM-Type` (e.g., `2025-07-Electricity`)
  - `status`: `pending`
  - `venmo_link`: Pre-filled Venmo payment request URL
  - `month`/`year`: For proper accounting period tracking
  - `charge_date`: When the bill was originally paid

### Step 3: Venmo Link Generation
- Format: `2025-07-Water - Water bill for Jul 2025: Total $520.21, your share is $173.40 (1/3). I paid the full amount on 7/15/2025.`
- Includes tracking ID for automatic matching
- URL-encoded for proper Venmo deep linking

### Step 4: Status Progression
- `pending` → Payment request created, not yet sent
- `sent` → User marked as sent to roommate (future feature)
- `paid` → Payment confirmed (via Gmail/Venmo email matching)
- `foregone` → User decided not to collect

### Step 5: Income Recording
- When payment marked as `paid`:
  - Creates entry in `income` table
  - Type: `utility_reimbursement`
  - Amount: The split amount received
  - **Critical**: Income recorded in BILL month, not payment month
  - Example: March bill paid in August = March income

## 3. 📧 VENMO EMAIL CONFIRMATION FLOW

### Step 1: Gmail API Monitoring
- `backend/src/services/gmailService.js` polls Gmail inbox
- Looks for emails from Venmo with payment confirmations
- Uses OAuth2 with stored tokens
- Runs as part of daily sync

### Step 2: Email Parsing
- Extracts from Venmo emails:
  - Payer name (venmo_actor)
  - Amount paid (venmo_amount)
  - Payment note (venmo_note - contains tracking ID)
  - Date received
- Stores in `venmo_emails` table

### Step 3: Payment Matching
- **Automatic Matching**:
  - Fuzzy matching algorithm scores based on:
    - Amount match (50% weight)
    - Name match (35% weight)
    - Temporal proximity (15% weight)
  - High confidence matches (>80%) auto-update payment status
  
- **Manual Review Path**:
  - Low confidence matches flagged for review
  - Emails can be marked as `ignored = true` if irrelevant
  - UI shows unmatched emails for manual linking

### Step 4: Reconciliation
- Matched payments update `payment_requests.status = 'paid'`
- Creates corresponding `income` entry
- Discord notification sent for successful matches
- Updates payment_request with `paid_date`

## 4. 📊 TAX REPORTING FLOW

### Step 1: Data Collection
- Aggregates full year of `expenses` by IRS category
- Sums `income` by type (rent vs utility_reimbursement)
- Handles property tax timing (paid in year X+1 for tax year X)

### Step 2: Report Generation
- Creates 5-sheet Excel workbook:
  1. **Summary** - Executive overview with totals
  2. **Income Detail** - All income transactions
  3. **Expense Detail** - All expenses by category
  4. **Monthly P&L** - Month-by-month breakdown
  5. **Schedule E** - IRS form format

### Step 3: Category Mapping
- Expense categories map to IRS Schedule E lines:
  - Line 7: `cleaning_maintenance`
  - Line 14: `repairs`
  - Line 15: `supplies`
  - Line 16: `property_tax`
  - Line 17: `electricity`, `water`, `internet`

## 🔄 KEY DATABASE TABLES

### Financial Core:
- **`raw_transactions`** → Unprocessed bank data awaiting categorization
- **`expenses`** → All categorized property expenses with IRS categories
- **`income`** → Rent and utility reimbursements with proper month attribution

### Payment System:
- **`payment_requests`** → Split bill requests to roommates
  - Unique constraint: (roommate_name, month, year, bill_type)
  - Tracking IDs can be same for both roommates
- **`venmo_emails`** → Processed Venmo payment confirmations
  - Links to payment_requests via matching algorithm

### Configuration:
- **`etl_rules`** → Auto-categorization patterns with priorities
  - Pattern matching on description/payee
  - Creates learning system from user decisions

### Supporting Tables:
- **`sync_history`** → Tracks daily sync runs and results
- **`simplefin_connections`** → Bank account connection status

## 📊 DATABASE ARCHITECTURE NOTES

### Current Architecture (2025)
- **Unified transaction model** with clean separation:
  - `raw_transactions` → staging area
  - `expenses` → categorized expenses
  - `income` → all income sources
- **No** `transactions` or `utility_bills` tables (simplified)

### Key Business Rules:
1. **Income Attribution**: Always recorded in bill month, not payment month
2. **3-Way Split**: All utilities split equally among landlord + 2 roommates
3. **Duplicate Prevention**: Triple-layer protection at query, service, and database levels
4. **Auto-Approval**: ETL rules with priority ≥ 100 bypass manual review
5. **Roommate Management**: System handles multiple roommates with partial payment coverage

### Performance Optimizations:
- Database indexes on all foreign keys and search fields
- No ORM for complex queries (raw SQL for performance)
- Batch processing for bulk operations
- Connection pooling for concurrent requests

### Data Integrity Features:
- Transaction fingerprinting prevents duplicate imports
- Constraint-based duplicate prevention for payment requests
- Audit trail via created_at/updated_at timestamps
- Health monitoring endpoints for system status

## 🔐 SECURITY & COMPLIANCE

### Security Measures:
- Environment-based configuration (no hardcoded secrets)
- OAuth 2.0 for Gmail integration
- Parameterized queries prevent SQL injection
- Docker network isolation

### Tax Compliance:
- IRS Schedule E compliant categorization
- Proper cash vs accrual basis tracking
- Complete audit trail for all transactions
- Supporting documentation linkage

### Data Privacy:
- Roommate data isolation in queries
- No PII in log files
- Secure token storage for OAuth
- Regular token refresh for Gmail access