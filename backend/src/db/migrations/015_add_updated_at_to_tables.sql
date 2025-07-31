-- Add updated_at column to tables that need it
-- This migration adds the column only if it doesn't already exist

-- Function to safely add updated_at column
CREATE OR REPLACE FUNCTION add_updated_at_column(table_name text) RETURNS void AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = 'updated_at'
    ) THEN
        EXECUTE format('ALTER TABLE %I ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP', $1);
        RAISE NOTICE 'Added updated_at column to table %', $1;
    ELSE
        RAISE NOTICE 'Table % already has updated_at column', $1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Add updated_at to tables that commonly need it
SELECT add_updated_at_column('transactions');
SELECT add_updated_at_column('raw_transactions');
SELECT add_updated_at_column('payment_requests');
SELECT add_updated_at_column('utility_bills');
SELECT add_updated_at_column('utility_adjustments');
SELECT add_updated_at_column('etl_rules');

-- Note: We're NOT adding it to sync_history because it already has
-- started_at and completed_at which serve the same purpose

-- Create trigger function to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for tables that have updated_at
CREATE OR REPLACE FUNCTION create_updated_at_trigger(table_name text) RETURNS void AS $$
BEGIN
    IF EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = $1 
        AND column_name = 'updated_at'
    ) THEN
        EXECUTE format('DROP TRIGGER IF EXISTS update_%I_updated_at ON %I', $1, $1);
        EXECUTE format('CREATE TRIGGER update_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()', $1, $1);
        RAISE NOTICE 'Created updated_at trigger for table %', $1;
    END IF;
END;
$$ LANGUAGE plpgsql;

-- Create triggers
SELECT create_updated_at_trigger('transactions');
SELECT create_updated_at_trigger('raw_transactions');
SELECT create_updated_at_trigger('payment_requests');
SELECT create_updated_at_trigger('utility_bills');
SELECT create_updated_at_trigger('utility_adjustments');
SELECT create_updated_at_trigger('etl_rules');

-- Clean up functions
DROP FUNCTION add_updated_at_column(text);
DROP FUNCTION create_updated_at_trigger(text);