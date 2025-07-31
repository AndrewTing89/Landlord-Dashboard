-- Add paid_date column to payment_requests table
ALTER TABLE payment_requests ADD COLUMN IF NOT EXISTS paid_date TIMESTAMP;

-- Add index for paid_date
CREATE INDEX IF NOT EXISTS idx_payment_requests_paid_date ON payment_requests(paid_date);

-- Update existing paid payment requests to have a paid_date if they don't have one
UPDATE payment_requests 
SET paid_date = updated_at 
WHERE status = 'paid' AND paid_date IS NULL;