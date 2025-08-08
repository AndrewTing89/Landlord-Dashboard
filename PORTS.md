# Port Configuration Guide

## 🔌 Port Assignments

| Service | Port | Description | Directory |
|---------|------|-------------|-----------|
| **Backend API** | 3002 | Main API server (Express/Node.js) | `/backend` |
| **Landlord Frontend** | 3000 | Landlord Dashboard (React/Vite) | `/frontend` |
| **Tenant Frontend** | 3003 | Tenant Portal (React/Vite) | `/tenant-frontend` |
| **PostgreSQL** | 5432 | Database server | Docker container |
| **LocalStack S3** | 4566 | S3 emulation for exports | Docker container |

## 🚀 Quick Start Commands

### Start All Services
```bash
# Backend API
cd backend && npm run dev  # Runs on :3002

# Landlord Dashboard
cd frontend && npm run dev  # Runs on :3000

# Tenant Portal
cd tenant-frontend && npm run dev  # Runs on :3003

# Database & LocalStack
docker-compose up -d  # PostgreSQL :5432, LocalStack :4566
```

## 🔗 Service URLs

### Development
- Landlord Dashboard: http://localhost:3000
- Tenant Portal: http://localhost:3003
- API Documentation: http://localhost:3002/api-docs
- Database: postgresql://localhost:5432/landlord_dashboard

### API Endpoints
- Landlord API: http://localhost:3002/api/*
- Tenant API: http://localhost:3002/api/tenant/*
- Health Check: http://localhost:3002/health

## 🔧 Port Configuration Files

### Backend (`/backend/src/server.js`)
```javascript
const PORT = process.env.PORT || 3002;
```

### Landlord Frontend (`/frontend/vite.config.ts`)
```javascript
server: {
  port: 3000,
  proxy: {
    '/api': 'http://localhost:3002'
  }
}
```

### Tenant Frontend (`/tenant-frontend/vite.config.ts`)
```javascript
server: {
  port: 3003,
  proxy: {
    '/api': 'http://localhost:3002'
  }
}
```

## 📝 Environment Variables

### Backend (`.env`)
```env
PORT=3002
DATABASE_URL=postgresql://user:pass@localhost:5432/landlord_dashboard
```

### Frontend (`.env`)
```env
VITE_API_URL=http://localhost:3002
```

## 🐳 Docker Services

### docker-compose.yml
```yaml
services:
  postgres:
    ports:
      - "5432:5432"
  
  localstack:
    ports:
      - "4566:4566"
```

## ⚠️ Port Conflicts

If you encounter port conflicts:

1. **Check what's using a port:**
   ```bash
   lsof -i :3000  # Check specific port
   ```

2. **Kill process using port:**
   ```bash
   kill -9 $(lsof -t -i:3000)
   ```

3. **Alternative ports (if needed):**
   - Backend: 3002 → 4002
   - Landlord: 3000 → 4000
   - Tenant: 3003 → 4003

## 🔄 Port Forwarding for Production

When deploying, ensure your reverse proxy (nginx/Apache) forwards:
- `/` → Landlord Frontend (3000)
- `/tenant` → Tenant Frontend (3003)
- `/api` → Backend API (3002)

## 📚 Related Documentation
- [README.md](./README.md) - Project overview
- [CLAUDE.md](./CLAUDE.md) - AI assistant instructions
- [TENANT_PORTAL.md](./TENANT_PORTAL.md) - Tenant portal details