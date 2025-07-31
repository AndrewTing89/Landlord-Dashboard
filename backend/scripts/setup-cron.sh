#!/bin/bash

# Setup script for monthly rent cron job

echo "🔧 Setting up automated monthly rent insertion..."

# Get the absolute path to the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
RENT_SCRIPT="$SCRIPT_DIR/../src/scripts/insert-monthly-rent.js"

# Check if script exists
if [ ! -f "$RENT_SCRIPT" ]; then
    echo "❌ Error: Rent script not found at $RENT_SCRIPT"
    exit 1
fi

# Create a cron entry
CRON_CMD="0 9 1 * * cd $SCRIPT_DIR/.. && /usr/bin/node $RENT_SCRIPT >> $SCRIPT_DIR/../../logs/rent-cron.log 2>&1"

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "insert-monthly-rent.js"; then
    echo "⚠️  Cron job already exists for monthly rent insertion"
    echo "   To view existing cron jobs, run: crontab -l"
    echo "   To edit cron jobs, run: crontab -e"
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo "# Monthly rent insertion - runs at 9 AM on the 1st of each month"; echo "$CRON_CMD") | crontab -
    echo "✅ Cron job added successfully!"
    echo "   The rent will be automatically inserted on the 1st of each month at 9 AM"
fi

echo ""
echo "📋 Cron job details:"
echo "   Schedule: 1st of each month at 9:00 AM"
echo "   Amount: $1,685"
echo "   Log file: logs/rent-cron.log"
echo ""
echo "🔍 To verify the cron job:"
echo "   crontab -l | grep rent"
echo ""
echo "📝 To manually run the rent insertion:"
echo "   cd $SCRIPT_DIR/.. && node src/scripts/insert-monthly-rent.js"
echo ""
echo "⚙️  To remove the cron job later:"
echo "   crontab -e  # Then delete the line containing 'insert-monthly-rent.js'"