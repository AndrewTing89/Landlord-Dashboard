# Landlord Dashboard System Architecture

**Last Updated:** September 21, 2025 8:45 AM UTC

## System Overview

The Landlord Dashboard is a comprehensive rental property management system that automates financial tracking, payment collection, maintenance requests, and tax reporting. The system consists of multiple interconnected components working together to provide a complete solution for rental property management.

## High-Level Architecture Diagram

```
                                    ┌─────────────────────────────────────────────────┐
                                    │              EXTERNAL SERVICES                  │
                                    │                                                 │
                                    │  ┌─────────────┐  ┌─────────────┐ ┌──────────┐ │
                                    │  │ SimpleFIN   │  │ Gmail API   │ │ Discord  │ │
                                    │  │ (Bank Sync) │  │ (Venmo      │ │ (Alerts) │ │
                                    │  │             │  │  Tracking)  │ │          │ │
                                    │  └─────────────┘  └─────────────┘ └──────────┘ │
                                    └─────────────────────────────────────────────────┘
                                                            │
                                                            │ HTTPS/API
                                                            ▼
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                                DOCKER NETWORK                                       │
│                                                                                     │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐              │
│  │   FRONTEND      │     │   TENANT        │     │    BACKEND      │              │
│  │   (Port 3000)   │     │   PORTAL        │     │   (Port 3002)   │              │
│  │                 │     │   (Port 3003)   │     │                 │              │
│  │ React 18        │     │ React 18        │     │ Node.js/Express │              │
│  │ TypeScript      │◄────┤ TypeScript      │────►│                 │              │
│  │ Material-UI     │     │ Material-UI     │     │ REST API        │              │
│  │ Vite            │     │ Vite            │     │ JWT Auth        │              │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘              │
│                                                            │                       │
│                                                            │ PostgreSQL           │
│                                                            ▼                       │
│  ┌─────────────────────────────────────────────────────────────────────────────┐  │
│  │                    POSTGRESQL DATABASE                                      │  │
│  │                         (Port 5432)                                        │  │
│  │                                                                             │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │transactions │ │payment_     │ │venmo_emails │ │maintenance_tickets  │  │  │
│  │  │   (unified) │ │requests     │ │             │ │                     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  │                                                                             │  │
│  │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────┐  │  │
│  │  │utility_     │ │etl_rules    │ │sync_history │ │tenant_accounts      │  │  │
│  │  │bills        │ │             │ │             │ │                     │  │  │
│  │  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────────────┘  │  │
│  └─────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                     │
│  ┌─────────────────┐                                                               │
│  │   LOCALSTACK    │                                                               │
│  │   (Port 4566)   │                                                               │
│  │                 │                                                               │
│  │ S3 Storage      │                                                               │
│  │ (Tax Reports)   │                                                               │
│  └─────────────────┘                                                               │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

## Component Descriptions

### Frontend Components

#### 1. Landlord Dashboard (Port 3000)
- **Technology**: React 18 with TypeScript, Material-UI components
- **Purpose**: Primary interface for property owners and managers
- **Key Features**:
  - Financial dashboard with real-time transaction monitoring
  - Payment request management with Venmo integration
  - Transaction review and categorization interface
  - Tax report generation and download
  - Utility bill processing and split calculations
  - Health monitoring and system status
- **Pages**: Dashboard, Transactions, Review, PaymentRequests, Reports, Settings, Health
- **Build Tool**: Vite for fast development and optimized production builds

#### 2. Tenant Portal (Port 3003)
- **Technology**: React 18 with TypeScript, Material-UI components
- **Purpose**: Self-service interface for tenants
- **Key Features**:
  - Maintenance request submission and tracking
  - Payment history viewing
  - Property information access
  - Secure authentication with JWT tokens
- **Pages**: Dashboard, Maintenance, Login
- **Authentication**: JWT-based tenant authentication system

### Backend API (Port 3002)

#### Core Server
- **Technology**: Node.js with Express framework
- **Database**: PostgreSQL with connection pooling
- **Authentication**: JWT tokens for secure API access
- **Environment**: Dockerized with hot-reload in development

#### Route Categories

```javascript
// Main API endpoint categories
/api/sync          // SimpleFIN bank synchronization
/api/payments      // Payment request management
/api/review        // Transaction review and approval
/api/gmail         // Gmail OAuth and Venmo email tracking
/api/health        // System health monitoring
/api/ledger        // Financial reporting and calculations
/api/tenant/*      // Tenant portal APIs
```

#### Key Services

1. **SimpleFIN Service** (`/src/services/simplefinService.js`)
   - Automated bank transaction synchronization
   - Account balance monitoring
   - Transaction categorization and processing

2. **Email Monitor Service** (`/src/services/venmoEmailMonitorService.js`)
   - Gmail OAuth integration
   - Venmo payment confirmation tracking
   - Fuzzy matching for payment verification

3. **Transaction Classifier** (`/src/services/transactionClassifier.js`)
   - AI-powered expense categorization
   - ETL rule processing and learning
   - Confidence scoring for automated approvals

4. **Payment Request Service** (`/src/services/paymentRequestService.js`)
   - Utility bill splitting (3-way)
   - Venmo deep link generation
   - Payment status tracking and notifications

5. **Excel Generator** (`/src/services/excelGenerator.js`)
   - IRS Schedule E compliant tax reports
   - Multi-sheet Excel export with complete documentation
   - Year-over-year comparison reports

### Database Architecture

#### PostgreSQL Database (Port 5432)

The database uses a unified transaction model with the following key tables:

##### Core Financial Tables

**transactions** (Unified Table)
```sql
- id (PRIMARY KEY)
- amount (DECIMAL) -- Negative for expenses, positive for income
- date (DATE) -- Transaction date
- description (TEXT)
- transaction_type (VARCHAR) -- 'income' or 'expense'
- category (VARCHAR) -- 'rent', 'electricity', 'water', etc.
- source (VARCHAR) -- 'bank_sync', 'payment_request', 'manual'
- simplefin_transaction_id (VARCHAR) -- Bank sync reference
- payment_request_id (INTEGER) -- Links to payment requests
- tax_year (INTEGER) -- For tax reporting
```

**payment_requests**
```sql
- id (PRIMARY KEY)
- utility_bill_id (FOREIGN KEY)
- roommate_name (VARCHAR)
- amount (DECIMAL)
- status (VARCHAR) -- 'pending', 'sent', 'paid', 'foregone'
- venmo_link (TEXT) -- Deep link for payments
- tracking_id (VARCHAR) -- Format: YYYYMM{type}
```

**utility_bills**
```sql
- id (PRIMARY KEY)
- transaction_id (FOREIGN KEY)
- bill_type (VARCHAR) -- 'electricity', 'water', 'internet'
- total_amount (DECIMAL)
- split_amount (DECIMAL) -- Amount per person (÷3)
- month/year (INTEGER) -- Billing period
```

**venmo_emails**
```sql
- id (PRIMARY KEY)
- gmail_message_id (VARCHAR)
- payment_request_id (FOREIGN KEY)
- amount (DECIMAL)
- payer_name (VARCHAR)
- status (VARCHAR) -- 'matched', 'unmatched', 'ignored'
```

##### Supporting Tables

**etl_rules** - Transaction categorization rules
**sync_history** - Bank synchronization tracking
**maintenance_tickets** - Tenant maintenance requests
**tenant_accounts** - Tenant portal authentication
**audit_log** - Change tracking and compliance

### External Service Integrations

#### 1. SimpleFIN API
- **Purpose**: Automated bank transaction synchronization
- **Features**: 
  - Real-time transaction fetching
  - Account balance monitoring
  - Multi-bank support
- **Configuration**: Token-based authentication stored in environment variables

#### 2. Gmail OAuth API
- **Purpose**: Venmo payment confirmation tracking
- **Features**:
  - Email parsing and extraction
  - Fuzzy matching algorithms
  - Automatic payment status updates
- **Security**: OAuth 2.0 with refresh token management

#### 3. Discord Webhooks
- **Purpose**: Real-time notifications and alerts
- **Features**:
  - Payment confirmation notifications
  - System health alerts
  - Daily sync status reports

## Technology Stack

### Frontend Stack
```
React 18.2.0          # Component framework
TypeScript 5.3.3      # Type safety
Material-UI 5.15.3    # UI component library
Vite 5.0.11           # Build tool and dev server
React Router 6.21.1   # Client-side routing
Recharts 2.10.4       # Data visualization
Axios 1.6.5           # HTTP client
```

### Backend Stack
```
Node.js               # Runtime environment
Express 4.18.2        # Web framework
PostgreSQL 15         # Primary database
AWS SDK 2.1515.0      # Cloud services (via LocalStack)
JWT                   # Authentication tokens
Axios 1.11.0          # HTTP client for external APIs
ExcelJS 4.4.0         # Excel report generation
PDF-Parse 1.1.1       # PDF processing
Google APIs 154.1.0   # Gmail integration
```

### DevOps & Infrastructure
```
Docker & Docker Compose  # Containerization
LocalStack              # Local AWS services (S3)
PostgreSQL 15-Alpine    # Database container
Nginx                   # Reverse proxy (production)
PM2                     # Process management (production)
```

## Data Flow Architecture

### Transaction Processing Pipeline

1. **Bank Sync**: SimpleFIN API → `raw_transactions` table
2. **ETL Processing**: ETL rules → categorization → `transactions` table
3. **Bill Detection**: Utility transactions → `utility_bills` table
4. **Payment Requests**: Bills split 3-way → `payment_requests` with Venmo links
5. **Email Monitoring**: Gmail API → Venmo confirmations → payment status updates
6. **Income Recording**: Payments → `transactions` with proper month attribution

### Payment Request Flow

```
Utility Bill Detected → Split 3 Ways → Generate Venmo Links → Send Notifications
                                              ↓
Email Monitoring ← Payment Confirmation ← Tenant Payment via Venmo
                                              ↓
Update Payment Status → Record Income → Generate Tax Attribution
```

### Authentication Flow

```
User Login → JWT Token Generation → API Request Authentication → Database Access
                     ↓
            Token Refresh → Renewed Access → Continued Session
```

## Security Architecture

### Environment-Based Configuration
- Sensitive data stored in `.env` files
- Production secrets managed through environment variables
- No hardcoded credentials in source code

### Database Security
- Parameterized queries prevent SQL injection
- Connection pooling with secure connection strings
- Row-level security for tenant data isolation

### API Security
- CORS properly configured for cross-origin requests
- Rate limiting on API endpoints
- Input validation on all user inputs
- JWT tokens for stateless authentication

### External Service Security
- OAuth 2.0 for Gmail API access
- Token-based authentication for SimpleFIN
- Webhook validation for Discord notifications

## Development Workflow

### Local Development Setup
```bash
# Start all services
docker-compose up -d

# Backend development (with hot reload)
cd backend && npm run dev

# Frontend development
cd frontend && npm run dev

# Tenant portal development
cd tenant-frontend && npm run dev
```

### Database Management
```bash
# Run migrations
npm run migrate

# Seed development data
npm run seed

# Backup database
node src/services/backupService.js
```

### Testing Strategy
- Unit tests for business logic
- Integration tests for API endpoints
- End-to-end tests for critical user flows
- Manual testing for external service integrations

## Performance Optimizations

### Database Optimizations
- Indexes on all foreign keys and frequently queried columns
- Connection pooling to manage concurrent requests
- Query optimization for complex financial calculations

### Application Optimizations
- In-memory caching with TTL for frequently accessed data
- Batch processing for bulk operations
- Lazy loading for large data sets

### Frontend Optimizations
- Code splitting for faster initial load times
- Material-UI tree shaking to reduce bundle size
- React.memo for expensive component renders

## Monitoring and Health Checks

### Health Monitoring System
- Real-time status dashboard at `/health` endpoint
- Database connection monitoring
- External service availability checks
- Process monitoring with automatic issue detection

### Logging and Auditing
- Comprehensive audit log for all financial transactions
- Error logging with stack traces
- Performance monitoring for slow queries
- User action tracking for compliance

## Deployment Architecture

### Docker Containerization
- **landlord-frontend**: Nginx-served React build
- **landlord-backend**: Node.js API server
- **landlord-postgres**: PostgreSQL database with persistent volumes
- **localstack**: Local AWS services for development

### Production Considerations
- Load balancing with Nginx reverse proxy
- SSL/TLS termination
- Database backups and point-in-time recovery
- Log aggregation and monitoring
- Auto-scaling based on demand

This architecture provides a robust, scalable foundation for comprehensive rental property management while maintaining security, performance, and ease of development.