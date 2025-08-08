-- Migration: Create Tenant Portal Tables
-- Description: Adds tables for tenant management, maintenance requests, documents, and notifications

-- Tenant accounts table
CREATE TABLE IF NOT EXISTS tenants (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100) NOT NULL,
  phone VARCHAR(20),
  lease_start DATE NOT NULL,
  lease_end DATE NOT NULL,
  monthly_rent DECIMAL(10,2) NOT NULL,
  security_deposit DECIMAL(10,2),
  property_id INTEGER DEFAULT 1, -- For future multi-property support
  unit_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false,
  verification_token VARCHAR(255),
  reset_token VARCHAR(255),
  reset_token_expires TIMESTAMP,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_tenants_email ON tenants(email);
CREATE INDEX idx_tenants_active ON tenants(is_active);

-- Maintenance requests table
CREATE TABLE IF NOT EXISTS maintenance_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  category VARCHAR(50) NOT NULL CHECK (category IN ('plumbing', 'electrical', 'appliance', 'hvac', 'structural', 'other')),
  priority VARCHAR(20) NOT NULL CHECK (priority IN ('emergency', 'high', 'normal', 'low')),
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(50) DEFAULT 'submitted' CHECK (status IN ('submitted', 'acknowledged', 'in_progress', 'pending_parts', 'resolved', 'cancelled')),
  submitted_at TIMESTAMP DEFAULT NOW(),
  acknowledged_at TIMESTAMP,
  started_at TIMESTAMP,
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  rating_comments TEXT,
  estimated_cost DECIMAL(10,2),
  actual_cost DECIMAL(10,2),
  vendor_name VARCHAR(255),
  vendor_contact VARCHAR(255),
  photos TEXT[], -- Array of S3 URLs
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for maintenance requests
CREATE INDEX idx_maintenance_tenant ON maintenance_requests(tenant_id);
CREATE INDEX idx_maintenance_status ON maintenance_requests(status);
CREATE INDEX idx_maintenance_priority ON maintenance_requests(priority);

-- Tenant documents table
CREATE TABLE IF NOT EXISTS tenant_documents (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  document_type VARCHAR(50) NOT NULL CHECK (document_type IN ('lease', 'addendum', 'notice', 'invoice', 'receipt', 'tax_doc', 'insurance', 'other')),
  document_name VARCHAR(255) NOT NULL,
  file_path VARCHAR(500) NOT NULL, -- S3 path
  file_size INTEGER, -- Size in bytes
  mime_type VARCHAR(100),
  uploaded_by VARCHAR(50) CHECK (uploaded_by IN ('tenant', 'landlord')),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  expires_at DATE,
  is_active BOOLEAN DEFAULT true,
  metadata JSONB -- For additional flexible data
);

-- Indexes for documents
CREATE INDEX idx_documents_tenant ON tenant_documents(tenant_id);
CREATE INDEX idx_documents_type ON tenant_documents(document_type);
CREATE INDEX idx_documents_active ON tenant_documents(is_active);

-- Tenant notifications table
CREATE TABLE IF NOT EXISTS tenant_notifications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  type VARCHAR(50) NOT NULL CHECK (type IN ('payment_due', 'payment_received', 'maintenance_update', 'lease_renewal', 'announcement', 'document_available')),
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  action_url VARCHAR(500), -- Optional link to relevant page
  priority VARCHAR(20) DEFAULT 'normal' CHECK (priority IN ('urgent', 'high', 'normal', 'low')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP,
  expires_at TIMESTAMP -- Auto-hide after this date
);

-- Indexes for notifications
CREATE INDEX idx_notifications_tenant ON tenant_notifications(tenant_id);
CREATE INDEX idx_notifications_unread ON tenant_notifications(tenant_id, is_read) WHERE is_read = false;
CREATE INDEX idx_notifications_created ON tenant_notifications(created_at DESC);

-- Tenant login sessions table (for security tracking)
CREATE TABLE IF NOT EXISTS tenant_sessions (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  expires_at TIMESTAMP NOT NULL,
  revoked_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

-- Index for session lookups
CREATE INDEX idx_sessions_token ON tenant_sessions(token_hash);
CREATE INDEX idx_sessions_tenant ON tenant_sessions(tenant_id);
CREATE INDEX idx_sessions_active ON tenant_sessions(is_active, expires_at);

-- Tenant activity log (for audit trail)
CREATE TABLE IF NOT EXISTS tenant_activity_log (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id) ON DELETE CASCADE,
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(50), -- payment, maintenance, document, etc.
  entity_id INTEGER,
  details JSONB,
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Index for activity queries
CREATE INDEX idx_activity_tenant ON tenant_activity_log(tenant_id);
CREATE INDEX idx_activity_created ON tenant_activity_log(created_at DESC);

-- Link existing payment requests to tenants
ALTER TABLE payment_requests 
  ADD COLUMN IF NOT EXISTS tenant_id INTEGER REFERENCES tenants(id);

-- Create view for tenant payment dashboard
CREATE OR REPLACE VIEW tenant_payment_dashboard AS
SELECT 
  t.id as tenant_id,
  t.first_name,
  t.last_name,
  pr.id as request_id,
  pr.amount,
  pr.total_amount,
  pr.bill_type,
  pr.month,
  pr.year,
  pr.status,
  pr.venmo_link,
  pr.charge_date as due_date,
  pr.tracking_id,
  pr.created_at,
  CASE 
    WHEN pr.status = 'paid' THEN 'Paid'
    WHEN pr.status = 'sent' THEN 'Payment Requested'
    WHEN pr.status = 'pending' THEN 'Pending'
    WHEN pr.status = 'foregone' THEN 'Waived'
    ELSE pr.status
  END as display_status,
  CASE
    WHEN pr.status IN ('pending', 'sent') AND pr.charge_date < CURRENT_DATE THEN true
    ELSE false
  END as is_overdue
FROM tenants t
LEFT JOIN payment_requests pr ON (
  pr.roommate_name = CONCAT(t.first_name, ' ', t.last_name) 
  OR pr.tenant_id = t.id
)
WHERE t.is_active = true
ORDER BY pr.year DESC, pr.month DESC, pr.created_at DESC;

-- Create view for maintenance request summary
CREATE OR REPLACE VIEW maintenance_summary AS
SELECT 
  t.id as tenant_id,
  COUNT(CASE WHEN mr.status NOT IN ('resolved', 'cancelled') THEN 1 END) as open_requests,
  COUNT(CASE WHEN mr.status = 'resolved' THEN 1 END) as resolved_requests,
  COUNT(CASE WHEN mr.priority = 'emergency' AND mr.status NOT IN ('resolved', 'cancelled') THEN 1 END) as emergency_requests,
  AVG(mr.satisfaction_rating) as avg_satisfaction,
  MAX(mr.submitted_at) as last_request_date
FROM tenants t
LEFT JOIN maintenance_requests mr ON t.id = mr.tenant_id
WHERE t.is_active = true
GROUP BY t.id;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create triggers for updated_at
CREATE TRIGGER update_tenants_updated_at BEFORE UPDATE ON tenants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON maintenance_requests
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Add comments for documentation
COMMENT ON TABLE tenants IS 'Tenant accounts for self-service portal access';
COMMENT ON TABLE maintenance_requests IS 'Maintenance and repair requests submitted by tenants';
COMMENT ON TABLE tenant_documents IS 'Documents shared between landlord and tenants';
COMMENT ON TABLE tenant_notifications IS 'Push notifications and announcements for tenants';
COMMENT ON TABLE tenant_sessions IS 'Active login sessions for security tracking';
COMMENT ON TABLE tenant_activity_log IS 'Audit trail of all tenant actions in the portal';