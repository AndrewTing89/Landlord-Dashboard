# Landlord Dashboard

An automated expense tracking and bill management system for landlords, built with AWS services.

## Features

- 🏦 **Automatic Bank Sync**: Connect to Bank of America via Plaid to automatically import transactions
- 📊 **Smart Classification**: Automatically categorize expenses (utilities, maintenance, rent income)
- 💰 **Bill Splitting**: Split utility bills and generate Venmo payment links for roommates
- 📈 **Tax Reports**: Generate Excel reports for tax deductions and expense tracking
- 🤖 **Automation**: Monthly automated sync and bill processing on the 5th of each month
- ☁️ **AWS Hosted**: Scalable architecture using Lambda, RDS PostgreSQL, and S3

## Architecture

```
┌─────────────────┐     ┌──────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  API Gateway  │────▶│ Lambda Functions│
└─────────────────┘     └──────────────┘     └─────────────────┘
                                                       │
                                ┌──────────────────────┼──────────────────┐
                                │                      │                  │
                           ┌────▼─────┐        ┌───────▼──────┐   ┌──────▼─────┐
                           │   RDS    │        │   Plaid API  │   │     S3     │
                           │PostgreSQL│        └──────────────┘   │  Storage   │
                           └──────────┘                           └────────────┘
```

## Local Development Setup

### Prerequisites

- Node.js 18+
- Docker & Docker Compose
- AWS CLI (optional)

### Quick Start

1. **Clone and install dependencies**:
```bash
cd "Landlord Dashboard"
npm install
```

2. **Set up environment variables**:
```bash
cp .env.example .env
# Edit .env with your Plaid credentials
```

3. **Start the development environment**:
```bash
# Start Docker containers (PostgreSQL & LocalStack)
npm run docker:up

# Run database migrations
npm run db:migrate

# Start the backend server
npm run dev:backend

# In another terminal, run the test setup
cd backend
node src/test-setup.js
```

4. **Access the application**:
- Backend API: http://localhost:3001
- Health check: http://localhost:3001/health

## API Endpoints

### Plaid Integration
- `POST /api/plaid/create-link-token` - Create Plaid Link token
- `POST /api/plaid/exchange-public-token` - Exchange public token for access token

### Lambda Functions (Local Testing)
- `POST /api/lambda/plaid-sync` - Sync transactions from bank
- `POST /api/lambda/process-bills` - Process utility bills and create payment requests
- `POST /api/lambda/generate-report` - Generate Excel reports

### Dashboard APIs
- `GET /api/transactions` - Get transactions with filters
- `GET /api/summary` - Get expense summary
- `GET /api/payment-requests` - Get payment requests

## Testing

### Manual Lambda Testing

```bash
# Sync transactions
curl -X POST http://localhost:3001/api/lambda/plaid-sync

# Process bills for previous month
curl -X POST http://localhost:3001/api/lambda/process-bills \
  -H "Content-Type: application/json"

# Generate monthly report
curl -X POST http://localhost:3001/api/lambda/generate-report \
  -H "Content-Type: application/json" \
  -d '{
    "reportType": "monthly",
    "year": 2024,
    "month": 1
  }'
```

## Deployment to AWS

### Required AWS Services
- Lambda (for functions)
- RDS PostgreSQL (t3.micro)
- S3 (for file storage)
- API Gateway
- EventBridge (for scheduling)
- Secrets Manager (for credentials)

### Deployment Steps
1. Create AWS resources using Terraform/CDK (coming soon)
2. Deploy Lambda functions
3. Configure EventBridge rules
4. Set up API Gateway
5. Deploy React frontend to S3/CloudFront

## Configuration

### Environment Variables
- `DB_*` - PostgreSQL connection settings
- `PLAID_*` - Plaid API credentials
- `AWS_*` - AWS service configuration
- `ROOMMATE_*` - Roommate information for bill splitting

### Expense Categories
Default categories are configured in the database:
- **Electricity**: PGE, PG&E, PACIFIC GAS
- **Water**: WATER, EBMUD
- **Maintenance**: HOME DEPOT, LOWES, ACE HARDWARE
- **Rent**: Income from tenants
- **Other**: Everything else

## Monthly Automation

On the 5th of each month at 9 AM:
1. Sync new transactions from Plaid
2. Classify and store transactions
3. Process utility bills from previous month
4. Generate Venmo payment requests
5. Create monthly report
6. Send notification email

## Security

- Plaid credentials stored in AWS Secrets Manager
- Database connections use SSL
- S3 buckets are private with presigned URLs
- IAM roles follow least privilege principle

## Troubleshooting

### Docker Issues
```bash
# View logs
npm run docker:logs

# Restart containers
npm run docker:down
npm run docker:up
```

### Database Connection
- Ensure PostgreSQL is running: `docker ps`
- Check credentials in `.env`
- Verify database exists: `psql -h localhost -U landlord_user -d landlord_dashboard`

### Plaid Connection
- Verify you're using sandbox credentials
- Check Plaid dashboard for API status
- Use Development mode for real bank connections

## License

Private project - All rights reserved