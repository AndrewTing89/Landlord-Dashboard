-- Migration: Fix tracking_id constraint to allow proper bill splitting
-- Date: 2025-09-21
-- Issue: The unique constraint on tracking_id was preventing multiple roommates 
--        from having payment requests for the same bill

-- Drop the problematic unique constraint on tracking_id
-- This constraint prevented both roommates from having the same tracking_id
ALTER TABLE payment_requests 
DROP CONSTRAINT IF EXISTS payment_requests_tracking_id_key;

-- The proper constraint (unique_payment_request_per_roommate_per_bill) 
-- already exists and ensures no duplicate payment requests per roommate per bill
-- UNIQUE (roommate_name, month, year, bill_type)

-- This allows:
-- - Both Ushi and Eileen to have payment requests with tracking_id "2024-02-Electricity"
-- - Prevents duplicate payment requests for the same roommate for the same bill
-- - Maintains data integrity while supporting proper bill splitting