-- This file is automatically run by PostgreSQL on container startup
-- Copy of schema.sql for Docker initialization

-- Transactions table to store all Plaid transactions
CREATE TABLE IF NOT EXISTS transactions (
    id SERIAL PRIMARY KEY,
    plaid_transaction_id VARCHAR(255) UNIQUE NOT NULL,
    plaid_account_id VARCHAR(255) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    date DATE NOT NULL,
    name VARCHAR(255) NOT NULL,
    merchant_name VARCHAR(255),
    category VARCHAR(100),
    subcategory VARCHAR(100),
    expense_type VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense categories for classification
CREATE TABLE IF NOT EXISTS expense_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    keywords JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Utility bills tracking
CREATE TABLE IF NOT EXISTS utility_bills (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    bill_type VARCHAR(50) NOT NULL,
    total_amount DECIMAL(10, 2) NOT NULL,
    split_amount DECIMAL(10, 2) NOT NULL,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    payment_requested BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(transaction_id, month, year)
);

-- Payment requests tracking
CREATE TABLE IF NOT EXISTS payment_requests (
    id SERIAL PRIMARY KEY,
    utility_bill_id INTEGER REFERENCES utility_bills(id),
    roommate_name VARCHAR(100) NOT NULL,
    venmo_username VARCHAR(100) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    request_date DATE NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    venmo_link TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Monthly reports for tax purposes
CREATE TABLE IF NOT EXISTS monthly_reports (
    id SERIAL PRIMARY KEY,
    month INTEGER NOT NULL,
    year INTEGER NOT NULL,
    total_revenue DECIMAL(10, 2),
    total_expenses DECIMAL(10, 2),
    expense_breakdown JSONB,
    report_s3_key VARCHAR(500),
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, year)
);

-- Plaid tokens storage
CREATE TABLE IF NOT EXISTS plaid_tokens (
    id SERIAL PRIMARY KEY,
    access_token TEXT NOT NULL,
    item_id VARCHAR(255) NOT NULL,
    institution_name VARCHAR(255),
    accounts JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Job runs tracking
CREATE TABLE IF NOT EXISTS job_runs (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    run_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL,
    details JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_expense_type ON transactions(expense_type);
CREATE INDEX idx_utility_bills_month_year ON utility_bills(month, year);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);

-- Insert default expense categories
INSERT INTO expense_categories (category_name, keywords) VALUES
('electricity', '["PGE", "PG&E", "PACIFIC GAS", "ELECTRIC"]'::jsonb),
('water', '["WATER", "EBMUD", "EAST BAY MUNICIPAL"]'::jsonb),
('maintenance', '["HOME DEPOT", "LOWES", "LOWE''S", "ACE HARDWARE", "REPAIR"]'::jsonb),
('rent', '["RENT", "RENTAL INCOME", "TENANT", "ZELLE", "VENMO"]'::jsonb),
('other', '[]'::jsonb)
ON CONFLICT DO NOTHING;