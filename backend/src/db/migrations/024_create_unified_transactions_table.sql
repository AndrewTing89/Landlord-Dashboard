-- Migration to create unified transactions table
-- This combines expenses and income into a single table with proper typing

-- Step 1: Create the new unified transactions table
CREATE TABLE IF NOT EXISTS transactions (
  id SERIAL PRIMARY KEY,
  
  -- Core transaction fields
  amount DECIMAL(10,2) NOT NULL, -- Negative for expenses, positive for income
  date DATE NOT NULL, -- Transaction date
  description TEXT NOT NULL,
  
  -- Classification
  transaction_type VARCHAR(20) NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  category VARCHAR(50) NOT NULL, -- 'rent', 'electricity', 'water', 'utility_reimbursement', etc.
  subcategory VARCHAR(100), -- Optional subcategory
  
  -- Source tracking
  source VARCHAR(50) NOT NULL DEFAULT 'bank_sync', -- 'bank_sync', 'payment_request', 'manual'
  simplefin_transaction_id VARCHAR(255) UNIQUE, -- For bank-synced transactions
  simplefin_account_id VARCHAR(255), -- For bank-synced transactions
  payment_request_id INTEGER UNIQUE REFERENCES payment_requests(id), -- For payment-generated income
  
  -- Parties involved
  merchant_name VARCHAR(255), -- For expenses
  payer_name VARCHAR(255), -- For income
  
  -- Date tracking for accounting
  accrual_date DATE, -- When income/expense was incurred (for accrual accounting)
  received_date DATE, -- When payment was actually received (for cash accounting)
  tax_year INTEGER, -- Tax year for reporting
  
  -- Additional metadata
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Legacy support (temporary, can be removed later)
  legacy_expense_id INTEGER, -- Original ID from expenses table
  legacy_income_id INTEGER -- Original ID from income table
);

-- Step 2: Create indexes for performance
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_type ON transactions(transaction_type);
CREATE INDEX idx_transactions_category ON transactions(category);
CREATE INDEX idx_transactions_type_category ON transactions(transaction_type, category);
CREATE INDEX idx_transactions_tax_year ON transactions(tax_year);
CREATE INDEX idx_transactions_payment_request ON transactions(payment_request_id) WHERE payment_request_id IS NOT NULL;
CREATE INDEX idx_transactions_simplefin ON transactions(simplefin_transaction_id) WHERE simplefin_transaction_id IS NOT NULL;

-- Step 3: Migrate expenses data
INSERT INTO transactions (
  amount,
  date,
  description,
  transaction_type,
  category,
  subcategory,
  source,
  simplefin_transaction_id,
  simplefin_account_id,
  merchant_name,
  tax_year,
  notes,
  created_at,
  updated_at,
  legacy_expense_id
)
SELECT 
  -amount, -- Make negative for expenses
  date,
  name,
  'expense',
  expense_type, -- This becomes category
  subcategory,
  'bank_sync',
  simplefin_transaction_id,
  simplefin_account_id,
  merchant_name,
  tax_year,
  notes,
  created_at,
  updated_at,
  id
FROM expenses;

-- Step 4: Migrate income data
INSERT INTO transactions (
  amount,
  date,
  description,
  transaction_type,
  category,
  source,
  payment_request_id,
  payer_name,
  accrual_date,
  received_date,
  tax_year,
  notes,
  created_at,
  updated_at,
  legacy_income_id
)
SELECT 
  amount, -- Already positive for income
  date,
  description,
  'income',
  income_type, -- This becomes category
  source_type,
  payment_request_id,
  payer_name,
  income_month, -- Maps to accrual_date
  received_date,
  EXTRACT(YEAR FROM COALESCE(income_month, date)),
  notes,
  created_at,
  updated_at,
  id
FROM income;

-- Step 5: Update sequences to avoid ID conflicts
SELECT setval('transactions_id_seq', (SELECT MAX(id) + 1000 FROM transactions), true);

-- Step 6: Create a view for backward compatibility (temporary)
CREATE OR REPLACE VIEW expenses_view AS
SELECT 
  id,
  simplefin_transaction_id,
  simplefin_account_id,
  -amount as amount, -- Convert back to positive for expenses
  date,
  description as name,
  merchant_name,
  category as expense_type,
  subcategory,
  COALESCE(notes, '') as category, -- Map notes to old category field
  tax_year,
  notes,
  created_at,
  updated_at
FROM transactions
WHERE transaction_type = 'expense';

CREATE OR REPLACE VIEW income_view AS
SELECT 
  id,
  amount,
  date,
  description,
  category as income_type,
  source as source_type,
  payment_request_id,
  payer_name,
  accrual_date as income_month,
  received_date,
  EXTRACT(YEAR FROM accrual_date) as income_year,
  notes,
  created_at,
  updated_at
FROM transactions
WHERE transaction_type = 'income';

-- Step 7: Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Step 8: Add comments for documentation
COMMENT ON TABLE transactions IS 'Unified table for all property-related financial transactions';
COMMENT ON COLUMN transactions.amount IS 'Negative for expenses, positive for income';
COMMENT ON COLUMN transactions.transaction_type IS 'Either income or expense';
COMMENT ON COLUMN transactions.category IS 'Type of transaction (rent, electricity, water, etc.)';
COMMENT ON COLUMN transactions.source IS 'How the transaction was created';
COMMENT ON COLUMN transactions.accrual_date IS 'When income/expense was incurred (accrual accounting)';
COMMENT ON COLUMN transactions.received_date IS 'When payment was actually received (cash accounting)';