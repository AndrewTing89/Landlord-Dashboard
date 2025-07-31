-- Add charge_date column to payment_requests table
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS charge_date DATE;

-- Add merchant_name column if it doesn't exist
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS merchant_name VARCHAR(255);

-- Add index for charge_date
CREATE INDEX IF NOT EXISTS idx_payment_requests_charge_date ON payment_requests(charge_date);