-- Create audit log table for tracking all changes
CREATE TABLE IF NOT EXISTS audit_log (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  action VARCHAR(20) NOT NULL, -- INSERT, UPDATE, DELETE
  user_id VARCHAR(100), -- For future multi-user support
  old_values JSONB,
  new_values JSONB,
  changed_fields TEXT[],
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX idx_audit_log_table_record ON audit_log(table_name, record_id);
CREATE INDEX idx_audit_log_created_at ON audit_log(created_at DESC);
CREATE INDEX idx_audit_log_action ON audit_log(action);

-- Create backup table for system backups
CREATE TABLE IF NOT EXISTS backups (
  id SERIAL PRIMARY KEY,
  backup_name VARCHAR(255) NOT NULL,
  backup_type VARCHAR(50) NOT NULL, -- 'full', 'incremental', 'manual'
  file_path TEXT,
  size_bytes BIGINT,
  tables_included TEXT[],
  record_count INTEGER,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP
);

-- Create data validation rules table
CREATE TABLE IF NOT EXISTS validation_rules (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  field_name VARCHAR(50) NOT NULL,
  rule_type VARCHAR(50) NOT NULL, -- 'required', 'min', 'max', 'regex', 'custom'
  rule_value TEXT NOT NULL,
  error_message TEXT,
  active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default validation rules
INSERT INTO validation_rules (table_name, field_name, rule_type, rule_value, error_message) VALUES
  ('payment_requests', 'amount', 'min', '0.01', 'Amount must be greater than zero'),
  ('payment_requests', 'status', 'regex', '^(pending|sent|paid|foregone)$', 'Invalid status value'),
  ('expenses', 'amount', 'min', '0', 'Expense amount cannot be negative'),
  ('income', 'amount', 'min', '0.01', 'Income amount must be positive'),
  ('payment_requests', 'status', 'custom', 'validate_status_transition', 'Invalid status transition')
ON CONFLICT DO NOTHING;

-- Create function to automatically log changes
CREATE OR REPLACE FUNCTION audit_trigger_function()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO audit_log (table_name, record_id, action, new_values, created_at)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(NEW), NOW());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_values, new_values, created_at)
    VALUES (TG_TABLE_NAME, NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), NOW());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO audit_log (table_name, record_id, action, old_values, created_at)
    VALUES (TG_TABLE_NAME, OLD.id, TG_OP, row_to_json(OLD), NOW());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers to important tables
CREATE TRIGGER audit_payment_requests
  AFTER INSERT OR UPDATE OR DELETE ON payment_requests
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_expenses
  AFTER INSERT OR UPDATE OR DELETE ON expenses
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_income
  AFTER INSERT OR UPDATE OR DELETE ON income
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();

CREATE TRIGGER audit_raw_transactions
  AFTER INSERT OR UPDATE OR DELETE ON raw_transactions
  FOR EACH ROW EXECUTE FUNCTION audit_trigger_function();