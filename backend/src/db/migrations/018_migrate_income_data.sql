-- Migrate existing income data from transactions to income table

-- First, migrate utility reimbursements
INSERT INTO income (
  date,
  amount,
  description,
  income_type,
  category,
  source_type,
  payer_name,
  notes,
  created_at
)
SELECT 
  date,
  ABS(amount), -- Convert to positive
  name,
  'utility_reimbursement',
  CASE 
    WHEN name ILIKE '%electricity%' OR name ILIKE '%pg&e%' OR name ILIKE '%pge%' THEN 'electricity'
    WHEN name ILIKE '%water%' THEN 'water'
    ELSE 'utility'
  END as category,
  'payment_request', -- These came from payment requests
  CASE 
    WHEN merchant_name IS NOT NULL THEN merchant_name
    ELSE 'Ushi Lo'
  END as payer_name,
  CONCAT('Migrated from transactions table. Original ID: ', id),
  created_at
FROM transactions
WHERE expense_type = 'utility_reimbursement'
  AND date >= '2025-01-01';

-- Migrate rent income (if any exist in transactions - though they shouldn't)
INSERT INTO income (
  date,
  amount,
  description,
  income_type,
  source_type,
  payer_name,
  notes,
  created_at
)
SELECT 
  date,
  ABS(amount), -- Convert to positive
  name,
  'rent',
  'manual',
  'Ushi Lo',
  CONCAT('Migrated from transactions table. Original ID: ', id),
  created_at
FROM transactions
WHERE expense_type = 'rent'
  AND date >= '2025-01-01';

-- Now let's also create income records for paid rent payment requests that don't have transactions
INSERT INTO income (
  date,
  amount,
  description,
  income_type,
  source_type,
  payment_request_id,
  payer_name,
  notes
)
SELECT 
  COALESCE(pr.paid_date, pr.updated_at)::date as date,
  pr.amount::numeric as amount,
  CONCAT('Rent - ', TO_CHAR(TO_DATE(pr.month::text || '-' || pr.year::text, 'MM-YYYY'), 'Month YYYY')) as description,
  'rent',
  'payment_request',
  pr.id,
  pr.roommate_name,
  'Created from paid rent payment request'
FROM payment_requests pr
WHERE pr.bill_type = 'rent'
  AND pr.status = 'paid'
  AND pr.year = 2025
  AND NOT EXISTS (
    -- Don't create duplicate if we already migrated from transactions
    SELECT 1 FROM income i 
    WHERE i.payment_request_id = pr.id
  );

-- Create income records for paid utility payment requests
INSERT INTO income (
  date,
  amount,
  description,
  income_type,
  category,
  source_type,
  payment_request_id,
  payer_name,
  notes
)
SELECT 
  COALESCE(pr.paid_date, pr.updated_at)::date as date,
  pr.amount::numeric as amount,
  CONCAT(
    CASE pr.bill_type
      WHEN 'electricity' THEN 'PG&E'
      WHEN 'water' THEN 'Water'
      ELSE pr.bill_type
    END,
    ' Payment - ',
    TO_CHAR(TO_DATE(pr.month::text || '-' || pr.year::text, 'MM-YYYY'), 'Mon YYYY')
  ) as description,
  'utility_reimbursement',
  pr.bill_type,
  'payment_request',
  pr.id,
  pr.roommate_name,
  'Created from paid utility payment request'
FROM payment_requests pr
WHERE pr.bill_type IN ('electricity', 'water')
  AND pr.status = 'paid'
  AND pr.year = 2025
  AND NOT EXISTS (
    -- Don't create duplicate
    SELECT 1 FROM income i 
    WHERE i.payment_request_id = pr.id
  );