-- Create table to track utility payment adjustments (reimbursements)
CREATE TABLE IF NOT EXISTS utility_adjustments (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
  payment_request_id INTEGER REFERENCES payment_requests(id),
  adjustment_amount DECIMAL(10, 2) NOT NULL,
  adjustment_type VARCHAR(50) NOT NULL, -- 'reimbursement', 'credit', etc.
  description TEXT,
  applied_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_utility_adjustments_transaction_id ON utility_adjustments(transaction_id);
CREATE INDEX IF NOT EXISTS idx_utility_adjustments_payment_request_id ON utility_adjustments(payment_request_id);
CREATE INDEX IF NOT EXISTS idx_utility_adjustments_applied_date ON utility_adjustments(applied_date);

-- Add comment explaining the table
COMMENT ON TABLE utility_adjustments IS 'Tracks reimbursements and adjustments to utility expenses. Used to calculate net utility costs by reducing the original expense amount.';