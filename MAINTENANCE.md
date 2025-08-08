# Landlord Dashboard Maintenance Guide

This guide covers routine maintenance tasks to keep your system running smoothly over the long term.

## Daily Operations

### Starting the System
```bash
# Terminal 1 - Backend
cd backend
npm run dev  # or 'npm start' if nodemon has issues

# Terminal 2 - Frontend  
cd frontend
npm run dev

# Terminal 3 - Docker (if not already running)
docker-compose up -d
```

### Stopping the System Properly
**IMPORTANT**: Always stop servers cleanly before closing your laptop
```bash
# In each terminal, press Ctrl+C to stop the server
# Or run this command to stop all Node processes:
pkill -f "Landlord Dashboard"

# Stop Docker containers
docker-compose down
```

## Weekly Maintenance

### 1. Clean NPM Cache (Prevents permission issues)
```bash
npm cache clean --force
```

### 2. Check for Stuck Processes
```bash
# Check for zombie Node processes
ps aux | grep -i node | grep -v grep

# Kill any stuck processes
pkill -f "vite|nodemon|node src/server.js"
```

### 3. Database Maintenance
```bash
# Check database size
cd backend
node -e "
const db = require('./src/db/connection');
db.query(`
  SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
  FROM pg_tables 
  WHERE schemaname = 'public'
  ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
`).then(res => {
  console.table(res.rows);
  process.exit(0);
});
"

# Vacuum database (reclaim space)
cd backend
node -e "
const db = require('./src/db/connection');
db.query('VACUUM ANALYZE;').then(() => {
  console.log('Database vacuumed successfully');
  process.exit(0);
});
"
```

### 4. Check Sync Logs
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query(`
  SELECT 
    sync_type,
    status,
    DATE(created_at) as date,
    COUNT(*) as count
  FROM sync_logs
  WHERE created_at > NOW() - INTERVAL '7 days'
  GROUP BY sync_type, status, DATE(created_at)
  ORDER BY date DESC, sync_type;
`).then(res => {
  console.table(res.rows);
  process.exit(0);
});
"
```

## Monthly Maintenance

### 1. Full Dependency Refresh
```bash
# Backend
cd backend
rm -rf node_modules package-lock.json
npm install
npm audit fix

# Frontend
cd ../frontend
rm -rf node_modules package-lock.json  
npm install
npm audit fix
```

### 2. Database Backup
```bash
# Create backup directory
mkdir -p ~/Desktop/landlord-backups

# Backup database
docker exec landlord-dashboard-postgres-1 pg_dump -U landlord_user landlord_dashboard > ~/Desktop/landlord-backups/backup_$(date +%Y%m%d).sql

# Verify backup
ls -lh ~/Desktop/landlord-backups/
```

### 3. Archive Old Data
```bash
cd backend
node scripts/archive-old-data.js  # You'll need to create this script
```

### 4. Review ETL Rules
Check if your categorization rules need updates:
```bash
cd backend
node -e "
const db = require('./src/db/connection');
db.query(`
  SELECT 
    category,
    COUNT(*) as rule_count,
    COUNT(CASE WHEN active THEN 1 END) as active_rules
  FROM etl_rules
  GROUP BY category
  ORDER BY category;
`).then(res => {
  console.table(res.rows);
  process.exit(0);
});
"
```

## Troubleshooting Common Issues

### Servers Won't Start
```bash
# 1. Check for port conflicts
lsof -i :3000  # Frontend
lsof -i :3002  # Backend

# 2. Kill stuck processes
pkill -f "Landlord Dashboard"

# 3. Clear caches and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

### NPM Permission Errors
```bash
# Fix npm cache ownership
sudo chown -R $(whoami) ~/.npm

# Alternative: use different npm cache
npm install --cache /tmp/npm-cache
```

### Database Connection Issues
```bash
# Check if Docker is running
docker ps

# Restart Docker containers
docker-compose down
docker-compose up -d

# Check database logs
docker logs landlord-dashboard-postgres-1 --tail 50
```

### High Memory/CPU Usage
```bash
# Check Node memory usage
ps aux | grep node | awk '{sum+=$6} END {print "Total Node.js Memory: " sum/1024 " MB"}'

# Restart everything
docker-compose down
pkill -f "Landlord Dashboard"
docker-compose up -d
# Then start servers again
```

## Performance Monitoring

### Check Response Times
```bash
# Test backend health
curl -w "\nTime: %{time_total}s\n" http://localhost:3002/api/health

# Check database query performance
cd backend
node -e "
const db = require('./src/db/connection');
console.time('Query Time');
db.query('SELECT COUNT(*) FROM transactions').then(res => {
  console.timeEnd('Query Time');
  console.log('Total transactions:', res.rows[0].count);
  process.exit(0);
});
"
```

### Monitor Disk Space
```bash
# Check overall disk usage
df -h

# Check project size
du -sh ~/Desktop/Landlord\ Dashboard/

# Find large files
find ~/Desktop/Landlord\ Dashboard/ -type f -size +10M -exec ls -lh {} \;
```

## Preventive Measures

### 1. Create Start/Stop Scripts

Create `start.sh`:
```bash
#!/bin/bash
echo "Starting Landlord Dashboard..."

# Start Docker
docker-compose up -d

# Wait for Docker
sleep 5

# Start Backend
cd backend && npm run dev &
BACKEND_PID=$!

# Start Frontend
cd ../frontend && npm run dev &
FRONTEND_PID=$!

echo "Backend PID: $BACKEND_PID"
echo "Frontend PID: $FRONTEND_PID"
echo "System started! Press Ctrl+C to stop."

# Wait for interrupt
wait
```

Create `stop.sh`:
```bash
#!/bin/bash
echo "Stopping Landlord Dashboard..."

# Kill Node processes
pkill -f "Landlord Dashboard"

# Stop Docker
docker-compose down

echo "System stopped."
```

Make them executable:
```bash
chmod +x start.sh stop.sh
```

### 2. Set Up Log Rotation

Add to `backend/src/utils/logger.js`:
```javascript
const winston = require('winston');
require('winston-daily-rotate-file');

const transport = new winston.transports.DailyRotateFile({
  filename: 'logs/app-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: '14d'
});
```

### 3. Monitor Critical Metrics

Create `check-health.sh`:
```bash
#!/bin/bash
echo "=== System Health Check ==="
echo "Date: $(date)"

# Check if services are running
echo -e "\n--- Service Status ---"
curl -s http://localhost:3002/api/health > /dev/null && echo "✓ Backend: Running" || echo "✗ Backend: Down"
curl -s http://localhost:3000 > /dev/null && echo "✓ Frontend: Running" || echo "✗ Frontend: Down"
docker ps | grep postgres > /dev/null && echo "✓ Database: Running" || echo "✗ Database: Down"

# Check disk space
echo -e "\n--- Disk Space ---"
df -h | grep -E "Filesystem|/$"

# Check memory
echo -e "\n--- Memory Usage ---"
top -l 1 | grep "PhysMem"

echo -e "\n=== Check Complete ==="
```

## Regular Review Checklist

### Weekly
- [ ] Check sync logs for failures
- [ ] Review unmatched Venmo payments
- [ ] Clear npm cache
- [ ] Check for stuck processes

### Monthly  
- [ ] Full dependency update
- [ ] Database backup
- [ ] Review ETL rules accuracy
- [ ] Check categorization accuracy
- [ ] Archive old logs

### Quarterly
- [ ] Review and optimize database indexes
- [ ] Update dependencies to latest versions
- [ ] Review security advisories
- [ ] Clean up old backups

## Emergency Contacts

- SimpleFIN API Status: https://bridge.simplefin.org/status
- Discord Webhook issues: Check Discord server settings
- Gmail API issues: https://console.cloud.google.com

## Notes

- Always backup before major updates
- Keep at least 3 recent database backups
- Document any custom changes in CLAUDE.md
- If switching computers, remember to transfer .env files