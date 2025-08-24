#!/bin/bash

echo "Importing landlord dashboard backup..."

# Import the backup but handle ARRAY to JSONB conversion
sed "s/ARRAY\[\([^]]*\)\]/'\[\1\]'::jsonb/g" /home/beehiveting/apps/landlord-dashboard/backend/backups/landlord_dashboard_complete_backup.sql | \
  sed "s/'\['/\['/g; s/'\]'/'\]/g" | \
  docker exec -i landlord-postgres psql -U landlord_user -d landlord_dashboard

echo "Import complete!"