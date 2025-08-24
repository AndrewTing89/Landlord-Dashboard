# Landlord Dashboard Deployment Guide

## Overview
This guide documents the complete deployment setup for the Landlord Dashboard application on Ubuntu server, running alongside the Portfolio Optimization app.

## Architecture

### Application Stack
- **Frontend**: React + Vite (Port 3001)
- **Backend API**: Node.js + Express (Port 3002)  
- **Tenant Portal**: React + Vite (Port 3003)
- **Database**: PostgreSQL 15 (Port 5433)
- **Cache**: Redis (shared with portfolio app on 6379)

### Infrastructure
- **Server**: Ubuntu Linux
- **Containerization**: Docker + Docker Compose
- **Reverse Proxy**: Nginx
- **Tunnel**: Cloudflare Tunnel for secure external access
- **Domain**: landlord-dashboard.onlyapps-studio.com

## Files Created

### Core Configuration Files
1. **docker-compose.production.yml** - Production Docker Compose configuration
2. **.env.production** - Production environment variables
3. **nginx.conf** - Nginx reverse proxy configuration
4. **cloudflare-tunnel-config.yml** - Cloudflare tunnel routing rules

### Scripts
1. **deploy.sh** - Automated deployment script
2. **setup-cloudflare-tunnel.sh** - Cloudflare tunnel setup wizard
3. **check-status.sh** - Service health check script

### Documentation
1. **/home/beehiveting/apps/PORTS.md** - Server-wide port allocation documentation
2. **DEPLOYMENT_GUIDE.md** - This file

## Quick Start Deployment

### 1. Initial Setup
```bash
cd /home/beehiveting/apps/landlord-dashboard

# Review and update environment variables
nano .env.production

# Copy to backend directory
cp .env.production backend/.env
```

### 2. Deploy Application
```bash
# Run the deployment script
./deploy.sh

# Or manually:
docker-compose -f docker-compose.production.yml up -d --build
```

### 3. Configure Cloudflare Tunnel
```bash
# Run the setup wizard
./setup-cloudflare-tunnel.sh

# Select option 1 to create a new tunnel
# Or option 2 to use existing tunnel
```

### 4. Update DNS Records
In Cloudflare Dashboard, add these CNAME records:
- `landlord-dashboard.onlyapps-studio.com` → `<tunnel-id>.cfargotunnel.com`
- `tenant.landlord-dashboard.onlyapps-studio.com` → `<tunnel-id>.cfargotunnel.com`
- `api.landlord-dashboard.onlyapps-studio.com` → `<tunnel-id>.cfargotunnel.com` (optional)

### 5. Verify Deployment
```bash
# Check service status
./check-status.sh

# View logs
docker-compose -f docker-compose.production.yml logs -f

# Test endpoints
curl http://localhost:3002/api/health
curl http://localhost:3001
```

## Port Allocations

| Service | Port | Description |
|---------|------|-------------|
| Frontend | 3001 | Main dashboard UI |
| Backend API | 3002 | REST API server |
| Tenant Portal | 3003 | Tenant self-service |
| PostgreSQL | 5433 | Database (separate from portfolio) |

## Environment Variables

### Required
- `DB_PASSWORD` - PostgreSQL password
- `JWT_SECRET` - JWT signing secret
- `SESSION_SECRET` - Session encryption key

### Optional Integrations
- `SIMPLEFIN_TOKEN` - Banking integration
- `GOOGLE_CLIENT_ID/SECRET` - Gmail OAuth
- `DISCORD_WEBHOOK_URL` - Discord notifications
- `TWILIO_*` - SMS notifications
- `AWS_*` - S3 file storage

## Database Management

### Run Migrations
```bash
docker exec landlord-backend npm run migrate
```

### Access PostgreSQL
```bash
docker exec -it landlord-postgres psql -U landlord_user -d landlord_dashboard
```

### Backup Database
```bash
docker exec landlord-postgres pg_dump -U landlord_user landlord_dashboard > backup.sql
```

### Restore Database
```bash
docker exec -i landlord-postgres psql -U landlord_user landlord_dashboard < backup.sql
```

## Container Management

### View Running Containers
```bash
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | grep landlord
```

### Stop Services
```bash
docker-compose -f docker-compose.production.yml down
```

### Stop and Remove Volumes
```bash
docker-compose -f docker-compose.production.yml down -v
```

### Rebuild Specific Service
```bash
docker-compose -f docker-compose.production.yml up -d --build backend
```

## Monitoring & Logs

### View All Logs
```bash
docker-compose -f docker-compose.production.yml logs -f
```

### View Specific Service Logs
```bash
docker logs -f landlord-backend
docker logs -f landlord-frontend
docker logs -f landlord-postgres
```

### Check Resource Usage
```bash
docker stats --no-stream | grep landlord
```

## Troubleshooting

### Backend Not Starting
1. Check environment variables: `docker exec landlord-backend env`
2. Check database connection: `docker logs landlord-backend`
3. Verify migrations: `docker exec landlord-backend npm run migrate`

### Frontend Not Accessible
1. Check if container is running: `docker ps | grep landlord-frontend`
2. Verify port binding: `ss -tuln | grep 3001`
3. Check nginx config if using reverse proxy

### Database Connection Issues
1. Verify PostgreSQL is running: `docker ps | grep landlord-postgres`
2. Check credentials in .env file
3. Test connection: `docker exec landlord-postgres pg_isready`

### Cloudflare Tunnel Issues
1. Check tunnel status: `cloudflared tunnel list`
2. Verify DNS records in Cloudflare dashboard
3. Check tunnel logs: `sudo journalctl -u cloudflared -f`

## Security Considerations

1. **Change Default Passwords**: Update all passwords in .env.production
2. **Use HTTPS**: Always access via Cloudflare tunnel in production
3. **Firewall Rules**: Only expose necessary ports
4. **Regular Updates**: Keep Docker images updated
5. **Backup Strategy**: Implement regular database backups

## Maintenance Tasks

### Daily
- Check service health: `./check-status.sh`
- Review error logs for issues

### Weekly
- Backup database
- Check disk usage: `df -h`
- Review container resource usage

### Monthly
- Update Docker images
- Review and rotate logs
- Security updates

## Integration with Portfolio App

Both applications run independently but share:
- Same server infrastructure
- Cloudflare tunnel (different routes)
- Redis cache (if needed)
- Nginx proxy (different server blocks)

Port conflicts are avoided by:
- Portfolio PostgreSQL: 5432
- Landlord PostgreSQL: 5433
- Different application ports (3xxx vs 8xxx)

## Support & Documentation

- Backend documentation: See CLAUDE.md
- API endpoints: http://localhost:3002/api/docs (if configured)
- Frontend routes: Check src/App.tsx
- Database schema: backend/src/db/init/01-schema.sql

## Next Steps

1. Configure production environment variables
2. Set up automated backups
3. Configure monitoring/alerting
4. Set up CI/CD pipeline
5. Implement log aggregation

---

Last Updated: 2025-08-23
Deployed By: Claude Code Assistant