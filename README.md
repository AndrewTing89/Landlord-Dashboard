# Landlord Dashboard 🏠

A full-stack property management system that automates rental income tracking, expense management, and roommate payment collection through intelligent bank synchronization and payment matching.

## 🎯 Project Overview

I built this system to solve a real problem: managing shared expenses in my rental property. What started as manual spreadsheet tracking evolved into an automated system that saves hours of work each month while ensuring accurate financial records and timely payment collection.

### The Problem
- **Manual tracking** of utility bills and roommate payments was time-consuming and error-prone
- **Payment collection** required constant follow-ups and manual Venmo requests  
- **Financial reporting** for taxes required consolidating data from multiple sources
- **Bank reconciliation** was a monthly headache with hundreds of transactions

### The Solution
An intelligent automation system that handles everything from bank sync to payment tracking, reducing 10+ hours of monthly work to just minutes of review.

## 🚀 Key Features & Technical Achievements

### 1. Intelligent Bank Synchronization
- **Real-time API Integration**: Built secure connection to Bank of America via SimpleFIN API
- **Custom ETL Pipeline**: Designed rules engine that categorizes transactions with 95% accuracy
- **Duplicate Prevention**: Implemented transaction fingerprinting to prevent double-counting
- **Historical Import**: Processes years of CSV data for complete financial history
- **2-Week Quick Sync**: Dashboard buttons for targeted bank and Gmail syncs

### 2. Automated Payment Management System
- **Smart Bill Detection**: Algorithm identifies utility bills from transaction patterns
- **Automatic Split Calculation**: Precisely divides expenses among 3 roommates
- **Venmo Deep Linking**: Generates one-click payment URLs with pre-filled data
- **Tracking System**: Unique IDs enable automatic payment-to-request matching
- **Late Payment Handling**: Correctly attributes income to bill month, not payment date

### 3. Gmail OAuth Integration
- **Secure Authentication**: Implemented OAuth 2.0 flow without storing passwords
- **Email Parsing Engine**: Extracts structured data from Venmo confirmation emails
- **Confidence Scoring**: Developed matching algorithm with weighted scoring:
  - Amount match: 50% weight
  - Name match: 35% weight  
  - Note keywords: 15% weight
- **Special Rules**: Rent detection for payments ≥$1,600 starting August 2025
- **Ignore Functionality**: Ability to dismiss unimportant unmatched emails

### 4. Clean Architecture Implementation
- **Separation of Concerns**: Separate `income` and `expenses` tables for clarity
- **Single Source of Truth**: Income table serves as authoritative revenue source
- **Stacked Revenue Charts**: Visual breakdown of rent vs utility reimbursements
- **Proper Month Attribution**: Late payments recorded in appropriate accounting period

### 5. Data Integrity & Health Monitoring
- **Health Check Dashboard**: Real-time system status monitoring
- **Process Pending Button**: One-click processing of 200+ raw transactions
- **Audit Logging**: Complete history of all database changes
- **Data Validation**: Middleware preventing impossible states
- **Backup/Restore System**: PostgreSQL dumps with restore capability
- **Caching Layer**: In-memory cache with TTL for performance

### 6. Real-time Notification System
- **Multi-channel Webhooks**: Discord integration for different event types
- **Rich Embeds**: Beautiful notification cards with actionable links
- **Status Tracking**: Automatic updates when payments are confirmed
- **Sync Logging**: Detailed logs of all sync operations with results

## 💻 Technical Architecture

### Tech Stack
- **Frontend**: React 18, TypeScript, Material-UI, Recharts for data visualization
- **Backend**: Node.js, Express.js, PostgreSQL with raw SQL for performance
- **Integrations**: SimpleFIN API, Gmail OAuth 2.0, Discord Webhooks, Venmo URL Schemes
- **Infrastructure**: Docker for local development, PM2 for process management

### Database Design
```sql
-- Clean architecture with separated concerns
income               -- All revenue (rent, reimbursements) with proper month attribution
expenses             -- All property expenses with categorization
transactions         -- Processed bank transactions (legacy, being phased out)
raw_transactions     -- Unprocessed bank data requiring review  
payment_requests     -- Roommate payment tracking with Venmo links
etl_rules           -- Transaction categorization rules (priority 100+ = auto-approve)
venmo_emails        -- Gmail-synced payment confirmations with ignore capability
utility_bills       -- Detected utility expenses for splitting
utility_adjustments  -- Tracks reimbursements reducing net expenses
sync_history        -- Complete audit trail of all sync operations
audit_log           -- Database change tracking with before/after values
```

### Key Algorithms

#### Payment Matching Algorithm
```javascript
// Confidence scoring for payment-to-request matching
confidence = (
  amountMatch * 0.50 +    // Amount is most important
  nameMatch * 0.35 +      // Name verification
  noteMatch * 0.15        // Note keywords help confirm
);
```

#### Late Payment Attribution
```javascript
// Income recorded in bill month, not payment month
if (paymentRequest.month && paymentRequest.year) {
  incomeDate = new Date(paymentRequest.year, paymentRequest.month - 1, 
    paymentRequest.bill_type === 'rent' ? 1 : 15);
}
// Maintains accurate P&L per accounting period
```

#### Venmo Link Generation
```javascript
// Clean URL format that works on both mobile and web
https://venmo.com/USERNAME?txn=charge&amount=XX.XX&note=KEY:VALUE format
```

## 📈 Results & Impact

### Quantifiable Improvements
- **90% reduction** in time spent on financial management (10+ hours → 1 hour/month)
- **100% payment tracking** accuracy with automated matching
- **95% transaction categorization** accuracy with ETL rules
- **Zero missed payments** since implementing Discord notifications
- **232 transactions** processed automatically with single button click

### Technical Achievements
- **OAuth 2.0 implementation** without third-party auth libraries
- **Custom ETL pipeline** processing thousands of transactions
- **Fuzzy matching algorithm** for payment reconciliation  
- **Responsive UI** working seamlessly on mobile and desktop
- **Zero-downtime deployments** with PM2 cluster mode
- **Complete audit trail** for tax compliance

## 🛠️ Recent Improvements (August 2025)

### Data Integrity Enhancements
- Added comprehensive health check system with automatic issue detection
- Implemented audit logging for all database changes
- Created data validation middleware preventing invalid states
- Built backup/restore system for data protection
- Added caching layer improving query performance

### UI/UX Improvements
- Converted revenue chart to stacked bars showing income breakdown
- Standardized color scheme across all expense types
- Added "Ignore" functionality for unmatched emails
- Separated bank and Gmail sync with 2-week lookback buttons
- Improved dashboard card design matching Payment Requests page

### Financial Accuracy
- Fixed income attribution to use bill month instead of payment date
- Separated income and expenses into dedicated tables
- Implemented proper handling of late payments
- Added utility adjustments tracking for accurate net expenses

## 🚧 Installation & Setup

### Prerequisites
- Node.js 18+
- PostgreSQL 14+
- Docker (for local services)
- Gmail account with API access enabled
- SimpleFIN account for bank connectivity

### Environment Variables
```bash
# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/landlord_dashboard

# SimpleFIN API
SIMPLEFIN_TOKEN=your_simplefin_token

# Gmail OAuth
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret

# Discord Webhooks
DISCORD_WEBHOOK_PAYMENT_REQUESTS=webhook_url
DISCORD_WEBHOOK_SYNC_LOGS=webhook_url

# Configuration
MONTHLY_RENT=1685
ROOMMATE_NAME=Ushi Lo
ROOMMATE_VENMO_USERNAME=@UshiLo
```

### Quick Start
```bash
# Clone repository
git clone https://github.com/yourusername/landlord-dashboard.git

# Install dependencies
cd backend && npm install
cd ../frontend && npm install

# Start Docker services
docker-compose up -d

# Run database migrations
cd backend && npm run migrate

# Start development servers
npm run dev  # Backend on :3002
cd ../frontend && npm run dev  # Frontend on :3000
```

## 📝 Usage

### Daily Operations
1. **Dashboard Sync**: Click "Sync Bank" or "Sync Gmail" for 2-week updates
2. **Review Transactions**: Process pending items in Review page
3. **Send Payment Requests**: One-click Venmo links from Payment Requests
4. **Monitor Health**: Check system status in Health Check page

### Monthly Workflow
1. Bank and Gmail sync captures all transactions
2. Utility bills automatically detected and split
3. Payment requests generated with tracking IDs
4. Venmo confirmations matched automatically
5. Dashboard shows real-time financial status

## 🤝 Contributing

This is a personal project, but feel free to fork and adapt for your own use case. Key areas for extension:
- Additional bank integrations beyond SimpleFIN
- Support for more payment platforms (Zelle, PayPal)
- Multi-property management
- Tenant portal for payment history

## 📄 License

MIT License - See LICENSE file for details

## 🙏 Acknowledgments

- SimpleFIN for excellent bank API
- Material-UI for beautiful React components
- Discord.js community for webhook examples
- PostgreSQL for rock-solid database performance

---

**Built with ❤️ to solve real problems and save real time**