-- Add venmo_web_link column to payment_requests table
ALTER TABLE payment_requests
ADD COLUMN IF NOT EXISTS venmo_web_link TEXT;

-- Comment for documentation
COMMENT ON COLUMN payment_requests.venmo_web_link IS 'Web-based Venmo link for desktop users';