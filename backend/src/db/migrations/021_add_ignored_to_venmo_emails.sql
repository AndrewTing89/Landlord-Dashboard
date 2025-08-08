-- Add ignored column to venmo_emails table
ALTER TABLE venmo_emails 
ADD COLUMN IF NOT EXISTS ignored BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_venmo_emails_ignored 
ON venmo_emails(ignored) 
WHERE ignored = false;

-- Update existing unmatched emails to not be ignored
UPDATE venmo_emails 
SET ignored = false 
WHERE ignored IS NULL;