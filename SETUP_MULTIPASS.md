# 🚀 Multipass Setup Guide for Landlord Dashboard

This guide will help you set up the Landlord Dashboard on a new Windows laptop using Ubuntu Multipass.

## Prerequisites on Windows

1. **Install Claude Code**
   ```powershell
   # Download from: https://claude.ai/code
   ```

2. **Install Multipass**
   ```powershell
   # Download from: https://multipass.run
   # Or use winget:
   winget install Canonical.Multipass
   ```

3. **Install Git for Windows**
   ```powershell
   # Download from: https://git-scm.com
   ```

## Step 1: Create Ubuntu VM

```powershell
# Open PowerShell and create VM with sufficient resources
multipass launch --name landlord --memory 4G --disk 20G --cpus 2 22.04

# Verify it's running
multipass list

# Get into the VM
multipass shell landlord
```

## Step 2: Install Required Software (Inside VM)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Install PostgreSQL
sudo apt install -y postgresql postgresql-contrib

# Install other tools
sudo apt install -y git build-essential

# Install PM2 globally
sudo npm install -g pm2
```

## Step 3: Setup PostgreSQL Database

```bash
# Switch to postgres user
sudo -u postgres psql

# In PostgreSQL prompt, run:
CREATE USER landlord_user WITH PASSWORD 'landlord_pass';
CREATE DATABASE landlord_dashboard OWNER landlord_user;
GRANT ALL PRIVILEGES ON DATABASE landlord_dashboard TO landlord_user;
\q

# Test connection
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard
\q
```

## Step 4: Clone and Setup Application

```bash
# Clone the repository
cd ~
git clone https://github.com/AndrewTing89/Landlord-Dashboard.git
cd Landlord-Dashboard

# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
npm run build
```

## Step 5: Configure Environment Variables

### Option A: Transfer from Main Laptop
```powershell
# From Windows PowerShell (on main laptop)
multipass transfer C:\path\to\backend\.env landlord:Landlord-Dashboard/backend/
multipass transfer C:\path\to\gmail-token.json landlord:Landlord-Dashboard/backend/
```

### Option B: Create Manually
```bash
# In VM, create .env file
cd ~/Landlord-Dashboard/backend
cp .env.example .env
nano .env
# Edit with your actual values
```

## Step 6: Import Database (If you have existing data)

### On Main Laptop:
```bash
# Export database
pg_dump DATABASE_URL > landlord_backup.sql
```

### Transfer and Import:
```powershell
# From Windows
multipass transfer landlord_backup.sql landlord:
```

```bash
# In VM
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard < ~/landlord_backup.sql
```

## Step 7: Start Application with PM2

```bash
cd ~/Landlord-Dashboard

# Start backend
pm2 start backend/src/server.js --name landlord-api

# Serve frontend build
pm2 serve frontend/build 3000 --name landlord-ui --spa

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
pm2 startup systemd -u ubuntu --hp /home/ubuntu
# Copy and run the command it gives you
```

## Step 8: Configure VM to Never Sleep

```bash
# Disable all sleep/suspend features
sudo systemctl mask sleep.target suspend.target hibernate.target hybrid-sleep.target

# Verify services are running
pm2 list
pm2 logs
```

## Step 9: Access Your Dashboard

```powershell
# From Windows, find VM IP
multipass info landlord

# Look for IPv4 address, e.g., 172.24.140.99
# Access in browser:
# http://172.24.140.99:3000 (Frontend)
# http://172.24.140.99:3002/api/health (Backend health check)
```

## Step 10: Setup Port Forwarding (Optional - for network access)

```powershell
# In Windows PowerShell (Admin mode)
# Replace 172.24.140.99 with your VM's IP

# Forward frontend
netsh interface portproxy add v4tov4 listenport=3000 listenaddress=0.0.0.0 connectport=3000 connectaddress=172.24.140.99

# Forward backend
netsh interface portproxy add v4tov4 listenport=3002 listenaddress=0.0.0.0 connectport=3002 connectaddress=172.24.140.99

# Now accessible from any device on network via Windows IP
```

## Daily Management Commands

### Windows (PowerShell):
```powershell
# Start VM
multipass start landlord

# Stop VM
multipass stop landlord

# Get into VM
multipass shell landlord

# Check status
multipass list
```

### Inside VM:
```bash
# Check app status
pm2 list
pm2 logs

# Restart apps
pm2 restart all

# Update from GitHub
cd ~/Landlord-Dashboard
git pull
pm2 restart all

# Check database
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard
```

## Automated Tasks Setup

```bash
# Edit crontab for scheduled tasks
crontab -e

# Add these lines:
# Daily sync at 8 AM
0 8 * * * cd /home/ubuntu/Landlord-Dashboard/backend && node src/scripts/daily/full-sync.js daily 7

# Electricity billing on 15th
0 9 15 * * cd /home/ubuntu/Landlord-Dashboard/backend && node src/scripts/process-electricity-bills.js

# Water billing on 25th  
0 9 25 * * cd /home/ubuntu/Landlord-Dashboard/backend && node src/scripts/process-water-bills.js
```

## Troubleshooting

### Can't connect to database:
```bash
# Check PostgreSQL is running
sudo systemctl status postgresql
sudo systemctl start postgresql
```

### Can't access from browser:
```bash
# Check PM2 processes
pm2 list
pm2 restart all

# Check firewall
sudo ufw status
sudo ufw allow 3000
sudo ufw allow 3002
```

### VM not starting automatically:
```powershell
# Set VM to autostart
multipass set local.landlord.autostart=true
```

## Backup Strategy

```bash
# Weekly backup script (add to crontab)
#!/bin/bash
# backup.sh
pg_dump postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard > ~/backup_$(date +%Y%m%d).sql
```

## Security Notes

- Never commit .env files to GitHub
- Keep all tokens and secrets secure
- Use strong passwords for database
- Consider setting up UFW firewall rules
- Regular system updates: `sudo apt update && sudo apt upgrade`

## Need Help?

- Check logs: `pm2 logs`
- Database issues: `sudo -u postgres psql`
- Network issues: `multipass info landlord`
- Application errors: Check `/home/ubuntu/Landlord-Dashboard/backend/logs/`