#!/bin/bash

# Landlord Dashboard Deployment Script
# This script deploys the landlord-dashboard application

set -e  # Exit on error

echo "=========================================="
echo "Deploying Landlord Dashboard"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to the landlord-dashboard directory
cd /home/beehiveting/apps/landlord-dashboard

# Step 1: Check environment file
echo -e "${YELLOW}Step 1: Checking environment configuration...${NC}"
if [ ! -f backend/.env ]; then
    if [ -f .env.production ]; then
        echo "Copying .env.production to backend/.env"
        cp .env.production backend/.env
    else
        echo -e "${RED}Error: No .env file found in backend directory${NC}"
        echo "Please create backend/.env or .env.production first"
        exit 1
    fi
fi
echo -e "${GREEN}✓ Environment configuration ready${NC}"
echo ""

# Step 2: Build and start containers
echo -e "${YELLOW}Step 2: Building and starting Docker containers...${NC}"
docker-compose -f docker-compose.production.yml up -d --build

echo -e "${GREEN}✓ Containers started${NC}"
echo ""

# Step 3: Wait for database to be ready
echo -e "${YELLOW}Step 3: Waiting for database to be ready...${NC}"
sleep 10  # Give PostgreSQL time to initialize

# Check if database is ready
until docker exec landlord-postgres pg_isready -U landlord_user -d landlord_dashboard > /dev/null 2>&1; do
    echo "Waiting for database..."
    sleep 5
done
echo -e "${GREEN}✓ Database is ready${NC}"
echo ""

# Step 4: Run database migrations
echo -e "${YELLOW}Step 4: Running database migrations...${NC}"
docker exec landlord-backend npm run migrate || echo "Migrations may have already been applied"
echo -e "${GREEN}✓ Migrations complete${NC}"
echo ""

# Step 5: Check container status
echo -e "${YELLOW}Step 5: Checking container status...${NC}"
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep landlord
echo ""

# Step 6: Health check
echo -e "${YELLOW}Step 6: Running health check...${NC}"
sleep 5
if curl -f http://localhost:3002/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Backend API is healthy${NC}"
else
    echo -e "${RED}✗ Backend API health check failed${NC}"
fi

if curl -f http://localhost:3001 > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Frontend is accessible${NC}"
else
    echo -e "${YELLOW}! Frontend may still be starting up${NC}"
fi
echo ""

# Step 7: Display access information
echo "=========================================="
echo -e "${GREEN}Deployment Complete!${NC}"
echo "=========================================="
echo ""
echo "Access your application at:"
echo "  - Frontend: http://localhost:3001"
echo "  - Backend API: http://localhost:3002"
echo "  - Tenant Portal: http://localhost:3003"
echo "  - PostgreSQL: localhost:5433"
echo ""
echo "For production domain access:"
echo "  - https://landlord-dashboard.onlyapps-studio.com"
echo "  - https://tenant.landlord-dashboard.onlyapps-studio.com"
echo ""
echo "To view logs:"
echo "  docker-compose -f docker-compose.production.yml logs -f [service-name]"
echo ""
echo "To stop the application:"
echo "  docker-compose -f docker-compose.production.yml down"
echo ""

# Optional: Show recent logs
echo -e "${YELLOW}Recent backend logs:${NC}"
docker logs landlord-backend --tail 20 2>&1 || echo "Backend container may still be starting..."