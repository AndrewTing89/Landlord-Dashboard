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
    expense_type VARCHAR(50), -- 'electricity', 'water', 'maintenance', 'rent', 'other'
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Expense categories for classification
CREATE TABLE IF NOT EXISTS expense_categories (
    id SERIAL PRIMARY KEY,
    category_name VARCHAR(50) NOT NULL,
    keywords JSONB NOT NULL, -- Array of keywords for matching
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Utility bills tracking
CREATE TABLE IF NOT EXISTS utility_bills (
    id SERIAL PRIMARY KEY,
    transaction_id INTEGER REFERENCES transactions(id),
    bill_type VARCHAR(50) NOT NULL, -- 'electricity' or 'water'
    total_amount DECIMAL(10, 2) NOT NULL,
    split_amount DECIMAL(10, 2) NOT NULL, -- amount per person
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
    status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'paid'
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
    expense_breakdown JSONB, -- Object with category breakdowns
    report_s3_key VARCHAR(500), -- S3 key for Excel file
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(month, year)
);

-- Job runs tracking
CREATE TABLE IF NOT EXISTS job_runs (
    id SERIAL PRIMARY KEY,
    job_name VARCHAR(100) NOT NULL,
    run_date TIMESTAMP NOT NULL,
    status VARCHAR(20) NOT NULL, -- 'success', 'failed'
    details JSONB, -- Job details
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for better performance
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_transactions_expense_type ON transactions(expense_type);
CREATE INDEX idx_utility_bills_month_year ON utility_bills(month, year);
CREATE INDEX idx_payment_requests_status ON payment_requests(status);