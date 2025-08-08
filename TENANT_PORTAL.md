# Tenant Portal Documentation

## Overview
The Tenant Portal is a Progressive Web App (PWA) that provides tenants with self-service access to view and pay utility bills, track payment history, and submit maintenance requests.

## Features

### 1. Authentication
- **Login**: Secure JWT-based authentication
- **Refresh Tokens**: 7-day refresh token lifecycle
- **Session Management**: Automatic token refresh

### 2. Dashboard
- **Balance Overview**: Current balance, pending payments, paid this month
- **Recent Payments**: Last 5 payment transactions
- **Maintenance Requests**: Active maintenance tickets
- **Lease Information**: Lease dates and rental amount

### 3. Payment Management
- **Pending Bills**: View all unpaid utility bills
- **Payment History**: Complete history of paid bills
- **Venmo Integration**: One-click payment with pre-filled Venmo links
  - Venmo Handle: `@andrewhting`
  - Auto-populated amount and tracking ID
- **Bill Breakdown**: Shows total bill vs tenant portion (1/3 split)

### 4. Maintenance Requests
- **Submit Tickets**: Create new maintenance requests
- **Categories**: Plumbing, Electrical, HVAC, Appliances, Structural, Other
- **Priority Levels**: Emergency, High, Normal, Low
- **Track Status**: View ticket progress through stages
- **Photo Upload**: Attach images to maintenance requests

### 5. Discord Notifications
- **New Bills**: Automatic notification when bills are available
- **Payment Reminders**: Scheduled reminders for pending payments
- **Maintenance Updates**: Status changes on maintenance requests

## Technical Stack

### Frontend
- React 18 with TypeScript
- Material-UI Components
- React Router for navigation
- PWA with Service Worker
- Offline capability

### Backend
- Node.js/Express API
- PostgreSQL Database
- JWT Authentication
- Discord Webhooks

## Database Schema

### Key Tables
- `tenants`: Tenant accounts and information
- `maintenance_requests`: Maintenance ticket tracking
- `tenant_sessions`: Active login sessions
- `tenant_notifications`: In-app notifications
- `tenant_activity_log`: Audit trail
- `payment_requests`: Shared with landlord dashboard

## Test Credentials

```
Email: ushi@example.com
Password: testpassword123
```

## API Endpoints

### Authentication
- `POST /api/tenant/auth/login` - Login
- `POST /api/tenant/auth/logout` - Logout
- `POST /api/tenant/auth/refresh` - Refresh token

### Dashboard
- `GET /api/tenant/dashboard` - Dashboard overview

### Payments
- `GET /api/tenant/payments` - Payment history
- `GET /api/tenant/payments/:id` - Payment details

### Maintenance
- `GET /api/tenant/maintenance` - List requests
- `POST /api/tenant/maintenance` - Submit request
- `GET /api/tenant/maintenance/:id` - Request details

## Deployment

### Development
```bash
# Backend
cd backend
npm run dev

# Frontend
cd frontend
npm run dev
```

### Production
1. Build frontend: `npm run build`
2. Deploy backend to server
3. Configure environment variables
4. Set up SSL certificates
5. Configure PWA manifest

## Environment Variables

Required in `backend/.env`:
```
DISCORD_WEBHOOK_PAYMENT_REQUESTS=<webhook_url>
JWT_SECRET=<secret_key>
DATABASE_URL=<postgres_connection>
```

## Security Features
- JWT token expiration (15 min access, 7 day refresh)
- Password hashing with bcrypt
- SQL injection prevention
- XSS protection
- CORS configuration
- Activity logging

## Future Enhancements
- Push notifications
- Document uploads (leases, receipts)
- Payment method management
- Automated rent reminders
- Tenant-to-landlord messaging
- Mobile app versions