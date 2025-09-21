# Landlord Dashboard Data Flow Documentation

**Last Updated:** September 21, 2025 8:45 AM UTC

This document provides a comprehensive overview of how data flows through the Landlord Dashboard system, from bank transactions to tax reporting. The system automates rental property financial management with sophisticated ETL processing, payment tracking, and income attribution.

## Table of Contents

1. [System Overview](#system-overview)
2. [Transaction Lifecycle](#transaction-lifecycle)
3. [Payment Request Flow](#payment-request-flow)
4. [Income Attribution Logic](#income-attribution-logic)
5. [ETL Pipeline](#etl-pipeline)
6. [Venmo Email Matching](#venmo-email-matching)
7. [Daily Sync Process](#daily-sync-process)
8. [Database Tables](#database-tables)
9. [Real Examples](#real-examples)

## System Overview

The Landlord Dashboard manages rental property finances through an automated pipeline that:

1. **Syncs bank transactions** from Bank of America via SimpleFIN API
2. **Categorizes expenses** using configurable ETL rules 
3. **Splits utility bills** 3-ways among roommates
4. **Tracks Venmo payments** via Gmail API monitoring
5. **Records income** in the correct accounting period
6. **Generates tax reports** compliant with IRS Schedule E

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Bank of       │    │   SimpleFIN     │    │ raw_transactions│
│   America       │───▶│      API        │───▶│     Table       │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│    Manual       │    │  ETL Rules      │    │     ETL         │
│    Review       │◀───│   Processing    │◀───│   Processing    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐                           ┌─────────────────┐
│    expenses     │                           │   Auto-Approved │
│     Table       │                           │   to expenses   │
│                 │                           │     Table       │
└─────────────────┘                           └─────────────────┘
         │                                              │
         ▼                                              ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ Utility Bills   │    │ Payment Request │    │     Venmo       │
│  Detection      │───▶│   Generation    │───▶│   Link Gen      │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
                                                        │
                                                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│     income      │    │ Payment Status  │    │  Gmail API      │
│     Table       │◀───│    Updates      │◀───│   Monitoring    │
│                 │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## Transaction Lifecycle

### Step 1: Bank Transaction Import

**Trigger**: Daily sync job or manual sync
**Process**: SimpleFIN API fetches new transactions

```javascript
// SimpleFIN returns transaction data like:
{
  id: "sfin_12345",
  amount: -125.67,           // Negative = expense
  description: "PG&E ELECTRIC PAYMENT",
  payee: "PG&E",
  posted: 1704067200,        // Unix timestamp
  category: "Utilities"
}
```

**Storage**: All transactions saved to `raw_transactions` table

```sql
INSERT INTO raw_transactions (
  simplefin_id,
  amount,
  posted_date,
  description,
  payee,
  category,
  processed,           -- FALSE initially
  excluded,            -- FALSE initially  
  suggested_expense_type,
  confidence_score
) VALUES (...)
```

### Step 2: ETL Rule Processing

**Automatic Classification**: Each transaction is matched against ETL rules

```sql
-- Example ETL rules (ordered by priority)
SELECT * FROM etl_rules WHERE active = true ORDER BY priority DESC;

│ rule_name        │ priority │ description_pattern │ action     │ expense_type │
├──────────────────┼──────────┼────────────────────┼────────────┼──────────────┤
│ PG&E Electricity │   100    │ (?i)(pg&e|pge)     │ approve    │ electricity  │
│ Water Bills      │   100    │ (?i)(great oaks)   │ approve    │ water        │
│ Home Depot       │    90    │ (?i)(home depot)   │ categorize │ supplies     │
│ Exclude Food     │    70    │ (?i)(restaurant)   │ exclude    │ NULL         │
```

**Auto-Approval**: Rules with `priority >= 100` automatically create expense records

### Step 3: Manual Review

**For Unmatched Transactions**: Low-confidence transactions require manual review

```sql
-- Transactions needing review
SELECT * FROM raw_transactions 
WHERE processed = false 
  AND excluded = false 
  AND confidence_score < 0.9;
```

**Review Interface**: Frontend provides categorization UI with suggestions

### Step 4: Expense Creation

**Final Step**: Approved transactions move to `expenses` table

```sql
INSERT INTO expenses (
  simplefin_transaction_id,
  amount,           -- Always positive (expense amount)
  date,
  name,
  merchant_name,
  expense_type,     -- electricity, water, repairs, etc.
  category         -- IRS Schedule E category
) VALUES (...)
```

## Payment Request Flow

### Utility Bill Detection

**Trigger**: New electricity or water expense is created
**Business Logic**: Only electricity and water bills are split among roommates (internet is NOT split)

```javascript
// Only splittable utilities
if (['electricity', 'water'].includes(expense_type)) {
  await createUtilityPaymentRequests(expense);
}
```

### 3-Way Split Calculation

**Split Logic**: Each utility bill is divided equally among 3 roommates

```javascript
const splitAmount = (totalAmount / 3).toFixed(2);

// Example: $150 water bill
// Each roommate owes: $50.00
```

### Payment Request Generation

**Tracking ID Format**: `YYYY-MM-Type` (e.g., `2024-07-Electricity`)

```javascript
const monthPadded = billMonth.toString().padStart(2, '0');
const typeCapitalized = expense_type.charAt(0).toUpperCase() + expense_type.slice(1);
const trackingId = `${billYear}-${monthPadded}-${typeCapitalized}`;
```

**Database Records**: One payment request per roommate

```sql
INSERT INTO payment_requests (
  roommate_name,      -- 'John Doe'
  venmo_username,     -- '@JohnDoe123'
  bill_type,          -- 'electricity' 
  amount,             -- 50.00 (1/3 of total)
  total_amount,       -- 150.00 (full bill)
  tracking_id,        -- '2024-07-Electricity'
  month,              -- 7
  year,               -- 2024
  status,             -- 'pending'
  charge_date,        -- Date the bill was paid
  venmo_link          -- Generated payment link
) VALUES (...)
```

### Venmo Link Generation

**Payment URL Format**: Deep link to Venmo app/web

```javascript
function generateVenmoRequestLink(venmoUsername, amount, type, monthName, year, trackingId, totalAmount, chargeDate) {
  const note = `${trackingId} - ${type} bill for ${monthName} ${year}: Total $${totalAmount}, your share is $${amount} (1/3). I paid the full amount on ${chargeDate}.`;
  
  const encodedNote = encodeURIComponent(note);
  const cleanUsername = venmoUsername.replace('@', '');
  
  return `https://account.venmo.com/pay?amount=${amount}&note=${encodedNote}&recipients=${cleanUsername}&txn=charge`;
}
```

**Example Generated Link**:
```
https://account.venmo.com/pay?amount=50.00&note=2024-07-Electricity%20-%20Electricity%20bill%20for%20July%202024%3A%20Total%20%24150.00%2C%20your%20share%20is%20%2450.00%20(1%2F3).%20I%20paid%20the%20full%20amount%20on%207%2F15%2F2024.&recipients=JohnDoe123&txn=charge
```

### Status Progression

```
pending → sent → paid
            ↓
        foregone (if declined/expired)
```

## Income Attribution Logic

### Critical Business Rule

**Income is recorded in the BILL month, not the payment month**

This ensures accurate profit/loss reporting for each accounting period.

### Example Timeline

```
March 2024: Water bill of $120 is due
April 2024: Landlord pays the $120 water bill  
May 2024:   Roommate pays $40 via Venmo

┌─────────────────────────────────────────────────────────────┐
│ Income Attribution: $40 is recorded as MARCH 2024 income   │
│ Reason: It's reimbursement for the March water bill        │
└─────────────────────────────────────────────────────────────┘
```

### Income Recording Process

**When Payment is Received**:

```sql
-- Extract bill month/year from tracking ID
-- Format: 2024-03-Water
SELECT 
  SPLIT_PART(tracking_id, '-', 1)::INTEGER as bill_year,   -- 2024
  SPLIT_PART(tracking_id, '-', 2)::INTEGER as bill_month   -- 03

-- Record income in the BILL month
INSERT INTO income (
  date,               -- Today (when payment received)
  amount,             -- 40.00
  description,        -- 'Water bill reimbursement from John'
  income_type,        -- 'utility_reimbursement'
  income_month,       -- '2024-03-01' (first day of bill month)
  received_date,      -- Today (when payment received)
  income_year,        -- 2024 (for tax reporting)
  payment_request_id  -- Links to original payment request
) VALUES (...)
```

### Accounting Impact

**Expense Recognition** (when bill is paid):
- Date: 2024-04-15
- Amount: -$120
- Category: water
- Month: April 2024

**Income Recognition** (when reimbursement received):
- Received Date: 2024-05-20  
- Amount: +$40
- Category: utility_reimbursement
- **Attributed Month: March 2024** ← Critical for P&L

**Net Effect**:
- March 2024 P&L: +$40 income (accurate representation)
- April 2024 P&L: -$120 expense + 0 income = landlord's true cost

## ETL Pipeline

### Rule-Based Classification

**ETL Rules Table Structure**:
```sql
CREATE TABLE etl_rules (
  id SERIAL PRIMARY KEY,
  rule_name VARCHAR(100),
  priority INTEGER,           -- Higher priority = processed first
  description_pattern VARCHAR(255),  -- Regex for transaction description
  payee_pattern VARCHAR(255),       -- Regex for payee name
  amount_min DECIMAL(10,2),         -- Minimum amount filter
  amount_max DECIMAL(10,2),         -- Maximum amount filter
  action VARCHAR(50),               -- 'approve', 'exclude', 'categorize'
  expense_type VARCHAR(50),         -- Target category
  merchant_name VARCHAR(255),       -- Standardized merchant name
  exclude_reason VARCHAR(255),      -- Reason for exclusion
  active BOOLEAN DEFAULT TRUE
);
```

### Rule Processing Logic

**Pattern Matching**:
```javascript
async function applyETLRules(transaction) {
  const rules = await db.query(
    'SELECT * FROM etl_rules WHERE active = true ORDER BY priority DESC'
  );
  
  for (const rule of rules) {
    let matches = true;
    
    // Check description pattern
    if (rule.description_pattern) {
      const regex = new RegExp(rule.description_pattern, 'i');
      if (!regex.test(transaction.description)) {
        matches = false;
      }
    }
    
    // Check amount range
    if (rule.amount_min && transaction.amount < rule.amount_min) {
      matches = false;
    }
    
    if (matches) {
      return {
        expense_type: rule.expense_type,
        merchant: rule.merchant_name,
        confidence: rule.priority >= 100 ? 1.0 : 0.9,
        auto_approve: rule.priority >= 100,
        excluded: rule.action === 'exclude'
      };
    }
  }
}
```

### IRS Schedule E Categories

**Expense Type Mapping**:
```javascript
const IRS_CATEGORIES = {
  'cleaning_maintenance': 'Line 7 - Cleaning and maintenance',
  'repairs': 'Line 14 - Repairs', 
  'supplies': 'Line 15 - Supplies',
  'property_tax': 'Line 16 - Taxes',
  'electricity': 'Line 17 - Utilities',
  'water': 'Line 17 - Utilities', 
  'internet': 'Line 17 - Utilities',
  'insurance': 'Line 9 - Insurance',
  'depreciation': 'Line 18 - Depreciation'
};
```

### Auto-Approval Rules

**High-Priority Rules** (priority >= 100):
- PG&E electricity bills
- Great Oaks water bills  
- Property tax payments
- Known maintenance vendors

**Example High-Priority Rules**:
```sql
INSERT INTO etl_rules (rule_name, priority, description_pattern, action, expense_type) VALUES
('PG&E Electricity', 100, '(?i)(pg&e|pacific gas|pge)', 'approve', 'electricity'),
('Great Oaks Water', 100, '(?i)(great oaks|water)', 'approve', 'water'),
('Property Tax', 100, '(?i)(tax collector|property tax)', 'approve', 'property_tax');
```

## Venmo Email Matching

### Gmail API Monitoring

**Email Search Criteria**:
```javascript
const searchCriteria = [
  'UNSEEN',                    // Only new emails
  ['FROM', 'venmo@venmo.com']  // Only from Venmo
];
```

**Email Types Processed**:
1. Payment received: "John Doe paid you $50.00"
2. Payment declined: "John Doe declined your request for $50.00"  
3. Payment request sent: "You requested $50.00 from John Doe"
4. Payment expired: "Your request to John Doe has expired"

### Payment Confirmation Matching

**Fuzzy Name Matching**:
```javascript
// Match by first name + amount
const matchingRequest = await db.getOne(
  `SELECT * FROM payment_requests
   WHERE amount = $1 
   AND roommate_name ILIKE $2    -- Case-insensitive partial match
   AND status = 'sent'
   ORDER BY created_at DESC`,
  [amount, `%${payerName.split(' ')[0]}%`]  // Match first name
);
```

**Status Updates**:
```sql
-- When payment is confirmed
UPDATE payment_requests 
SET status = 'paid',
    paid_date = $1,
    updated_at = NOW()
WHERE id = $2;
```

### Income Generation

**Automatic Income Creation**:
```javascript
async function createIncomeFromPayment(paymentRequest, paidDate) {
  // Extract bill month from tracking ID (2024-07-Electricity)
  const [year, month, type] = paymentRequest.tracking_id.split('-');
  
  await db.insert('income', {
    date: paidDate,                    // When payment received
    amount: paymentRequest.amount,     // $50.00
    description: `${type} bill reimbursement from ${paymentRequest.roommate_name}`,
    income_type: 'utility_reimbursement',
    income_month: `${year}-${month}-01`,  // Bill month (critical!)
    received_date: paidDate,
    income_year: parseInt(year),
    payment_request_id: paymentRequest.id
  });
}
```

## Daily Sync Process

### Full Sync Workflow

**Trigger**: Cron job at 6 AM daily or manual execution

```bash
# Automated daily sync
node src/scripts/daily/full-sync.js daily 7

# Catch-up sync for missed days  
node src/scripts/daily/full-sync.js catch_up 30
```

**Process Steps**:
1. **Bank Sync**: Fetch last 7 days of transactions via SimpleFIN
2. **ETL Processing**: Apply rules to new transactions  
3. **Bill Detection**: Find utility bills needing payment requests
4. **Payment Request Creation**: Generate Venmo links for roommates
5. **Email Monitoring**: Check for new Venmo payment confirmations
6. **Discord Notifications**: Alert about new transactions requiring review

### Error Handling

**Graceful Degradation**:
- SimpleFIN timeout → Continue with other steps
- Discord notification failure → Log but don't fail sync
- Individual transaction errors → Continue processing others

**Sync Tracking**:
```sql
-- Track sync status and results
INSERT INTO sync_history (
  sync_type,           -- 'daily' or 'catch_up'
  start_time,
  transactions_imported,
  bills_processed,
  payment_requests_created,
  errors,
  status               -- 'completed', 'partial', 'failed'
);
```

## Database Tables

### Core Tables

**raw_transactions**: Staging area for bank data
```sql
CREATE TABLE raw_transactions (
  id SERIAL PRIMARY KEY,
  simplefin_id VARCHAR(255) UNIQUE,
  amount DECIMAL(10,2),
  posted_date DATE,
  description TEXT,
  processed BOOLEAN DEFAULT FALSE,    -- ETL processing status
  excluded BOOLEAN DEFAULT FALSE,     -- Excluded from expenses
  suggested_expense_type VARCHAR(50), -- ETL suggestion
  confidence_score DECIMAL(3,2)      -- 0.00 to 1.00
);
```

**expenses**: Approved business expenses
```sql  
CREATE TABLE expenses (
  id SERIAL PRIMARY KEY,
  simplefin_transaction_id VARCHAR(255),
  amount DECIMAL(10,2),              -- Always positive
  date DATE,
  name VARCHAR(255),
  merchant_name VARCHAR(255),
  expense_type VARCHAR(50),          -- electricity, water, repairs
  tax_year INTEGER
);
```

**payment_requests**: Roommate payment tracking
```sql
CREATE TABLE payment_requests (
  id SERIAL PRIMARY KEY,
  roommate_name VARCHAR(100),
  venmo_username VARCHAR(100),
  bill_type VARCHAR(50),             -- electricity, water
  amount DECIMAL(10,2),              -- Roommate's share
  total_amount DECIMAL(10,2),        -- Full bill amount
  tracking_id VARCHAR(50),           -- 2024-07-Electricity
  month INTEGER,                     -- Bill month
  year INTEGER,                      -- Bill year
  status VARCHAR(20),                -- pending, sent, paid
  charge_date DATE,                  -- When bill was paid
  paid_date DATE,                    -- When roommate paid
  venmo_link TEXT
);
```

**income**: All revenue sources
```sql
CREATE TABLE income (
  id SERIAL PRIMARY KEY,
  date DATE,                         -- When received
  amount DECIMAL(10,2),              -- Always positive  
  description TEXT,
  income_type VARCHAR(50),           -- rent, utility_reimbursement
  income_month DATE,                 -- Accounting period (critical!)
  received_date DATE,                -- Cash accounting date
  income_year INTEGER,               -- Tax year
  payment_request_id INTEGER         -- Links to payment request
);
```

### Supporting Tables

**etl_rules**: Transaction classification rules
**venmo_emails**: Gmail monitoring logs
**sync_history**: Daily sync tracking
**audit_log**: All system changes

## Real Examples

### Example 1: Electricity Bill Flow

**1. Bank Transaction Import**:
```json
{
  "description": "PG&E PAYMENT ELECTRIC SERVICE",
  "amount": -167.45,
  "date": "2024-07-15",
  "payee": "PG&E"
}
```

**2. ETL Rule Match**:
```sql
-- Matches rule: "PG&E Electricity" (priority 100)
-- Result: Auto-approved as 'electricity' expense
```

**3. Expense Creation**:
```sql
INSERT INTO expenses (
  amount = 167.45,
  expense_type = 'electricity',
  merchant_name = 'PG&E',
  date = '2024-07-15'
);
```

**4. Payment Request Generation**:
```sql
-- Creates 3 payment requests (one per roommate)
-- Each for $55.82 (167.45 / 3)
-- Tracking ID: "2024-07-Electricity"
```

**5. Venmo Link Example**:
```
https://account.venmo.com/pay?amount=55.82&note=2024-07-Electricity%20-%20Electricity%20bill%20for%20July%202024%3A%20Total%20%24167.45%2C%20your%20share%20is%20%2455.82%20(1%2F3).%20I%20paid%20the%20full%20amount%20on%207%2F15%2F2024.&recipients=JohnDoe123&txn=charge
```

**6. Payment Confirmation**:
```
Email Subject: "John Doe paid you $55.82"
→ Status updated to 'paid'
→ Income recorded in July 2024 (bill month)
```

### Example 2: Water Bill with Delayed Payment

**Timeline**:
- **March 1**: Water bill due for $90
- **March 15**: Landlord pays $90 bill → expense recorded  
- **May 20**: Roommate pays $30 via Venmo → income recorded in **March**

**Expense Record**:
```sql
INSERT INTO expenses (
  date = '2024-03-15',        -- When landlord paid
  amount = 90.00,
  expense_type = 'water'
);
```

**Income Record**:
```sql
INSERT INTO income (
  date = '2024-05-20',           -- When payment received  
  amount = 30.00,
  income_type = 'utility_reimbursement',
  income_month = '2024-03-01',   -- MARCH (bill month)
  received_date = '2024-05-20'
);
```

**P&L Impact**:
- **March 2024**: Revenue +$30, Expense -$90 = Net -$60
- **May 2024**: No impact (income attributed to March)

### Example 3: ETL Rule Processing

**Transaction**:
```json
{
  "description": "HOME DEPOT #1234 BUILDING SUPPLY",
  "amount": -45.67,
  "payee": "HOME DEPOT"
}
```

**ETL Rule Match**:
```sql
-- Rule: "Home Depot Supplies" (priority 90)
-- Pattern: "(?i)(home depot)"
-- Action: "categorize" (requires review, no auto-approve)
-- Result: Suggested as 'supplies' with confidence 0.9
```

**Manual Review Required**:
- Transaction appears in Review interface
- Suggested category: "supplies"  
- Admin can approve, modify, or exclude
- After approval → moves to expenses table

---

This data flow ensures accurate financial tracking, proper income attribution, and compliance with tax reporting requirements while automating the majority of routine property management tasks.