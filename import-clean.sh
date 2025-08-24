#!/bin/bash

echo "Cleaning and importing landlord dashboard backup..."

# Create a cleaned version of the backup
cat /home/beehiveting/apps/landlord-dashboard/backend/backups/landlord_dashboard_complete_backup.sql | \
  grep -v '^BEGIN;' | \
  grep -v '^COMMIT;' | \
  grep -v '^ROLLBACK;' | \
  grep -v '^SET CONSTRAINTS' | \
  sed "s/ARRAY\['\([^']*\)'/'{\"\\1\"'/g" | \
  sed "s/','/\",\"/g" | \
  sed "s/'\]/\"}'/g" > /tmp/cleaned_backup.sql

echo "Importing cleaned backup..."
cat /tmp/cleaned_backup.sql | docker exec -i landlord-postgres psql -U landlord_user -d landlord_dashboard

echo ""
echo "Checking imported data..."
docker exec landlord-postgres psql -U landlord_user -d landlord_dashboard -c "
  SELECT 'Tables:' as item, COUNT(*) as count 
  FROM information_schema.tables 
  WHERE table_schema = 'public';"

docker exec landlord-postgres psql -U landlord_user -d landlord_dashboard -c "
  SELECT table_name, COUNT(*) as records 
  FROM (
    SELECT 'expenses' as table_name, COUNT(*) as count FROM expenses
    UNION ALL SELECT 'income', COUNT(*) FROM income
    UNION ALL SELECT 'payment_requests', COUNT(*) FROM payment_requests
    UNION ALL SELECT 'raw_transactions', COUNT(*) FROM raw_transactions
    UNION ALL SELECT 'tenants', COUNT(*) FROM tenants
    UNION ALL SELECT 'maintenance_tickets', COUNT(*) FROM maintenance_tickets
  ) t
  GROUP BY table_name, count
  ORDER BY table_name;"