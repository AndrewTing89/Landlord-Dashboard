-- Clean up transactions table to only contain expenses
-- First, delete income-related records that have been migrated

-- Delete utility reimbursements
DELETE FROM transactions
WHERE expense_type = 'utility_reimbursement'
  AND date >= '2025-01-01';

-- Delete rent income
DELETE FROM transactions  
WHERE expense_type = 'rent'
  AND date >= '2025-01-01';

-- Rename transactions table to expenses
ALTER TABLE transactions RENAME TO expenses;

-- Rename expense_type column to category for clarity
ALTER TABLE expenses RENAME COLUMN expense_type TO category;

-- Update the check constraint to only allow expense categories
ALTER TABLE expenses DROP CONSTRAINT IF EXISTS transactions_expense_type_check;
ALTER TABLE expenses ADD CONSTRAINT expenses_category_check 
  CHECK (category IN ('electricity', 'water', 'internet', 'maintenance', 'landscape', 'property_tax', 'insurance', 'other'));

-- Rename indexes
ALTER INDEX IF EXISTS idx_transactions_date RENAME TO idx_expenses_date;
ALTER INDEX IF EXISTS idx_transactions_expense_type RENAME TO idx_expenses_category;
ALTER INDEX IF EXISTS idx_transactions_plaid RENAME TO idx_expenses_plaid;

-- Update any foreign key references
ALTER TABLE utility_adjustments RENAME COLUMN transaction_id TO expense_id;

-- Update trigger name
ALTER TRIGGER IF EXISTS update_transactions_updated_at ON expenses 
  RENAME TO update_expenses_updated_at;