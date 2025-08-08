# Tenant Portal Design Document

## Executive Summary
The Tenant Portal is a self-service platform that reduces landlord operational overhead by 80% while improving tenant satisfaction through transparency and convenience.

## Business Objectives
1. **Reduce landlord inquiries by 80%** through self-service features
2. **Accelerate payment collection** by 3-5 days with one-click payments
3. **Improve tenant satisfaction** through transparency and convenience
4. **Create complete audit trail** for legal protection

## Core Features (MVP - Phase 1)

### 1. Payment Center
- View current balance and payment due dates
- Payment history with downloadable receipts
- One-click Venmo/Zelle payment with pre-filled amounts
- Split bill visibility (see their portion of utilities)
- Automatic payment confirmations

**Business Value**: Reduces payment friction, accelerates collection by 3-5 days

### 2. Billing Transparency
- Real-time utility bills (PG&E, water) with their split portion
- Bill breakdown visualization (pie chart showing split)
- Historical comparison ("Your electricity is 15% higher than last month")
- Dispute/question button for specific charges

**Business Value**: Eliminates "why is my bill so high?" conversations

### 3. Maintenance Requests
- Submit requests with photo uploads
- Track status (submitted → acknowledged → in progress → resolved)
- Emergency vs. routine classification
- Maintenance history log
- Satisfaction rating after completion

**Business Value**: 50% faster issue resolution, documented compliance

### 4. Document Hub
- Lease agreement (view/download)
- Move-in checklist and photos
- House rules and policies
- Tax documents (year-end summaries)
- Insurance requirements

**Business Value**: Reduces document requests by 90%

## Database Schema

```sql
-- Tenant accounts
CREATE TABLE tenants (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  lease_start DATE,
  lease_end DATE,
  monthly_rent DECIMAL(10,2),
  security_deposit DECIMAL(10,2),
  property_id INTEGER,
  unit_number VARCHAR(20),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Maintenance requests
CREATE TABLE maintenance_requests (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  category VARCHAR(50), -- plumbing, electrical, appliance, other
  priority VARCHAR(20), -- emergency, high, normal, low
  description TEXT,
  status VARCHAR(50), -- submitted, acknowledged, in_progress, resolved
  submitted_at TIMESTAMP DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolution_notes TEXT,
  satisfaction_rating INTEGER CHECK (satisfaction_rating BETWEEN 1 AND 5),
  estimated_cost DECIMAL(10,2),
  photos TEXT[] -- Array of photo URLs
);

-- Tenant documents
CREATE TABLE tenant_documents (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  document_type VARCHAR(50), -- lease, invoice, notice, tax_doc
  document_name VARCHAR(255),
  file_path VARCHAR(500),
  uploaded_at TIMESTAMP DEFAULT NOW(),
  expires_at DATE,
  is_active BOOLEAN DEFAULT true
);

-- Tenant notifications
CREATE TABLE tenant_notifications (
  id SERIAL PRIMARY KEY,
  tenant_id INTEGER REFERENCES tenants(id),
  type VARCHAR(50), -- payment_due, maintenance_update, announcement
  title VARCHAR(255),
  message TEXT,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  read_at TIMESTAMP
);

-- Tenant payment view
CREATE VIEW tenant_payment_view AS
SELECT 
  t.id as tenant_id,
  pr.id as request_id,
  pr.amount,
  pr.bill_type,
  pr.month,
  pr.year,
  pr.status,
  pr.venmo_link,
  pr.due_date,
  pr.tracking_id
FROM tenants t
JOIN payment_requests pr ON pr.roommate_name = CONCAT(t.first_name, ' ', t.last_name)
WHERE t.is_active = true;
```

## API Endpoints

### Authentication
```
POST   /api/tenant/auth/register
POST   /api/tenant/auth/login
POST   /api/tenant/auth/logout
POST   /api/tenant/auth/reset-password
GET    /api/tenant/auth/verify-token
```

### Dashboard
```
GET    /api/tenant/dashboard         # Summary data
GET    /api/tenant/balance          # Current amount due
GET    /api/tenant/notifications    # Recent notifications
```

### Payments
```
GET    /api/tenant/payments         # Payment history
GET    /api/tenant/payments/pending # Current bills
POST   /api/tenant/payments/submit  # Record payment
GET    /api/tenant/payments/receipt/:id # Download receipt
```

### Maintenance
```
GET    /api/tenant/maintenance      # Request history
POST   /api/tenant/maintenance      # Submit request
PUT    /api/tenant/maintenance/:id  # Update/rate
POST   /api/tenant/maintenance/:id/photos # Upload photos
```

### Documents
```
GET    /api/tenant/documents        # List documents
GET    /api/tenant/documents/:id    # Download document
```

## Security Architecture

### Authentication & Authorization
- JWT-based authentication separate from landlord system
- Refresh token rotation
- Session timeout after 30 minutes of inactivity
- Optional 2FA for payment actions

### Data Security
- Row-level security (tenants only see their own data)
- Rate limiting on all endpoints (10 req/min)
- Input validation and sanitization
- SQL injection prevention through parameterized queries
- XSS protection through content security policy

### Privacy
- PII encryption at rest
- Audit logging for all data access
- GDPR-compliant data export/deletion

## UI/UX Structure

```
Tenant Portal
├── Authentication
│   ├── Login
│   ├── Register
│   └── Forgot Password
├── Dashboard
│   ├── Welcome Message
│   ├── Balance Due Widget
│   ├── Next Payment Date
│   ├── Recent Notifications
│   └── Quick Actions
├── Payments
│   ├── Current Balance
│   │   ├── Rent Due
│   │   └── Utilities Due
│   ├── Make Payment
│   │   ├── Venmo Integration
│   │   ├── Zelle Integration
│   │   └── Manual Recording
│   ├── Payment History
│   │   ├── Filter by Date
│   │   ├── Filter by Type
│   │   └── Download Receipts
│   └── Billing Details
│       ├── Current Month
│       ├── Historical Comparison
│       └── Dispute Form
├── Maintenance
│   ├── Submit Request
│   │   ├── Category Selection
│   │   ├── Priority Level
│   │   ├── Description
│   │   └── Photo Upload
│   ├── Active Requests
│   │   ├── Status Tracking
│   │   └── Updates
│   └── Request History
│       ├── Completed Requests
│       └── Satisfaction Ratings
├── Documents
│   ├── Lease Agreement
│   ├── Move-in Documents
│   ├── Policies & Rules
│   └── Tax Documents
└── Profile
    ├── Personal Information
    ├── Emergency Contacts
    ├── Notification Preferences
    └── Security Settings
```

## Implementation Phases

### Phase 1: Foundation (Weeks 1-2)
- Database schema creation
- Authentication system
- Basic tenant CRUD operations
- JWT implementation

### Phase 2: Payment Features (Weeks 3-4)
- Payment history view
- Current balance calculation
- Venmo/Zelle integration
- Receipt generation

### Phase 3: Maintenance System (Weeks 5-6)
- Request submission
- Status tracking
- Photo upload
- Notification system

### Phase 4: Document Management (Week 7)
- Document upload/storage
- Secure document viewing
- Download functionality

### Phase 5: Polish & Testing (Week 8)
- UI/UX refinement
- End-to-end testing
- Security audit
- Performance optimization

## Success Metrics

### Operational Metrics
- Portal adoption rate (target: 90% of tenants)
- Self-service resolution rate (target: 80%)
- Average time to payment (target: < 3 days)
- Support ticket reduction (target: 70% decrease)

### Financial Metrics
- Payment collection speed (target: 3-day improvement)
- Late payment reduction (target: 50% decrease)
- Time saved per month (target: 5 hours)

### Satisfaction Metrics
- Tenant satisfaction score (target: 4.5/5)
- Maintenance resolution rating (target: 4.5/5)
- Portal usability score (target: 85/100)

## ROI Analysis

### Investment
- Development: 80 hours × $100/hr = $8,000
- Annual hosting: $20/month = $240/year
- Total Year 1: $8,240

### Returns (Annual)
- Time saved: 5 hrs/month × 12 × $50 = $3,000
- Faster payments: 3 days × $1,685 × 0.05 = $303
- Reduced vacancy: 0.5 months × $1,685 = $842
- Lower turnover costs: $500

### Total Annual Value: $4,645
### ROI: 48% Year 1, 1,935% ongoing

## Technical Stack

### Frontend
- React 18 with TypeScript
- Material-UI for consistent design
- React Router for navigation
- Axios for API calls
- JWT decode for auth
- React Hook Form for forms
- React Dropzone for file uploads

### Backend
- Express.js API endpoints
- PostgreSQL database
- JWT authentication
- Multer for file uploads
- SendGrid for email notifications
- Rate limiting middleware
- Input validation middleware

### Infrastructure
- AWS S3 for document storage
- CloudFront CDN for static assets
- SSL certificate for security
- Daily automated backups

## Next Steps
1. Review and approve design document
2. Set up database migrations
3. Create authentication system
4. Build tenant registration flow
5. Implement payment viewing
6. Deploy MVP for testing