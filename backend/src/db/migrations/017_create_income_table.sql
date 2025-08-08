-- Create income table for tracking all income sources
CREATE TABLE IF NOT EXISTS income (
  id SERIAL PRIMARY KEY,
  
  -- Core fields
  date DATE NOT NULL,
  amount DECIMAL(10, 2) NOT NULL, -- Positive values for income
  description TEXT NOT NULL,
  
  -- Categorization
  income_type VARCHAR(50) NOT NULL CHECK (income_type IN ('rent', 'utility_reimbursement', 'other')),
  category VARCHAR(100), -- More specific category if needed
  
  -- Source tracking
  source_type VARCHAR(50) NOT NULL CHECK (source_type IN ('bank', 'payment_request', 'manual')),
  payment_request_id INTEGER REFERENCES payment_requests(id),
  bank_transaction_id VARCHAR(255), -- Links to SimpleFIN transaction if from bank
  
  -- Additional metadata
  payer_name VARCHAR(255),
  notes TEXT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for common queries
CREATE INDEX idx_income_date ON income(date);
CREATE INDEX idx_income_type ON income(income_type);
CREATE INDEX idx_income_payment_request ON income(payment_request_id);
CREATE INDEX idx_income_bank_transaction ON income(bank_transaction_id);

-- Add trigger to update updated_at (using existing function or create if not exists)
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_income_updated_at
  BEFORE UPDATE ON income
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();