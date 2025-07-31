-- Create raw_transactions table for staging SimpleFIN data
CREATE TABLE IF NOT EXISTS raw_transactions (
    id SERIAL PRIMARY KEY,
    
    -- SimpleFIN identifiers
    simplefin_id VARCHAR(255) UNIQUE NOT NULL,
    simplefin_account_id VARCHAR(255) NOT NULL,
    
    -- Transaction data
    amount DECIMAL(10, 2) NOT NULL,
    posted_date DATE NOT NULL,
    description TEXT NOT NULL,
    payee VARCHAR(255),
    category VARCHAR(100),
    
    -- ETL metadata
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed BOOLEAN DEFAULT FALSE,
    processed_at TIMESTAMP,
    excluded BOOLEAN DEFAULT FALSE,
    exclude_reason VARCHAR(255),
    
    -- Categorization
    suggested_expense_type VARCHAR(50),
    suggested_merchant VARCHAR(255),
    confidence_score DECIMAL(3, 2), -- 0.00 to 1.00
    
    -- Audit trail
    reviewed_by VARCHAR(100),
    reviewed_at TIMESTAMP,
    notes TEXT
);

-- Create indexes for performance
CREATE INDEX idx_raw_transactions_processed ON raw_transactions(processed);
CREATE INDEX idx_raw_transactions_posted_date ON raw_transactions(posted_date);
CREATE INDEX idx_raw_transactions_simplefin_id ON raw_transactions(simplefin_id);

-- Create ETL rules table for automatic categorization
CREATE TABLE IF NOT EXISTS etl_rules (
    id SERIAL PRIMARY KEY,
    rule_name VARCHAR(100) NOT NULL,
    rule_type VARCHAR(50) NOT NULL, -- 'include', 'exclude', 'categorize'
    priority INTEGER DEFAULT 0,
    
    -- Pattern matching
    description_pattern VARCHAR(255),
    payee_pattern VARCHAR(255),
    amount_min DECIMAL(10, 2),
    amount_max DECIMAL(10, 2),
    
    -- Actions
    action VARCHAR(50) NOT NULL, -- 'approve', 'exclude', 'categorize'
    expense_type VARCHAR(50),
    merchant_name VARCHAR(255),
    exclude_reason VARCHAR(255),
    
    -- Metadata
    active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default ETL rules
INSERT INTO etl_rules (rule_name, rule_type, priority, description_pattern, action, expense_type) VALUES
('PG&E Electricity', 'categorize', 100, '(?i)(pg&e|pacific gas|pge)', 'categorize', 'electricity'),
('Great Oaks Water', 'categorize', 100, '(?i)(great oaks|water)', 'categorize', 'water'),
('Rent Deposits', 'categorize', 90, NULL, 'categorize', 'rent'),
('Maintenance', 'categorize', 80, '(?i)(home depot|lowes|repair|maintenance)', 'categorize', 'maintenance'),
('Exclude Amazon', 'exclude', 70, '(?i)amazon', 'exclude', NULL),
('Exclude Food', 'exclude', 70, '(?i)(starbucks|mcdonald|restaurant|food)', 'exclude', NULL);

-- Add amount condition for rent (credits over $1500)
UPDATE etl_rules 
SET amount_min = -9999999, amount_max = -1500 
WHERE rule_name = 'Rent Deposits';

-- Create a view for pending review transactions
CREATE VIEW pending_review_transactions AS
SELECT 
    rt.*,
    CASE 
        WHEN rt.suggested_expense_type IS NOT NULL THEN rt.suggested_expense_type
        ELSE 'other'
    END as proposed_expense_type
FROM raw_transactions rt
WHERE rt.processed = FALSE 
  AND rt.excluded = FALSE
ORDER BY rt.posted_date DESC;