-- Clean up unused and deprecated tables

-- Step 1: Drop unused tables that have been replaced or are no longer needed

-- Drop expense_categories - unused, hardcoded in application
DROP TABLE IF EXISTS expense_categories CASCADE;

-- Drop utility_bills - only 4 records, functionality replaced by payment_requests
-- First check if there are any foreign key references we need to handle
ALTER TABLE payment_requests DROP COLUMN IF EXISTS utility_bill_id;
DROP TABLE IF EXISTS utility_bills CASCADE;

-- Drop duplicate/redundant Venmo tables
-- Keep only venmo_emails as the main email tracking table
DROP TABLE IF EXISTS venmo_payment_requests CASCADE; -- Replaced by payment_requests
DROP TABLE IF EXISTS venmo_unmatched_payments CASCADE; -- Duplicate of unmatched_payments
DROP TABLE IF EXISTS unmatched_payments CASCADE; -- Handled by venmo_emails with matched=false

-- Step 2: Clean up orphaned views if they exist
DROP VIEW IF EXISTS pending_review_transactions CASCADE;

-- Step 3: Drop old tables after verifying migration (only after confirming transactions table works)
-- These are commented out for safety - uncomment after testing
-- DROP TABLE IF EXISTS expenses CASCADE;
-- DROP TABLE IF EXISTS income CASCADE;

-- Step 4: Document what was removed
COMMENT ON TABLE transactions IS 'Unified transactions table - replaces former expenses and income tables. Migrated on ' || CURRENT_DATE;