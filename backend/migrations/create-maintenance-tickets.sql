-- Create maintenance tickets table
CREATE TABLE IF NOT EXISTS maintenance_tickets (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    tenant_name VARCHAR(255),
    unit VARCHAR(50),
    notes TEXT,
    estimated_cost DECIMAL(10, 2),
    actual_cost DECIMAL(10, 2),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_tickets_status ON maintenance_tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_priority ON maintenance_tickets(priority);
CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON maintenance_tickets(created_at);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_maintenance_tickets_updated_at 
    BEFORE UPDATE ON maintenance_tickets 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add some sample data
INSERT INTO maintenance_tickets (title, description, status, priority, tenant_name, unit, notes, estimated_cost, actual_cost) VALUES
('Leaky faucet in kitchen', 'The kitchen faucet has been dripping constantly for the past week. Water is pooling under the sink.', 'open', 'medium', 'John Smith', '101', 'May need to replace washers', 150.00, NULL),
('AC not cooling properly', 'Air conditioning unit is running but not cooling. Temperature stays at 78F even when set to 70F.', 'in_progress', 'high', 'Sarah Johnson', '202', 'Technician scheduled for tomorrow', 300.00, NULL),
('Broken bedroom door handle', 'The door handle to the master bedroom broke off. Currently using pliers to open.', 'open', 'low', 'Mike Chen', '105', NULL, 75.00, NULL),
('Water heater not working', 'No hot water for the past 2 days. Pilot light appears to be out.', 'completed', 'urgent', 'Emily Davis', '304', 'Replaced thermocouple', 200.00, 185.00),
('Toilet running constantly', 'Toilet in the main bathroom runs constantly. Have to jiggle handle to stop it.', 'open', 'medium', 'Robert Wilson', '203', 'Likely flapper valve issue', 100.00, NULL);