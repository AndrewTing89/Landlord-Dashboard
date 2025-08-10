# Landlord Dashboard - Detailed System Flows

## 1. 🏦 BANK TRANSACTION DATA FLOW

### Step 1: Daily Sync Initiation
- Cron job or manual script runs `backend/src/scripts/daily/full-sync.js`
- SimpleFIN API fetches transactions from connected bank accounts (last 7 days default)

### Step 2: Raw Data Landing
- New transactions land in `raw_transactions` table with:
  - SimpleFIN transaction ID, amount, date, merchant name
  - Status: `pending` (needs review)
  - No categorization yet

### Step 3: ETL Rule Matching
- System checks each raw transaction against `etl_rules` table
- Rules have patterns (merchant names) and priorities:
  - Priority < 100: Needs manual approval
  - Priority ≥ 100: Auto-approved
- Matches assign `type` (electricity, water, maintenance, rent, etc.)

### Step 4: Classification & Migration
- **If Income** (rent, utility_reimbursement):
  - Moved to `income` table
  - Deleted from `raw_transactions`
- **If Expense** (electricity, water, maintenance, etc.):
  - Moved to `expenses` table  
  - Deleted from `raw_transactions`
- **If No Match**: Stays in `raw_transactions` for manual review

### Step 5: Utility Bill Detection
- If expense type = `electricity` or `water`:
  - Creates entry in `utility_bills` table
  - Triggers payment request creation (see flow #2)

## 2. 💸 PAYMENT REQUEST SYSTEM FLOW

### Step 1: Bill Detection
- When utility expense lands in `expenses` table
- `backend/src/services/utilityBillService.js` detects it

### Step 2: Payment Request Creation
- Creates 2 entries in `payment_requests` table (for 2 roommates)
- Each request has:
  - `total_amount`: Full bill amount
  - `split_amount`: total/3 (3-way split)
  - `tracking_id`: Format `YYYYMM{type}` (e.g., `202407electricity`)
  - `status`: `pending`
  - Venmo link generated with amount and note

### Step 3: Status Progression
- `pending` → User hasn't sent request yet
- `sent` → User marked as sent to roommate
- `paid` → Payment confirmed (via Venmo email or manual)
- `foregone` → User decided not to collect

### Step 4: Income Recording
- When payment marked as `paid`:
  - Creates entry in `income` table
  - Type: `utility_reimbursement`
  - Amount: The split amount received

## 3. 📧 VENMO EMAIL CONFIRMATION FLOW

### Step 1: Gmail API Monitoring
- `backend/src/services/gmailService.js` polls Gmail inbox
- Looks for emails from Venmo with payment confirmations
- Uses OAuth2 with stored tokens in `gmail-token.json`

### Step 2: Email Parsing
- Extracts from Venmo emails:
  - Payer name
  - Amount paid
  - Payment note (contains tracking ID)
  - Date/time

### Step 3: Payment Matching
- **Exact Match Path**:
  - Finds `payment_requests` with matching tracking_id in note
  - Updates status to `paid`
  - Records in `venmo_emails` table
  
- **Fuzzy Match Path** (if no exact match):
  - Stores in `venmo_unmatched_emails` table
  - UI shows these for manual matching
  - User can link to correct payment request

### Step 4: Reconciliation
- Matched payments create `utility_reimbursement` income
- Updates payment request status
- Sends Discord notification (if configured)

## 🔄 KEY DATABASE TABLES INVOLVED

### Financial Data:
- `raw_transactions` → Unprocessed bank data
- `income` → All income (rent + reimbursements)
- `expenses` → All expenses (utilities, maintenance, etc.)

### Payment Tracking:
- `payment_requests` → Split bill requests to roommates
- `venmo_emails` → Processed Venmo confirmations
- `venmo_unmatched_emails` → Needs manual matching

### Configuration:
- `etl_rules` → Auto-categorization rules
- `expense_categories` → Category definitions

## 📊 DATABASE ARCHITECTURE NOTES

### Clean Architecture Migration
- **OLD**: `raw_transactions` → `transactions` (single table)
- **CURRENT**: `raw_transactions` → `income` OR `expenses` (split tables)

### Why Split Tables?
- Income and expenses have different attributes
- Easier to query and report on each separately
- Better for tax reporting (IRS Schedule E separates income/expenses)
- Cleaner data model with type-specific fields

### Important Notes:
- NO `transactions` table exists anymore (clean architecture)
- All financial data is split between `income` and `expenses`
- `utility_reimbursement` type in income table = money received from roommates
- The system is designed to handle both automatic and manual matching
- ETL rules with priority ≥ 100 are auto-approved without manual review