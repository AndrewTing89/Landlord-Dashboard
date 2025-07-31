#!/bin/bash

# Setup script for daily sync cron job

echo "🔧 Setting up daily transaction sync and bill processing..."

# Get the absolute path to the script
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
SYNC_SCRIPT="$SCRIPT_DIR/../src/scripts/full-sync.js"
LOG_DIR="$SCRIPT_DIR/../../logs"

# Check if script exists
if [ ! -f "$SYNC_SCRIPT" ]; then
    echo "❌ Error: Daily sync script not found at $SYNC_SCRIPT"
    exit 1
fi

# Create logs directory if it doesn't exist
mkdir -p "$LOG_DIR"

# Create a cron entry for 8 AM daily
CRON_CMD="0 8 * * * cd $SCRIPT_DIR/.. && /usr/bin/node $SYNC_SCRIPT daily 7 >> $LOG_DIR/daily-sync.log 2>&1"

# Check if cron entry already exists
if crontab -l 2>/dev/null | grep -q "full-sync.js"; then
    echo "⚠️  Cron job already exists for daily sync"
    echo "   To view existing cron jobs, run: crontab -l"
    echo "   To edit cron jobs, run: crontab -e"
else
    # Add to crontab
    (crontab -l 2>/dev/null; echo ""; echo "# Daily transaction sync and bill processing - runs at 8 AM every day"; echo "$CRON_CMD") | crontab -
    echo "✅ Daily sync cron job added successfully!"
    echo "   The sync will run every day at 8:00 AM"
fi

echo ""
echo "📋 Daily sync details:"
echo "   Schedule: Every day at 8:00 AM"
echo "   Tasks:"
echo "     1. Sync transactions from Bank of America (SimpleFIN)"
echo "     2. Process ETL rules to categorize transactions"
echo "     3. Detect new utility bills (water/electricity)"
echo "     4. Create payment requests automatically"
echo "     5. Send Discord notifications for new bills"
echo "   Log file: $LOG_DIR/daily-sync.log"
echo ""
echo "🔍 To verify the cron job:"
echo "   crontab -l | grep full-sync"
echo ""
echo "📝 To manually run the daily sync:"
echo "   cd $SCRIPT_DIR/.. && node src/scripts/full-sync.js daily 7"
echo ""
echo "📊 To view sync logs:"
echo "   tail -f $LOG_DIR/daily-sync.log"
echo ""
echo "⚙️  To change the schedule:"
echo "   crontab -e  # Then edit the line containing 'full-sync.js'"
echo "   Current: '0 8 * * *' = 8:00 AM daily"
echo "   Format: 'minute hour day month weekday'"
echo ""
echo "❌ To remove the cron job:"
echo "   crontab -e  # Then delete the line containing 'full-sync.js'"