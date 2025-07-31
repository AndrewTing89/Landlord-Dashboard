#!/bin/bash

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo "Checking Landlord Dashboard Health..."
echo "===================================="

# Check Backend API
echo -n "Backend API: "
if curl -s http://localhost:3002/health > /dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
fi

# Check Frontend
echo -n "Frontend: "
if curl -s http://localhost:3000 > /dev/null; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
fi

# Check Database
echo -n "PostgreSQL: "
if docker exec landlorddashboard-postgres-1 pg_isready > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Running${NC}"
else
    echo -e "${RED}✗ Not responding${NC}"
fi

# Check PM2 processes
echo -e "\nPM2 Process Status:"
pm2 list

# Check disk space
echo -e "\nDisk Space:"
df -h | grep -E "^/dev/" | head -5

# Check recent logs for errors
echo -e "\nRecent Errors (last 10):"
if [ -d logs ]; then
    grep -i error logs/*.log 2>/dev/null | tail -10 || echo "No recent errors found"
else
    echo "Log directory not found"
fi

echo -e "\nNext Scheduled Tasks:"
echo "- Transaction sync: Tomorrow 5:00 AM"
echo "- Bill processing: 5th of month at 5:00 AM"
echo "- Email checks: 9:00 AM and 6:00 PM daily"