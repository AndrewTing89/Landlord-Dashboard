#!/bin/bash

# Service Status Check Script
# Shows the status of all running applications

echo "================================================"
echo "Application Status Check"
echo "Date: $(date)"
echo "================================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Function to check if port is listening
check_port() {
    local port=$1
    local service=$2
    if ss -tuln | grep -q ":$port "; then
        echo -e "${GREEN}✓${NC} $service (port $port) is listening"
    else
        echo -e "${RED}✗${NC} $service (port $port) is not listening"
    fi
}

echo "=== Port Status ==="
check_port 80 "Nginx HTTP"
check_port 443 "Nginx HTTPS"
check_port 3001 "Landlord Frontend"
check_port 3002 "Landlord Backend API"
check_port 3003 "Tenant Portal"
check_port 5432 "Portfolio PostgreSQL"
check_port 5433 "Landlord PostgreSQL"
check_port 6379 "Redis Cache"
check_port 8081 "Portfolio Data Pipeline"
check_port 8501 "Portfolio Dashboard"
echo ""

echo "=== Docker Containers ==="
echo "Portfolio Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep portfolio || echo "No portfolio containers running"
echo ""
echo "Landlord Containers:"
docker ps --format "table {{.Names}}\t{{.Status}}" | grep landlord || echo "No landlord containers running"
echo ""

echo "=== Health Checks ==="
# Portfolio health check
if curl -sf http://localhost:8081/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Portfolio API is healthy"
else
    echo -e "${RED}✗${NC} Portfolio API health check failed"
fi

# Landlord health check
if curl -sf http://localhost:3002/api/health > /dev/null 2>&1; then
    echo -e "${GREEN}✓${NC} Landlord API is healthy"
else
    echo -e "${YELLOW}!${NC} Landlord API not responding (may still be starting)"
fi
echo ""

echo "=== Cloudflare Tunnel ==="
if ps aux | grep -v grep | grep -q cloudflared; then
    echo -e "${GREEN}✓${NC} Cloudflare tunnel is running"
    ps aux | grep cloudflared | grep -v grep | head -1
else
    echo -e "${YELLOW}!${NC} Cloudflare tunnel is not running"
    echo "  Run: ./setup-cloudflare-tunnel.sh to configure"
fi
echo ""

echo "=== URLs ==="
echo "Local Access:"
echo "  Portfolio: http://localhost:8501"
echo "  Landlord Dashboard: http://localhost:3001"
echo "  Landlord API: http://localhost:3002"
echo "  Tenant Portal: http://localhost:3003"
echo ""
echo "Production URLs (requires Cloudflare tunnel):"
echo "  https://portfolio.onlyapps-studio.com"
echo "  https://landlord-dashboard.onlyapps-studio.com"
echo "  https://tenant.landlord-dashboard.onlyapps-studio.com"