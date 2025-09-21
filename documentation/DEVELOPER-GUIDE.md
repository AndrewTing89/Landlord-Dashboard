# Landlord Dashboard - Developer Guide

This guide provides comprehensive instructions for setting up and developing the Landlord Dashboard system locally. Whether you're a new developer joining the project or an experienced developer looking to contribute, this guide will get you up and running quickly.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [First Time Setup](#first-time-setup)
3. [Development Workflow](#development-workflow)
4. [Project Structure](#project-structure)
5. [Making Changes](#making-changes)
6. [Common Tasks](#common-tasks)
7. [Code Conventions](#code-conventions)
8. [Troubleshooting](#troubleshooting)

## Prerequisites

Before you begin, ensure you have the following tools installed on your system:

### Required Software

- **Node.js** (v18 or higher)
  ```bash
  # Check version
  node --version
  npm --version
  ```

- **Docker & Docker Compose**
  ```bash
  # Check version
  docker --version
  docker-compose --version
  ```

- **PostgreSQL Client Tools** (optional but recommended)
  ```bash
  # For connecting directly to the database
  psql --version
  ```

- **Git**
  ```bash
  git --version
  ```

### Optional Tools

- **pgAdmin** or **DBeaver** - GUI database management tools
- **Postman** or **Insomnia** - API testing tools
- **VS Code** with recommended extensions:
  - PostgreSQL by Microsoft
  - Docker by Microsoft
  - ES7+ React/Redux/React-Native snippets

## First Time Setup

### 1. Clone the Repository

```bash
git clone [repository-url]
cd landlord-dashboard
```

### 2. Environment Variables Setup

Create environment files for both backend and frontend:

#### Backend Environment (.env)

Create `/backend/.env` with the following variables:

```bash
# Database Configuration
DATABASE_URL=postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard

# Server Configuration
PORT=3002
NODE_ENV=development

# SimpleFIN Integration (Bank Sync)
SIMPLEFIN_TOKEN=your_simplefin_token_here
SIMPLEFIN_BASE_URL=https://bridge.simplefin.org

# Gmail OAuth (Venmo Email Monitoring)
GMAIL_CLIENT_ID=your_gmail_client_id
GMAIL_CLIENT_SECRET=your_gmail_client_secret
GMAIL_REDIRECT_URI=http://localhost:3002/auth/gmail/callback

# Discord Notifications
DISCORD_WEBHOOK_PAYMENT=https://discord.com/api/webhooks/your_webhook_url
DISCORD_WEBHOOK_BILLS=https://discord.com/api/webhooks/your_webhook_url

# AWS S3 (for file storage)
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_REGION=us-west-2
S3_BUCKET_NAME=landlord-dashboard-files

# Security
JWT_SECRET=your_jwt_secret_key_here
BCRYPT_ROUNDS=10
```

#### Frontend Environment (.env)

Create `/frontend/.env`:

```bash
VITE_API_URL=http://localhost:3002
```

### 3. Database Initialization

Start the PostgreSQL container and initialize the database:

```bash
# Start PostgreSQL container
docker-compose up postgres -d

# Wait for the database to be ready (check logs)
docker-compose logs postgres

# Run database migrations
cd backend
npm install
npm run migrate
```

### 4. Docker Container Setup

Build and start all services:

```bash
# From the root directory
docker-compose up --build

# Or run in detached mode
docker-compose up -d
```

This will start:
- **PostgreSQL** on port 5432
- **Backend** on port 3002
- **Frontend** on port 3000
- **LocalStack** (S3 emulation) on port 4566

### 5. Verify Installation

Check that all services are running:

```bash
# Check container status
docker-compose ps

# Test backend API
curl http://localhost:3002/health

# Test frontend
open http://localhost:3000
```

## Development Workflow

### Starting Development

1. **Start all services:**
   ```bash
   docker-compose up
   ```

2. **Backend development (with hot reload):**
   ```bash
   cd backend
   npm run dev
   ```

3. **Frontend development (with hot reload):**
   ```bash
   cd frontend
   npm run dev
   ```

### Database Operations

#### Running Migrations

```bash
cd backend
npm run migrate
```

#### Adding Sample Data

```bash
cd backend
npm run seed
```

#### Connecting to Database

```bash
# Using psql
psql postgresql://landlord_user:landlord_pass@localhost:5432/landlord_dashboard

# Or using Docker
docker-compose exec postgres psql -U landlord_user -d landlord_dashboard
```

### Testing

#### Backend Tests

```bash
cd backend
npm test
```

#### Frontend Linting

```bash
cd frontend
npm run lint
```

## Project Structure

### Backend Structure (`/backend/src/`)

```
backend/src/
├── db/                     # Database configuration and migrations
│   ├── connection.js       # Database connection setup
│   ├── migrate.js         # Migration runner
│   └── migrations/        # SQL migration files
├── routes/                # API endpoint definitions
│   ├── index.js          # Route aggregator
│   ├── sync.js           # Bank sync endpoints
│   ├── payments.js       # Payment request endpoints
│   ├── review.js         # Transaction review endpoints
│   └── gmail.js          # Gmail OAuth endpoints
├── services/             # Business logic services
│   ├── simplefinService.js      # Bank transaction fetching
│   ├── transactionClassifier.js # ETL rule processing
│   ├── paymentRequestService.js # Payment request creation
│   ├── gmailService.js          # Gmail integration
│   └── excelGenerator.js       # Tax report generation
├── scripts/              # Operational scripts
│   ├── daily/           # Daily sync operations
│   ├── maintenance/     # System maintenance
│   └── development/     # Development utilities
├── middleware/          # Express middleware
│   ├── errorHandler.js  # Global error handling
│   └── validation.js    # Request validation
└── server.js           # Express server entry point
```

### Frontend Structure (`/frontend/src/`)

```
frontend/src/
├── components/          # Reusable React components
│   ├── Layout.tsx      # Main application layout
│   └── GmailSettings.tsx # Gmail configuration UI
├── pages/              # Main application pages
│   ├── Dashboard.tsx   # Main dashboard view
│   ├── Review.tsx      # Transaction review page
│   ├── PaymentRequests.tsx # Payment request management
│   ├── Reports.tsx     # Tax reports and analytics
│   └── Settings.tsx    # Application settings
├── services/           # API client services
│   └── api.ts         # Axios-based API client
├── types/             # TypeScript type definitions
│   ├── api.ts         # API response types
│   └── index.ts       # General application types
├── constants/         # Application constants
│   └── categoryColors.ts # UI color schemes
└── theme.ts           # Material-UI theme configuration
```

### Key Database Tables

- `transactions` - Unified table for all financial transactions (expenses + income)
- `payment_requests` - Roommate payment tracking with Venmo integration
- `etl_rules` - Transaction categorization rules
- `venmo_emails` - Gmail-synced payment confirmations
- `utility_bills` - Utility bill tracking and splitting
- `maintenance_tickets` - Tenant maintenance requests

## Making Changes

### Adding New API Endpoints

1. **Create route handler:**
   ```javascript
   // backend/src/routes/newFeature.js
   const express = require('express');
   const router = express.Router();
   const db = require('../db/connection');

   router.get('/api/new-feature', async (req, res) => {
     try {
       const result = await db.query('SELECT * FROM some_table');
       res.json({ success: true, data: result.rows });
     } catch (error) {
       res.status(500).json({ success: false, error: error.message });
     }
   });

   module.exports = router;
   ```

2. **Register route in index.js:**
   ```javascript
   // backend/src/routes/index.js
   module.exports = {
     // ... existing routes
     newFeature: require('./newFeature'),
   };
   ```

3. **Add to server.js:**
   ```javascript
   // backend/src/server.js
   const routes = require('./routes');
   app.use(routes.newFeature);
   ```

### Creating Database Migrations

1. **Create migration file:**
   ```bash
   # File: backend/src/db/migrations/026_add_new_feature.sql
   ```

2. **Write migration SQL:**
   ```sql
   -- Add new table
   CREATE TABLE IF NOT EXISTS new_feature (
     id SERIAL PRIMARY KEY,
     name VARCHAR(255) NOT NULL,
     created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   -- Add indexes
   CREATE INDEX idx_new_feature_name ON new_feature(name);
   ```

3. **Run migration:**
   ```bash
   cd backend
   npm run migrate
   ```

### Adding ETL Rules

ETL rules automatically categorize bank transactions. Add them via the database:

```sql
INSERT INTO etl_rules (
  rule_name,
  match_field,
  match_value,
  category,
  priority,
  auto_approve
) VALUES (
  'Home Depot Purchases',
  'merchant_name',
  'HOME DEPOT',
  'supplies',
  100,
  true
);
```

**Priority levels:**
- `100+` - Auto-approve (high confidence)
- `50-99` - Manual review required
- `1-49` - Low confidence suggestions

### Testing Changes Locally

1. **Make your changes**
2. **Restart affected services:**
   ```bash
   # Backend only
   docker-compose restart backend

   # Frontend only  
   docker-compose restart frontend

   # All services
   docker-compose restart
   ```

3. **Test the changes:**
   ```bash
   # Test API endpoint
   curl http://localhost:3002/api/your-endpoint

   # Check frontend
   open http://localhost:3000
   ```

## Common Tasks

### Import Bank CSV Data

```bash
cd backend
node scripts/import-bofa-csv.js "/path/to/bank_export.csv"
```

### Run Daily Sync Manually

```bash
cd backend

# Daily sync (last 7 days)
node src/scripts/daily/full-sync.js daily 7

# Catch-up sync (last 90 days)
node src/scripts/daily/full-sync.js catch_up 90
```

### Process Pending Transactions

```bash
cd backend

# Process all pending transactions
node src/scripts/maintenance/process-pending-transactions.js

# Process specific transaction types
node src/scripts/maintenance/process-all-bills.js
```

### Create Payment Requests

```bash
cd backend

# Create payment requests for recent bills
node scripts/utilities/create-rent-payment-request.js
```

### Generate Tax Reports

```bash
cd backend

# Generate current year tax report
node test-tax-report.js

# Generate specific year
node test-tax-report.js 2024
```

### Check System Health

```bash
# Via API
curl http://localhost:3002/health

# Via script
cd backend
node src/scripts/maintenance/check-sync-status.js
```

### Reset Demo Data

```bash
cd backend

# Reset July-August data for demo
npm run demo:reset:confirm
```

## Code Conventions

### Database Naming

- **Tables**: `snake_case` (e.g., `payment_requests`, `utility_bills`)
- **Columns**: `snake_case` (e.g., `created_at`, `simplefin_transaction_id`)
- **Foreign Keys**: `{table}_id` (e.g., `payment_request_id`)

### API Response Format

All API responses should follow this structure:

```javascript
// Success response
{
  success: true,
  data: { /* response data */ },
  message: "Optional success message"
}

// Error response
{
  success: false,
  error: "Error description",
  details: { /* optional error details */ }
}
```

### Error Handling Pattern

```javascript
// Route handlers
router.get('/api/example', async (req, res) => {
  try {
    const result = await someAsyncOperation();
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error in /api/example:', error);
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});
```

### Async/Await Usage

- **Prefer async/await over Promises**
- **Always use try/catch blocks**
- **Handle errors appropriately**

```javascript
// Good
async function fetchTransactions() {
  try {
    const result = await db.query('SELECT * FROM transactions');
    return result.rows;
  } catch (error) {
    console.error('Database query failed:', error);
    throw new Error('Failed to fetch transactions');
  }
}

// Avoid
function fetchTransactions() {
  return db.query('SELECT * FROM transactions')
    .then(result => result.rows)
    .catch(error => {
      console.error(error);
      throw error;
    });
}
```

### React Component Structure

```typescript
// TypeScript React component
import React, { useState, useEffect } from 'react';
import { Typography, Box } from '@mui/material';

interface ComponentProps {
  title: string;
  data?: any[];
}

const ExampleComponent: React.FC<ComponentProps> = ({ title, data = [] }) => {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Component logic
  }, []);

  return (
    <Box>
      <Typography variant="h4">{title}</Typography>
      {/* Component JSX */}
    </Box>
  );
};

export default ExampleComponent;
```

## Troubleshooting

### Common Issues

#### Database Connection Errors

```bash
# Check if PostgreSQL container is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Restart PostgreSQL
docker-compose restart postgres
```

#### Frontend Build Errors

```bash
# Clear node_modules and reinstall
cd frontend
rm -rf node_modules package-lock.json
npm install

# Check for TypeScript errors
npm run build
```

#### Backend API Errors

```bash
# Check backend logs
docker-compose logs backend

# Restart backend with fresh install
docker-compose down backend
docker-compose up --build backend
```

#### SimpleFIN Sync Issues

```bash
# Test SimpleFIN connection
cd backend
node src/scripts/development/test-simplefin-connection.js

# Check sync status
node src/scripts/maintenance/check-sync-status.js
```

### Environment Issues

#### Port Conflicts

If ports 3000, 3002, or 5432 are already in use:

```bash
# Check what's using the port
lsof -i :3000
lsof -i :3002
lsof -i :5432

# Kill processes if needed
kill -9 [PID]
```

#### Docker Issues

```bash
# Clean up Docker resources
docker-compose down
docker system prune -f

# Rebuild from scratch
docker-compose up --build --force-recreate
```

### Getting Help

1. **Check the logs first:**
   ```bash
   docker-compose logs [service-name]
   ```

2. **Review recent changes:**
   ```bash
   git log --oneline -10
   ```

3. **Check system health:**
   ```bash
   curl http://localhost:3002/health
   ```

4. **Consult existing documentation:**
   - `CLAUDE.md` - Project instructions
   - `ARCHITECTURE.md` - System architecture
   - `DATA-FLOW.md` - Data flow diagrams

---

## Next Steps

Once you have the system running locally:

1. **Explore the codebase** - Start with the main dashboard at http://localhost:3000
2. **Review existing data** - Check the Review page to see transaction processing
3. **Test integrations** - Try importing a CSV file or running a sync
4. **Read the architecture docs** - Understand the data flow and system design
5. **Make a small change** - Try adding a new API endpoint or UI component

For more detailed information about specific subsystems, refer to the other documentation files in this directory.