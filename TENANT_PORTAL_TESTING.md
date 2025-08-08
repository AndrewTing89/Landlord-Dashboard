# Tenant Portal Testing Guide

## 🧪 Test Environment Overview

The tenant portal has been configured with realistic test data simulating a multi-property rental scenario with different tenant payment behaviors and lease terms.

## 🔑 Test Accounts

### Main House Tenants (Property ID: 1)

#### 1. Ushi Lo - Primary Tenant
- **Email**: `ushi@test.com`
- **Password**: `password123`
- **Property**: Main House - Room 1
- **Monthly Rent**: $1,685.00
- **Lease Start**: January 1, 2024
- **Payment Pattern**: 85% on-time, 15% late (2-3 days)
- **Total Payment History**: 39 payment requests
  - Rent: 16/16 paid (100%)
  - Electricity: 15/15 paid (100%)
  - Water: 5/8 paid (62.5%) - 2 pending, 1 foregone

#### 2. Alex Chen - Roommate
- **Email**: `alex@test.com`
- **Password**: `password123`
- **Property**: Main House - Room 2
- **Monthly Rent**: $1,685.00
- **Lease Start**: June 1, 2024
- **Payment Pattern**: 95% on-time, 5% early
- **Total Payment History**: 20 payment requests
  - Rent: 8/8 paid (100%)
  - Electricity: 8/8 paid (100%)
  - Water: 4/4 paid (100%)

### ADU Tenant (Property ID: 2)

#### 3. Sarah Johnson - ADU Resident
- **Email**: `sarah@test.com`
- **Password**: `password123`
- **Property**: ADU Property
- **Monthly Rent**: $2,200.00
- **Lease Start**: March 1, 2024
- **Payment Pattern**: 70% on-time, 20% late, 10% partial
- **Total Payment History**: 8 payment requests
  - Rent: 7/8 paid (87.5%) - 1 pending

## 📋 Test Scenarios

### Scenario 1: Basic Authentication Flow
1. Navigate to http://localhost:3003
2. Enter test credentials (e.g., `ushi@test.com` / `password123`)
3. **Expected Result**: Successful login, redirect to dashboard
4. **Verify**: JWT tokens stored in localStorage
5. **Test**: Refresh page maintains session

### Scenario 2: Dashboard Overview
**Login as**: Any test tenant

**Verify Dashboard Shows**:
- [ ] Current balance (pending payments total)
- [ ] Number of pending payments
- [ ] Paid this month count
- [ ] Recent payment history (last 5)
- [ ] Active maintenance requests
- [ ] Lease information with days remaining

### Scenario 3: Payment History Viewing
**Login as**: `ushi@test.com`

**Test Steps**:
1. Navigate to Payments page
2. View "Unpaid" tab
3. **Expected**: See 2-3 pending payments
4. Switch to "Paid" tab
5. **Expected**: See full payment history from Jan 2025
6. **Verify**: Each payment shows:
   - Bill type (rent/electricity/water)
   - Month/Year
   - Your portion amount
   - Total bill amount (for utilities)
   - Payment status
   - Venmo payment link

### Scenario 4: Venmo Payment Links
**Login as**: `ushi@test.com`

**Test Steps**:
1. Find a pending payment
2. Click "Pay with Venmo" button
3. **Expected URL Format**: 
   ```
   https://venmo.com/andrewhting?txn=charge&amount=XX.XX&note=TRACKING_ID
   ```
4. **Verify**:
   - Amount matches tenant's portion
   - Tracking ID is included
   - Links to @andrewhting (landlord)

### Scenario 5: Data Privacy Isolation
**Test Multi-Tenant Privacy**:

1. **Login as** `ushi@test.com`
   - Record payment IDs visible
   - Note total pending amount

2. **Logout and login as** `alex@test.com`
   - **Verify**: Different payment IDs
   - **Verify**: Different payment history
   - **Verify**: Cannot see Ushi's data

3. **Logout and login as** `sarah@test.com`
   - **Verify**: Only ADU payments visible
   - **Verify**: Different rent amount ($2,200)
   - **Verify**: Cannot see Main House data

### Scenario 6: Maintenance Request Submission
**Login as**: Any test tenant

**Test Steps**:
1. Navigate to Maintenance page
2. Click "Submit New Request"
3. Fill out form:
   - Category: "Plumbing"
   - Priority: "Normal"
   - Title: "Kitchen sink dripping"
   - Description: "Slow drip from kitchen faucet"
4. Submit request
5. **Expected**: Request appears in list with "Submitted" status
6. **Verify**: Request ID generated
7. **Verify**: Timestamp recorded

### Scenario 7: Shared Expense Breakdown
**Login as**: `ushi@test.com` or `alex@test.com`

**Test Steps**:
1. View a utility bill payment (electricity/water)
2. **Verify Display Shows**:
   - Total bill amount
   - Your portion (1/3 for main house)
   - Note about 3-way split
3. **Privacy Check**: Should NOT show other tenants' names or individual amounts

### Scenario 8: Property-Specific Features
**Compare Main House vs ADU Experience**:

**Main House (Ushi/Alex)**:
- Utilities split 3 ways
- Lower rent ($1,685)
- Shared maintenance areas

**ADU (Sarah)**:
- Full utility responsibility
- Higher rent ($2,200)
- Independent unit maintenance

### Scenario 9: Payment Status Tracking
**Login as**: `ushi@test.com`

**Verify Payment Statuses**:
- **Paid**: Shows completion date
- **Pending**: Shows "Pay Now" button
- **Foregone**: Historical skipped payments
- **Late**: Should show days overdue

### Scenario 10: Mobile Responsiveness
**Test on Mobile Device or Browser DevTools**:

1. Set viewport to mobile size (375x667)
2. **Test All Pages**:
   - [ ] Login form usable
   - [ ] Dashboard cards stack properly
   - [ ] Payment cards readable
   - [ ] Venmo buttons accessible
   - [ ] Navigation menu works
   - [ ] Forms are fillable

## 🔒 Security Testing

### Authentication Security
1. **Test Invalid Credentials**:
   - Wrong password → Error message
   - Non-existent email → Error message
   - No credentials → Error message

2. **Test Token Expiry**:
   - Wait 15 minutes (access token expires)
   - Try to access protected route
   - Should refresh automatically or prompt re-login

3. **Test Cross-Tenant Access**:
   - Try to access another tenant's payment ID directly
   - Should return 403 Forbidden

### API Security
```bash
# Test unauthorized access
curl http://localhost:3002/api/tenant/dashboard
# Expected: 401 Unauthorized

# Test with invalid token
curl -H "Authorization: Bearer invalid_token" \
  http://localhost:3002/api/tenant/dashboard
# Expected: 401 Unauthorized

# Test cross-tenant data access
# Login as Ushi, get token, try to access Alex's data
# Expected: 403 Forbidden or filtered results
```

## 📊 Performance Testing

### Load Times
- **Dashboard**: Should load < 1 second
- **Payment History**: Should load < 2 seconds
- **Login**: Should complete < 500ms

### Data Volume
- **Ushi**: 39 payment records - verify pagination works
- **Alex**: 20 payment records - verify all load
- **Sarah**: 8 payment records - verify quick load

## 🐛 Known Test Data Patterns

### Ushi's Account
- Has pending water bills to test payment flow
- Mix of paid and pending for realistic dashboard
- Full 8-month history for comprehensive testing

### Alex's Account
- All bills paid - tests "clean" tenant view
- Shorter history (3 months) - tests partial year display
- Early payment patterns for variety

### Sarah's Account
- ADU with different rent amount
- One pending rent payment for testing
- Independent utility responsibility

## ✅ Test Checklist

### Core Functionality
- [ ] All three test accounts can login
- [ ] Dashboard loads with correct data
- [ ] Payment history displays accurately
- [ ] Venmo links generate correctly
- [ ] Maintenance requests can be submitted
- [ ] Logout works properly

### Data Integrity
- [ ] Payment amounts are accurate
- [ ] Dates display correctly
- [ ] Status indicators are correct
- [ ] Calculations (balances) are accurate

### Privacy & Security
- [ ] Tenants cannot see each other's data
- [ ] Property isolation works (Main vs ADU)
- [ ] Authentication is required for all pages
- [ ] API endpoints are protected

### User Experience
- [ ] Mobile responsive design works
- [ ] Loading states display properly
- [ ] Error messages are helpful
- [ ] Navigation is intuitive
- [ ] Forms validate input

## 🔧 Troubleshooting

### Common Issues

1. **Cannot Login**:
   - Verify backend is running on port 3002
   - Check credentials are exactly as shown
   - Clear browser cache/cookies

2. **No Payment Data**:
   - Run setup script: `node src/scripts/setup-test-tenants.js`
   - Verify database migrations completed
   - Check tenant_id linkage in payment_requests

3. **Venmo Links Not Working**:
   - Verify format includes @andrewhting
   - Check amount is properly formatted
   - Ensure tracking_id is included

4. **Cross-Origin Errors**:
   - Ensure frontend proxy configured to 3002
   - Check CORS settings in backend
   - Verify both services running

## 📝 Test Execution Log

Use this template to document test execution:

```markdown
### Test Session: [Date]
**Tester**: [Name]
**Environment**: Development / Staging / Production

#### Test Results:
- [ ] Scenario 1: Authentication - PASS/FAIL
- [ ] Scenario 2: Dashboard - PASS/FAIL
- [ ] Scenario 3: Payment History - PASS/FAIL
- [ ] Scenario 4: Venmo Links - PASS/FAIL
- [ ] Scenario 5: Data Privacy - PASS/FAIL
- [ ] Scenario 6: Maintenance - PASS/FAIL
- [ ] Scenario 7: Shared Expenses - PASS/FAIL
- [ ] Scenario 8: Property Features - PASS/FAIL
- [ ] Scenario 9: Payment Status - PASS/FAIL
- [ ] Scenario 10: Mobile - PASS/FAIL

#### Issues Found:
1. [Issue description]
2. [Issue description]

#### Notes:
[Any additional observations]
```

## 🚀 Quick Start Testing

```bash
# Terminal 1 - Start Backend
cd backend
npm run dev

# Terminal 2 - Start Tenant Portal
cd tenant-frontend
npm run dev

# Terminal 3 - Quick API Test
curl -X POST http://localhost:3002/api/tenant/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "ushi@test.com", "password": "password123"}'

# Browser
open http://localhost:3003
```

## 📞 Support

For issues or questions about the test environment:
1. Check the error logs in browser console
2. Review backend logs in terminal
3. Verify all services are running
4. Consult TENANT_PORTAL.md for architecture details