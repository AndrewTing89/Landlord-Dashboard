-- Create table for tracking Venmo emails from Gmail
CREATE TABLE IF NOT EXISTS venmo_emails (
  id SERIAL PRIMARY KEY,
  
  -- Gmail identifiers
  gmail_message_id VARCHAR(255) UNIQUE NOT NULL,
  gmail_thread_id VARCHAR(255),
  
  -- Email metadata
  email_type VARCHAR(50) NOT NULL, -- 'request_sent', 'payment_received', 'request_reminder', 'request_cancelled'
  sender_email VARCHAR(255),
  subject TEXT NOT NULL,
  body_snippet TEXT, -- First 500 chars of body for debugging
  received_date TIMESTAMP NOT NULL,
  
  -- Parsed Venmo data
  venmo_amount DECIMAL(10,2),
  venmo_actor VARCHAR(255), -- Who sent/received payment
  venmo_note TEXT,
  venmo_date DATE,
  
  -- Matching status
  matched BOOLEAN DEFAULT FALSE,
  match_confidence DECIMAL(3,2), -- 0.00 to 1.00
  payment_request_id INTEGER REFERENCES payment_requests(id),
  manual_review_needed BOOLEAN DEFAULT FALSE,
  review_reason VARCHAR(255),
  
  -- Processing metadata
  processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  processed_by VARCHAR(100) DEFAULT 'system',
  processing_notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_venmo_emails_gmail_id ON venmo_emails(gmail_message_id);
CREATE INDEX idx_venmo_emails_type ON venmo_emails(email_type);
CREATE INDEX idx_venmo_emails_received ON venmo_emails(received_date DESC);
CREATE INDEX idx_venmo_emails_matched ON venmo_emails(matched);
CREATE INDEX idx_venmo_emails_amount ON venmo_emails(venmo_amount);
CREATE INDEX idx_venmo_emails_review ON venmo_emails(manual_review_needed) WHERE manual_review_needed = TRUE;

-- Create table for Gmail sync state
CREATE TABLE IF NOT EXISTS gmail_sync_state (
  id SERIAL PRIMARY KEY,
  account_email VARCHAR(255) NOT NULL,
  last_history_id BIGINT,
  last_sync_date TIMESTAMP,
  sync_token TEXT,
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create table for unmatched payments that need investigation
CREATE TABLE IF NOT EXISTS venmo_unmatched_emails (
  id SERIAL PRIMARY KEY,
  venmo_email_id INTEGER REFERENCES venmo_emails(id),
  potential_matches JSONB, -- Array of potential payment_request IDs with confidence scores
  resolution_status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'matched', 'ignored', 'refund'
  resolved_at TIMESTAMP,
  resolved_by VARCHAR(100),
  resolution_notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Add comment explaining the processing flow
COMMENT ON TABLE venmo_emails IS 'Stores Venmo notification emails from Gmail. Once processed and matched, emails can be safely deleted from Gmail.';
COMMENT ON COLUMN venmo_emails.gmail_message_id IS 'Gmail message ID - used to prevent duplicate processing';
COMMENT ON COLUMN venmo_emails.body_snippet IS 'Stores only first 500 chars for debugging. Full email not needed after parsing.';