#!/bin/bash

echo "Setting up Landlord Dashboard for local production..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo -e "${RED}Node.js is not installed. Please install Node.js first.${NC}"
    exit 1
fi

# Check if Docker is running
if ! docker info &> /dev/null; then
    echo -e "${RED}Docker is not running. Please start Docker first.${NC}"
    exit 1
fi

# Check if PM2 is installed globally
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2 globally...${NC}"
    npm install -g pm2
fi

# Check if serve is installed globally (for serving React build)
if ! command -v serve &> /dev/null; then
    echo -e "${YELLOW}Installing serve globally...${NC}"
    npm install -g serve
fi

# Install dependencies
echo -e "${GREEN}Installing dependencies...${NC}"
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# Build frontend
echo -e "${GREEN}Building frontend...${NC}"
cd frontend && npm run build && cd ..

# Check if .env files exist
if [ ! -f backend/.env ]; then
    echo -e "${YELLOW}Creating backend/.env file...${NC}"
    cp backend/.env.example backend/.env 2>/dev/null || echo -e "${RED}Please create backend/.env file${NC}"
fi

if [ ! -f frontend/.env ]; then
    echo -e "${YELLOW}Creating frontend/.env file...${NC}"
    echo "REACT_APP_API_URL=http://localhost:3002" > frontend/.env
fi

# Setup database
echo -e "${GREEN}Setting up database...${NC}"
docker-compose up -d

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready..."
sleep 5

# Run migrations
echo -e "${GREEN}Running database migrations...${NC}"
cd backend && npm run migrate && cd ..

# Create logs directory
mkdir -p logs

# Setup PM2
echo -e "${GREEN}Setting up PM2...${NC}"
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.js

# Save PM2 configuration
pm2 save

# Setup PM2 to start on boot
echo -e "${YELLOW}Setting up PM2 startup script...${NC}"
pm2 startup

echo -e "${GREEN}✅ Setup complete!${NC}"
echo
echo "Your Landlord Dashboard is now running locally:"
echo "- Frontend: http://localhost:3000"
echo "- Backend API: http://localhost:3002"
echo "- Database: PostgreSQL on port 5432"
echo
echo "Useful commands:"
echo "- View logs: pm2 logs"
echo "- Stop all: pm2 stop all"
echo "- Start all: pm2 start all"
echo "- Restart all: pm2 restart all"
echo "- Monitor: pm2 monit"
echo
echo -e "${YELLOW}⚠️  Important next steps:${NC}"
echo "1. Update backend/.env with your real credentials:"
echo "   - Plaid credentials (switch to development mode)"
echo "   - Email credentials for notifications"
echo "   - Twilio credentials for SMS (optional)"
echo "   - Roommate information"
echo
echo "2. Connect your Bank of America account:"
echo "   - Go to http://localhost:3000/settings"
echo "   - Click 'Connect Bank Account'"
echo "   - Use Plaid Link to connect your real account"
echo
echo "3. Test the system:"
echo "   - Wait for transactions to sync"
echo "   - Check if PG&E and water bills are detected"
echo "   - Test payment request creation"
echo
echo -e "${GREEN}The system will automatically:${NC}"
echo "- Sync transactions daily at 5 AM"
echo "- Process bills on the 5th of each month"
echo "- Check for payment confirmations at 9 AM and 6 PM"