# 🏠 Landlord Dashboard

A comprehensive rental property management system for automated financial tracking, payment collection, and tax reporting.

## 🚀 Quick Start

```bash
# Clone the repository
git clone https://github.com/AndrewTing89/Landlord-Dashboard.git
cd Landlord-Dashboard

# Start all services with Docker
docker-compose up -d

# Access the application
# Frontend: http://localhost:3000
# Backend API: http://localhost:3002
```

## 📋 Overview

The Landlord Dashboard automates rental property management by:
- **Syncing bank transactions** automatically via SimpleFIN
- **Splitting utility bills** among roommates (3-way split)
- **Generating Venmo payment links** with tracking
- **Monitoring payments** via Gmail integration
- **Producing tax reports** compliant with IRS Schedule E

## 🏗️ Architecture

```
┌─────────────┐     ┌─────────────┐     ┌──────────────┐
│   Frontend  │────▶│  Backend API │────▶│  PostgreSQL  │
│   (React)   │     │  (Node.js)   │     │   Database   │
│  Port 3000  │     │  Port 3002   │     │  Port 5433   │
└─────────────┘     └──────┬───────┘     └──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Integrations │
                    ├──────────────┤
                    │ • SimpleFIN   │
                    │ • Gmail OAuth │
                    │ • Discord     │
                    └──────────────┘
```

## 📚 Documentation

Comprehensive documentation is available in the `/documentation` folder:

- **[ARCHITECTURE.md](documentation/ARCHITECTURE.md)** - System design and components
- **[DATA-FLOW.md](documentation/DATA-FLOW.md)** - How money and data move through the system
- **[DEVELOPER-GUIDE.md](documentation/DEVELOPER-GUIDE.md)** - Setup and development workflow
- **[OPERATIONS.md](documentation/OPERATIONS.md)** - Daily operations and procedures
- **[TROUBLESHOOTING.md](documentation/TROUBLESHOOTING.md)** - Common issues and solutions

## 💼 Key Features

### Financial Tracking
- **Automated bank sync** - Daily transaction imports from Bank of America via SimpleFIN
- **Smart categorization** - ETL rules auto-categorize expenses per IRS Schedule E
- **Income attribution** - Tracks income in the correct accounting period (bill month, not payment month)

### Payment Management
- **Utility bill splitting** - Automatically splits electricity/water bills 3 ways
- **Venmo integration** - Generates payment request links with tracking IDs
- **Payment monitoring** - Gmail API tracks Venmo payment confirmations
- **Rent collection** - Monthly rent payment requests ($1,685/month)

### Tax Reporting
- **IRS Schedule E compliance** - Proper expense categorization
- **Annual tax reports** - 5-sheet Excel workbook with complete documentation
- **Audit trail** - Complete transaction history with source documentation

## 🛠️ Technology Stack

### Backend
- **Node.js & Express** - REST API server
- **PostgreSQL** - Primary database
- **Docker** - Container orchestration
- **SimpleFIN** - Bank account aggregation
- **Gmail API** - Email monitoring
- **Discord Webhooks** - Notifications

### Frontend
- **React 18** - UI framework
- **Material-UI** - Component library
- **TypeScript** - Type safety
- **React Router** - Navigation

## 📁 Project Structure

```
landlord-dashboard/
├── backend/
│   ├── src/
│   │   ├── routes/        # API endpoints
│   │   ├── services/      # Business logic
│   │   ├── scripts/       # Operational scripts
│   │   └── db/           # Database schemas
│   └── scripts/          # Utility scripts
├── frontend/
│   └── src/
│       ├── pages/        # React pages
│       └── components/   # UI components
└── documentation/        # Comprehensive docs
```

## 🔧 Configuration

### Required Environment Variables

Create a `.env` file in the backend directory:

```env
# Database
DATABASE_URL=postgresql://user:pass@localhost:5433/landlord_dashboard

# SimpleFIN
SIMPLEFIN_TOKEN=your_token_here

# Discord Webhooks
DISCORD_WEBHOOK_PAYMENT=https://discord.com/api/webhooks/...

# Gmail OAuth
GMAIL_CLIENT_ID=your_client_id
GMAIL_CLIENT_SECRET=your_client_secret
```

## 🚦 Daily Operations

### Running Daily Sync
```bash
cd backend
node src/scripts/daily/full-sync.js
```

### Processing Transactions
```bash
# Import Bank of America CSV
node scripts/import/import-bofa-csv.js "/path/to/statement.csv"

# Process pending transactions
node scripts/run-etl-processing.js
```

### Managing Payments
```bash
# Create rent payment requests
node scripts/utilities/create-rent-payment-request.js

# Catch up on missing utility bills
node src/scripts/catch-up-utility-bills.js
```

## 📊 Database Schema

The system uses a unified transaction model with these key tables:

- **expenses** - All property expenses categorized per IRS Schedule E
- **income** - Rental income and utility reimbursements
- **payment_requests** - Tracks payment requests to roommates
- **raw_transactions** - Unprocessed bank transactions
- **venmo_emails** - Payment confirmations from Gmail
- **etl_rules** - Transaction categorization rules

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 License

This project is proprietary software. All rights reserved.

## 👥 Roommate Configuration

The system currently manages payments for:
- **Ushi** - 1/3 split on utilities
- **Eileen** - 1/3 split on utilities  
- **Landlord** - 1/3 split (owner's portion)

## 🔒 Security Features

- Environment-based configuration
- SQL injection prevention
- OAuth 2.0 for Gmail integration
- Parameterized database queries

## 📞 Support

For issues or questions:
- Check the [TROUBLESHOOTING.md](documentation/TROUBLESHOOTING.md) guide
- Review existing [GitHub Issues](https://github.com/AndrewTing89/Landlord-Dashboard/issues)
- Create a new issue with detailed information

## 🎯 Roadmap

- [ ] Mobile app for tenants
- [ ] Multi-property support
- [ ] Automated lease management
- [ ] Maintenance request system integration
- [ ] Advanced analytics dashboard

---

Built with ❤️ for efficient rental property management