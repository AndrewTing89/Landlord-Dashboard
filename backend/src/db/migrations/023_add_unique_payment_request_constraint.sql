-- Add unique constraint to prevent duplicate income records for the same payment request
-- This ensures that marking a payment as "paid" manually and then getting a Venmo email later
-- won't create duplicate income entries

ALTER TABLE income 
ADD CONSTRAINT unique_payment_request_income 
UNIQUE (payment_request_id) 
WHERE payment_request_id IS NOT NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_income_payment_request_id 
ON income(payment_request_id) 
WHERE payment_request_id IS NOT NULL;