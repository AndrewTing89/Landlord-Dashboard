# Landlord Dashboard - Project Roadmap

## 🎯 Project Goal
Build an automated landlord expense tracking system that:
- Syncs transactions from Bank of America via Plaid
- Classifies expenses automatically
- Splits utility bills 3 ways and generates Venmo payment links
- Generates tax reports for accountant
- Runs automated monthly processes on the 5th

## 📍 Current Status (Phase 1 ✅ Complete)
- [x] Docker environment (PostgreSQL + LocalStack)
- [x] Database schema designed
- [x] Lambda function handlers created
- [x] Plaid integration (sandbox mode)
- [x] Transaction classification system
- [x] Bill splitting logic
- [x] Excel report generation
- [x] Express API server
- [x] Local S3 mock

## 🗺️ Project Phases

### Phase 2: Frontend Development 🚧 CURRENT
- [ ] Create React dashboard
  - [ ] Dashboard homepage with expense summary
  - [ ] Transaction list with filtering
  - [ ] Plaid Link integration for bank connection
  - [ ] Payment requests view with Venmo links
  - [ ] Reports download page
- [ ] Authentication (simple password protection)
- [ ] Responsive design for mobile (to click Venmo links)

### Phase 3: Testing & Refinement
- [ ] Connect real Bank of America account
  - [ ] Upgrade Plaid to Development mode
  - [ ] Test with real transactions
  - [ ] Verify transaction classification accuracy
- [ ] Test bill splitting with actual PGE/water bills
- [ ] Verify Venmo deep links work on mobile
- [ ] Test Excel reports with real data
- [ ] Add your roommate's actual Venmo username

### Phase 4: AWS Deployment Preparation
- [ ] Create AWS account and set up billing alerts
- [ ] Write Infrastructure as Code (Terraform/CDK)
  - [ ] RDS PostgreSQL setup
  - [ ] Lambda function definitions
  - [ ] API Gateway configuration
  - [ ] S3 bucket with proper permissions
  - [ ] EventBridge rules for scheduling
  - [ ] Secrets Manager for credentials
- [ ] Create deployment scripts
- [ ] Set up CI/CD with GitHub Actions

### Phase 5: AWS Deployment
- [ ] Deploy infrastructure
- [ ] Migrate database to RDS
- [ ] Deploy Lambda functions
- [ ] Configure API Gateway
- [ ] Deploy React app to S3/CloudFront
- [ ] Set up custom domain (optional)
- [ ] Configure monitoring and alerts

### Phase 6: Production Ready
- [ ] Security audit
  - [ ] API authentication
  - [ ] HTTPS everywhere
  - [ ] Secure credential storage
- [ ] Backup strategy for database
- [ ] Error monitoring (CloudWatch)
- [ ] Email notifications for monthly runs
- [ ] Documentation for maintenance

### Phase 7: Future Enhancements
- [ ] Multiple property support
- [ ] Receipt/invoice scanning with OCR
- [ ] Tenant portal for viewing their bills
- [ ] Integration with QuickBooks
- [ ] Mobile app
- [ ] Advanced analytics and predictions

## 💰 Cost Projections
### Local Development: $0
### AWS Monthly Costs:
- RDS PostgreSQL (t3.micro): ~$15
- Lambda executions: ~$2
- S3 storage: <$1
- API Gateway: <$1
- Secrets Manager: ~$1
- **Total: ~$20/month**

## 🔑 Key Decisions Needed

### Immediate (Phase 2):
1. **Frontend Framework**: 
   - React (recommended) ✓
   - Vue.js
   - Plain HTML/JS

2. **UI Library**:
   - Material-UI
   - Tailwind CSS
   - Bootstrap

### Before Production (Phase 3-4):
1. **Authentication Method**:
   - AWS Cognito
   - Auth0
   - Simple password in Secrets Manager

2. **Notification System**:
   - Email only (SES)
   - SMS alerts (SNS)
   - Both

3. **Domain Name**:
   - Use AWS default URLs
   - Purchase custom domain

## 📋 Next Immediate Steps
1. Build React frontend with core features
2. Create Plaid Link integration UI
3. Test end-to-end flow with sandbox data
4. Document any issues or improvements needed

## 🎨 UI/UX Requirements
### Dashboard Page
- Monthly revenue vs expenses chart
- Quick stats (total revenue, expenses, net income)
- Recent transactions list
- Action buttons (sync now, generate report)

### Transactions Page
- Filterable table (date range, category, amount)
- Edit classification capability
- Bulk categorization

### Bills & Payments Page
- Current month utility bills
- Venmo payment links (mobile-friendly buttons)
- Payment status tracking
- Historical bill amounts

### Reports Page
- Generate annual/monthly reports
- Download previous reports
- Email report to accountant option

## 📱 Mobile Considerations
- Venmo links must work on mobile browsers
- Responsive design for checking bills on phone
- Large touch targets for payment buttons

## 🔐 Security Requirements
- No sensitive data in frontend code
- All API calls authenticated
- Plaid tokens never exposed to client
- S3 URLs use presigned links
- Database connections use SSL

## 📊 Success Metrics
- Time saved: <5 minutes/month on expense tracking
- Accuracy: 95%+ correct auto-classification
- Reliability: 99.9% uptime for monthly automation
- Cost efficiency: <$25/month total AWS costs

---

## Current Phase: Frontend Development
**Next Action**: Create React app with dashboard and core features