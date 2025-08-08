-- Migration 022: Create properties table and establish tenant relationships
-- This migration creates multi-tenant support for the landlord dashboard

-- Create properties table
CREATE TABLE IF NOT EXISTS properties (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    state VARCHAR(2) NOT NULL,
    zip_code VARCHAR(10) NOT NULL,
    rent_amount DECIMAL(10,2) NOT NULL,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Note: tenants table already exists from migration 011_create_tenant_portal_tables.sql
-- We'll work with the existing structure instead of recreating it

-- Add property_id to payment_requests table if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'payment_requests' AND column_name = 'property_id'
    ) THEN
        ALTER TABLE payment_requests ADD COLUMN property_id INTEGER REFERENCES properties(id);
    END IF;
END $$;

-- Create indexes for performance (without CONCURRENTLY to allow transaction)
CREATE INDEX IF NOT EXISTS idx_payment_requests_tenant_id 
    ON payment_requests(tenant_id) WHERE tenant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_requests_property_id 
    ON payment_requests(property_id) WHERE property_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_tenants_property_id 
    ON tenants(property_id);

CREATE INDEX IF NOT EXISTS idx_tenants_is_active 
    ON tenants(is_active) WHERE is_active = true;

-- Create index on roommate_name for the data migration that follows
CREATE INDEX IF NOT EXISTS idx_payment_requests_roommate_name 
    ON payment_requests(roommate_name);

-- Insert seed property data
INSERT INTO properties (name, address, city, state, zip_code, rent_amount)
VALUES ('Main Property', '123 Main Street', 'San Francisco', 'CA', '94102', 1685.00)
ON CONFLICT DO NOTHING;

-- Insert seed tenant data using existing tenants table structure
-- Note: We'll link UshiLo and Ushi Lo as the same tenant
INSERT INTO tenants (
    email, password_hash, first_name, last_name, phone, 
    lease_start, lease_end, monthly_rent, property_id, 
    unit_number, is_active
)
VALUES (
    'ushilo@example.com', 
    '$2b$10$defaulthashfortesting', 
    'Ushi', 'Lo', 
    '555-0123',
    '2024-01-01', 
    '2025-01-01', 
    561.67, -- 1685/3 split for utilities
    1, 
    'Unit A', 
    true
)
ON CONFLICT (email) DO NOTHING;

-- Update existing payment_requests to link to tenant_id = 1 for UshiLo entries
-- This handles both 'UshiLo' and 'Ushi Lo' spellings
UPDATE payment_requests 
SET tenant_id = 1, property_id = 1 
WHERE roommate_name IN ('UshiLo', 'Ushi Lo') 
  AND tenant_id IS NULL;

-- Add comment to track migration
COMMENT ON TABLE properties IS 'Multi-tenant properties table - created in migration 022';
COMMENT ON TABLE tenants IS 'Property tenants table - created in migration 022';