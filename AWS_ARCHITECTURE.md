# AWS Serverless Architecture Plan

## 🏗️ Big Picture: Local → AWS Serverless

### Current Local Architecture (Mirrors AWS)
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  Express Server │────▶│ Lambda Handlers │
│   (localhost)   │     │   (API Proxy)   │     │  (Node.js fns)  │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                        ┌────────────────────────────────┼─────────────────┐
                        │                                │                 │
                   ┌────▼────┐                    ┌──────▼──────┐   ┌─────▼─────┐
                   │ Docker  │                    │   Plaid     │   │ LocalStack│
                   │PostgreSQL│                    │   Sandbox   │   │    (S3)   │
                   └─────────┘                    └─────────────┘   └───────────┘
```

### Target AWS Serverless Architecture
```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│  React Frontend │────▶│  API Gateway    │────▶│Lambda Functions │
│  (S3+CloudFront)│     │   (REST API)    │     │  (Isolated fns) │
└─────────────────┘     └─────────────────┘     └─────────────────┘
                                                         │
                        ┌────────────────────────────────┼─────────────────────┐
                        │                                │                     │
                   ┌────▼────┐                    ┌──────▼──────┐      ┌─────▼─────┐
                   │   RDS   │                    │ Plaid Prod  │      │    S3     │
                   │PostgreSQL│                    │     API     │      │  Bucket   │
                   └─────────┘                    └─────────────┘      └───────────┘
                        │                                                       │
                   ┌────▼────┐                    ┌─────────────┐      ┌──────▼────┐
                   │ Secrets │                    │ EventBridge │      │CloudWatch │
                   │ Manager │                    │ (Scheduler) │      │   Logs    │
                   └─────────┘                    └─────────────┘      └───────────┘
```

## 🎯 Why This Approach Works

### 1. **Local Development = AWS Architecture**
- Each Express route → API Gateway endpoint
- Each handler function → Separate Lambda function
- LocalStack S3 → Real S3
- Docker PostgreSQL → RDS PostgreSQL
- Environment variables → Secrets Manager

### 2. **Zero Code Changes for Deployment**
We're building with these principles:
- **API URLs are configurable** (env variables)
- **Lambda handlers are already isolated**
- **S3 client works with both LocalStack and AWS**
- **Database queries are cloud-ready**

### 3. **Frontend Built for Static Hosting**
React app will be:
- **Completely static** (no server-side rendering)
- **API calls via configurable base URL**
- **Authentication-ready** (for Cognito later)
- **CloudFront optimized** (proper caching headers)

## 📦 Lambda Functions (Already Built!)

### Core Functions:
1. **plaidSync** - Syncs bank transactions
2. **processBills** - Processes utility bills & creates payment requests
3. **generateReport** - Creates Excel reports

### API Functions (via API Gateway):
4. **getTransactions** - Retrieve filtered transactions
5. **getSummary** - Get expense summaries
6. **getPaymentRequests** - Get Venmo payment links
7. **createLinkToken** - Plaid Link initialization
8. **exchangeToken** - Plaid token exchange

## 🚀 Deployment Strategy

### Phase 1: Local Development ✅
- Docker for services
- Express as API Gateway proxy
- Lambda handlers tested locally

### Phase 2: Frontend Development 🚧 CURRENT
- Build React with deployment in mind
- Use environment variables for API URLs
- Keep bundle size optimized

### Phase 3: AWS Resources (Terraform/CDK)
```hcl
# Example Terraform structure
module "rds" {
  source = "./modules/rds"
  instance_class = "db.t3.micro"
}

module "lambda_functions" {
  source = "./modules/lambda"
  functions = ["plaidSync", "processBills", "generateReport"]
}

module "api_gateway" {
  source = "./modules/api"
  lambda_functions = module.lambda_functions.arns
}

module "s3_frontend" {
  source = "./modules/s3-cloudfront"
  bucket_name = "landlord-dashboard-frontend"
}
```

### Phase 4: CI/CD Pipeline
```yaml
# GitHub Actions
- Build React app
- Upload to S3
- Invalidate CloudFront
- Deploy Lambda functions
- Run database migrations
```

## 💰 Cost Optimization Built-In

### Serverless Benefits:
- **Lambda**: Pay only when running (~$0.20/million requests)
- **API Gateway**: Pay per API call (~$3.50/million)
- **S3 + CloudFront**: ~$0.10/GB transfer
- **RDS**: Predictable cost (~$15/month)
- **No idle compute costs**

### Monthly Estimate:
- 1,000 API calls/month = $0.01
- 100 Lambda executions = $0.02
- 1GB S3 storage = $0.02
- RDS t3.micro = $15
- **Total: ~$15-20/month**

## 🔧 Frontend Considerations for AWS

### API Configuration:
```javascript
// config.js
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3002';

// Easy switch between local and production
const api = {
  transactions: `${API_BASE_URL}/api/transactions`,
  plaidLink: `${API_BASE_URL}/api/plaid/create-link-token`,
  // etc...
};
```

### Authentication Ready:
```javascript
// Pre-structured for Cognito
const authHeaders = () => ({
  'Authorization': `Bearer ${getToken()}`, // Ready for JWT
  'Content-Type': 'application/json'
});
```

### Static Asset Optimization:
- Lazy loading for routes
- Code splitting by feature
- CDN-friendly asset naming
- Proper cache headers

## ✅ We're Building Cloud-Native from Day 1

Every decision is made with AWS deployment in mind:
- Stateless Lambda functions
- S3-compatible file operations  
- Environment-based configuration
- Microservice architecture
- Serverless-first design

The beauty is: **what works locally will work on AWS with just configuration changes!**