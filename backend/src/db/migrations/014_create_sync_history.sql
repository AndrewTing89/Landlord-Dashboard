-- Create table to track sync history and status
CREATE TABLE IF NOT EXISTS sync_history (
  id SERIAL PRIMARY KEY,
  sync_type VARCHAR(50) NOT NULL, -- 'daily', 'catch_up', 'manual'
  started_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'running', -- 'running', 'completed', 'failed'
  transactions_imported INTEGER DEFAULT 0,
  bills_processed INTEGER DEFAULT 0,
  payment_requests_created INTEGER DEFAULT 0,
  pending_review INTEGER DEFAULT 0,
  errors TEXT[],
  details JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_sync_history_started_at ON sync_history(started_at DESC);
CREATE INDEX IF NOT EXISTS idx_sync_history_sync_type ON sync_history(sync_type);
CREATE INDEX IF NOT EXISTS idx_sync_history_status ON sync_history(status);

-- Add comment
COMMENT ON TABLE sync_history IS 'Tracks history of all sync operations including manual triggers from the UI';