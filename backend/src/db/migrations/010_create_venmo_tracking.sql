-- Create table for tracking Venmo payment requests
CREATE TABLE IF NOT EXISTS venmo_payment_requests (
  id SERIAL PRIMARY KEY,
  recipient_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  description TEXT,
  status VARCHAR(50) NOT NULL DEFAULT 'pending', -- pending, paid, declined, expired
  request_date TIMESTAMP NOT NULL,
  paid_date TIMESTAMP,
  declined_date TIMESTAMP,
  expired_date TIMESTAMP,
  reminder_count INTEGER DEFAULT 0,
  last_reminder_date TIMESTAMP,
  email_subject TEXT,
  payment_email_subject TEXT,
  utility_bill_id INTEGER REFERENCES utility_bills(id),
  bill_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for unmatched Venmo payments
CREATE TABLE IF NOT EXISTS venmo_unmatched_payments (
  id SERIAL PRIMARY KEY,
  payer_name VARCHAR(255) NOT NULL,
  amount DECIMAL(10, 2) NOT NULL,
  email_subject TEXT,
  email_date TIMESTAMP,
  matched BOOLEAN DEFAULT FALSE,
  matched_request_id INTEGER REFERENCES venmo_payment_requests(id),
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add indexes for better performance
CREATE INDEX idx_venmo_requests_status ON venmo_payment_requests(status);
CREATE INDEX idx_venmo_requests_recipient ON venmo_payment_requests(recipient_name);
CREATE INDEX idx_venmo_requests_amount ON venmo_payment_requests(amount);
CREATE INDEX idx_venmo_requests_date ON venmo_payment_requests(request_date);
CREATE INDEX idx_venmo_unmatched_matched ON venmo_unmatched_payments(matched);

-- Add column to link payment_requests to venmo_payment_requests
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS venmo_request_id INTEGER REFERENCES venmo_payment_requests(id);