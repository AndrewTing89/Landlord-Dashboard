#!/bin/bash

# Apply all database migrations for landlord-dashboard

echo "Applying all database migrations..."

MIGRATIONS_DIR="/home/beehiveting/apps/landlord-dashboard/backend/src/db/migrations"

# Apply each migration file in order
for file in \
  "${MIGRATIONS_DIR}/011_add_payment_request_paid_date.sql" \
  "${MIGRATIONS_DIR}/012_add_payment_request_charge_date.sql" \
  "${MIGRATIONS_DIR}/013_create_utility_adjustments.sql" \
  "${MIGRATIONS_DIR}/014_create_sync_history.sql" \
  "${MIGRATIONS_DIR}/015_add_updated_at_to_tables.sql" \
  "${MIGRATIONS_DIR}/015_create_venmo_email_tracking.sql" \
  "${MIGRATIONS_DIR}/016_add_venmo_web_link.sql" \
  "${MIGRATIONS_DIR}/017_create_income_table.sql" \
  "${MIGRATIONS_DIR}/018_migrate_income_data.sql" \
  "${MIGRATIONS_DIR}/019_clean_transactions_table.sql" \
  "${MIGRATIONS_DIR}/020_create_audit_log.sql" \
  "${MIGRATIONS_DIR}/021_add_ignored_to_venmo_emails.sql" \
  "${MIGRATIONS_DIR}/022_create_properties_and_tenant_links.sql"
do
  if [ -f "$file" ]; then
    echo "Applying: $(basename "$file")"
    cat "$file" | docker exec -i landlord-postgres psql -U landlord_user -d landlord_dashboard 2>&1 | grep -E "CREATE|ALTER|INSERT|UPDATE|DELETE|ERROR" | head -5
    echo ""
  fi
done

# Apply schema.sql to ensure all base tables exist
echo "Ensuring base schema..."
cat "${MIGRATIONS_DIR}/../schema.sql" | docker exec -i landlord-postgres psql -U landlord_user -d landlord_dashboard 2>&1 | grep -E "CREATE|ERROR" | head -10

echo "Migration complete! Checking tables..."
docker exec landlord-postgres psql -U landlord_user -d landlord_dashboard -c "\dt" | head -30