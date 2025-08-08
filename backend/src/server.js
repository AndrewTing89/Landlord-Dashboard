const express = require('express');
const cors = require('cors');
require('dotenv').config();

const db = require('./db/connection');
const plaidService = require('./services/plaidService');
const s3Service = require('./services/s3Service');
const emailMonitor = require('./services/emailMonitorService');
const venmoEmailMonitor = require('./services/venmoEmailMonitorService');
const simplefinService = require('./services/simplefinService');
const { cache, invalidateRelatedCaches } = require('./services/cacheService');
const backupService = require('./services/backupService');
// Commenting out scraper services since we're using SimpleFIN
// const bofaScraper = require('./services/bofaScraperService');
// const pdfParser = require('./services/pdfParserService');

// Import Lambda handlers
const plaidSync = require('./lambdas/plaidSync');
const processBills = require('./lambdas/processBills');
const generateReport = require('./lambdas/generateReport');

const app = express();
const PORT = process.env.PORT || 3002;

// Import middleware
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/errorHandler');
const ValidationMiddleware = require('./middleware/validation');

// Validate environment on startup
function validateEnv() {
  const required = ['DATABASE_URL', 'SIMPLEFIN_TOKEN'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.error(`Missing required environment variables: ${missing.join(', ')}`);
    console.error('Please check your .env file');
    process.exit(1);
  }
  
  console.log('✅ Environment variables validated');
}

validateEnv();

// Middleware
app.use(cors());
app.use(express.json());

// Import routes
const routes = require('./routes');

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', environment: process.env.NODE_ENV });
});

// Use route modules
app.use('/api/sync', routes.sync);
app.use('/api/payment', routes.payments);
app.use('/api/review', routes.review);
app.use('/api/gmail', routes.gmail);
app.use('/api/ledger', require('./routes/ledger'));
app.use('/api/health', require('./routes/health'));
app.use('/api/dashboard-sync', require('./routes/dashboard-sync'));

// Tenant Portal routes
app.use('/api/tenant/auth', require('./routes/tenantAuth'));
app.use('/api/tenant/dashboard', require('./routes/tenantDashboard'));
app.use('/api/tenant/payments', require('./routes/tenantPayments'));
app.use('/api/tenant/maintenance', require('./routes/tenantMaintenance'));

// Backup routes
app.post('/api/backup/create', async (req, res) => {
  try {
    const result = await backupService.createBackup('manual', 'user');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/backup/restore/:id', async (req, res) => {
  try {
    const result = await backupService.restoreBackup(req.params.id);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/backup/list', async (req, res) => {
  try {
    const backups = await backupService.listBackups();
    res.json(backups);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Plaid endpoints
app.post('/api/plaid/create-link-token', async (req, res) => {
  try {
    const linkToken = await plaidService.createLinkToken();
    res.json({ link_token: linkToken });
  } catch (error) {
    console.error('Error creating link token:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/plaid/exchange-public-token', async (req, res) => {
  try {
    const { public_token } = req.body;
    const tokenData = await plaidService.exchangePublicToken(public_token);
    
    // Save to database
    await db.insert('plaid_tokens', {
      access_token: tokenData.access_token,
      item_id: tokenData.item_id,
      institution_name: tokenData.institution
    });
    
    res.json({ success: true, item_id: tokenData.item_id });
  } catch (error) {
    console.error('Error exchanging public token:', error);
    res.status(500).json({ error: error.message });
  }
});

// Lambda function endpoints (for local testing)
app.post('/api/lambda/plaid-sync', async (req, res) => {
  try {
    const result = await plaidSync.handler({}, {});
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lambda/process-bills', async (req, res) => {
  try {
    const result = await processBills.handler(req.body || {}, {});
    const response = JSON.parse(result.body);
    
    // If bills were processed successfully, schedule an email check in 30 minutes
    if (response.success && response.results?.paymentRequests?.length > 0) {
      console.log('Payment requests created, scheduling email check in 30 minutes...');
      setTimeout(() => {
        emailMonitor.checkForVenmoEmails().catch(err => {
          console.error('Scheduled email check failed:', err);
        });
      }, 30 * 60 * 1000); // 30 minutes
    }
    
    res.status(result.statusCode).json(response);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/lambda/generate-report', async (req, res) => {
  try {
    const result = await generateReport.handler(req.body, {});
    res.status(result.statusCode).json(JSON.parse(result.body));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Dashboard endpoints
app.get('/api/transactions', async (req, res) => {
  try {
    const { start_date, end_date, expense_type, expense_types, exclude_types, search, include_other } = req.query;
    
    let query = 'SELECT * FROM expenses WHERE 1=1';
    const params = [];
    
    // By default, exclude 'other' transactions unless explicitly requested
    if (!include_other || include_other !== 'true') {
      query += " AND expense_type != 'other'";
    }
    
    if (start_date) {
      params.push(start_date);
      query += ` AND date >= $${params.length}`;
    }
    
    if (end_date) {
      params.push(end_date);
      query += ` AND date <= $${params.length}`;
    }
    
    // Handle both single expense_type and multiple expense_types
    if (expense_types) {
      const typesArray = expense_types.split(',');
      const placeholders = typesArray.map((_, index) => `$${params.length + index + 1}`).join(', ');
      params.push(...typesArray);
      query += ` AND expense_type IN (${placeholders})`;
    } else if (expense_type) {
      params.push(expense_type);
      query += ` AND expense_type = $${params.length}`;
    }
    
    // Handle excluded expense types
    if (exclude_types) {
      const excludeArray = exclude_types.split(',');
      const excludePlaceholders = excludeArray.map((_, index) => `$${params.length + index + 1}`).join(', ');
      params.push(...excludeArray);
      query += ` AND expense_type NOT IN (${excludePlaceholders})`;
    }
    
    // Handle search query
    if (search) {
      params.push(`%${search}%`);
      query += ` AND (LOWER(name) LIKE LOWER($${params.length}) OR LOWER(merchant_name) LIKE LOWER($${params.length}) OR LOWER(category) LIKE LOWER($${params.length}))`;
    }
    
    query += ' ORDER BY date DESC LIMIT 500';
    
    const transactions = await db.getMany(query, params);
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get monthly revenue/expense comparison with breakdown
app.get('/api/monthly-comparison', async (req, res) => {
  try {
    const { year } = req.query;
    const currentYear = year || new Date().getFullYear();
    
    // First get the summary data as before
    const result = await db.query(`
      WITH monthly_expenses AS (
        SELECT 
          EXTRACT(MONTH FROM t.date) as month,
          SUM(t.amount) - COALESCE(SUM(adj.adjustment_amount), 0) as total_expenses
        FROM expenses t
        LEFT JOIN utility_adjustments adj ON adj.expense_id = t.id
        WHERE EXTRACT(YEAR FROM t.date) = $1
          AND t.expense_type NOT IN ('rent', 'other', 'utility_reimbursement')
        GROUP BY EXTRACT(MONTH FROM t.date)
      ),
      monthly_revenue AS (
        SELECT 
          month,
          SUM(CASE WHEN source = 'rent' THEN total_revenue ELSE 0 END) as rent_revenue,
          SUM(CASE WHEN source = 'reimbursement' THEN total_revenue ELSE 0 END) as reimbursement_revenue,
          SUM(total_revenue) as total_revenue
        FROM (
          -- Get rent from income table (single source of truth)
          SELECT 
            EXTRACT(MONTH FROM date)::integer as month,
            'rent' as source,
            SUM(amount) as total_revenue
          FROM income
          WHERE EXTRACT(YEAR FROM date) = $1
            AND income_type = 'rent'
          GROUP BY EXTRACT(MONTH FROM date)
          
          UNION ALL
          
          -- Get utility reimbursements from income table
          SELECT 
            EXTRACT(MONTH FROM date)::integer as month,
            'reimbursement' as source,
            SUM(amount) as total_revenue
          FROM income
          WHERE EXTRACT(YEAR FROM date) = $1
            AND income_type = 'utility_reimbursement'
          GROUP BY EXTRACT(MONTH FROM date)
        ) combined_revenue
        GROUP BY month
      ),
      all_months AS (
        SELECT generate_series(1, 12) as month
      )
      SELECT 
        am.month,
        COALESCE(mr.total_revenue, 0) as revenue,
        COALESCE(mr.rent_revenue, 0) as rent_revenue,
        COALESCE(mr.reimbursement_revenue, 0) as reimbursement_revenue,
        COALESCE(me.total_expenses, 0) as expenses,
        COALESCE(mr.total_revenue, 0) - COALESCE(me.total_expenses, 0) as net_income
      FROM all_months am
      LEFT JOIN monthly_revenue mr ON am.month = mr.month
      LEFT JOIN monthly_expenses me ON am.month = me.month
      WHERE am.month <= EXTRACT(MONTH FROM CURRENT_DATE)
      ORDER BY am.month
    `, [currentYear]);
    
    // Now get expense breakdown by type for each month
    const expenseBreakdown = await db.query(`
      SELECT 
        EXTRACT(MONTH FROM t.date) as month,
        t.expense_type,
        SUM(t.amount) - COALESCE(SUM(adj.adjustment_amount), 0) as amount
      FROM expenses t
      LEFT JOIN utility_adjustments adj ON adj.expense_id = t.id
      WHERE EXTRACT(YEAR FROM t.date) = $1
        AND t.expense_type NOT IN ('rent', 'other', 'utility_reimbursement')
      GROUP BY EXTRACT(MONTH FROM t.date), t.expense_type
      ORDER BY month, t.expense_type
    `, [currentYear]);
    
    // Create a map of expense breakdown by month
    const breakdownMap = {};
    expenseBreakdown.rows.forEach(row => {
      const monthNum = parseInt(row.month);
      if (!breakdownMap[monthNum]) {
        breakdownMap[monthNum] = {};
      }
      breakdownMap[monthNum][row.expense_type] = parseFloat(row.amount);
    });
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const formattedData = result.rows.map(row => {
      const monthNum = parseInt(row.month);
      const breakdown = breakdownMap[monthNum] || {};
      
      return {
        month: monthNames[row.month - 1],
        revenue: parseFloat(row.revenue),
        rent: parseFloat(row.rent_revenue),
        reimbursements: parseFloat(row.reimbursement_revenue),
        expenses: parseFloat(row.expenses),
        netIncome: parseFloat(row.net_income),
        // Add individual expense types
        electricity: breakdown.electricity || 0,
        water: breakdown.water || 0,
        maintenance: breakdown.maintenance || 0,
        landscape: breakdown.landscape || 0,
        internet: breakdown.internet || 0,
        property_tax: breakdown.property_tax || 0,
        insurance: breakdown.insurance || 0
      };
    });
    
    res.json(formattedData);
  } catch (error) {
    console.error('Monthly comparison error:', error);
    res.status(500).json({ error: 'Failed to get monthly comparison' });
  }
});

app.get('/api/summary', async (req, res) => {
  try {
    const { year, month } = req.query;
    
    let dateFilter = '';
    const params = [];
    
    if (year) {
      params.push(year);
      dateFilter = `WHERE EXTRACT(YEAR FROM t.date) = $${params.length}`;
      
      if (month) {
        params.push(month);
        dateFilter += ` AND EXTRACT(MONTH FROM t.date) = $${params.length}`;
      }
    }
    
    // Add filter to exclude 'other' category and show reimbursements separately
    if (dateFilter) {
      dateFilter += ` AND t.expense_type NOT IN ('other')`;
    } else {
      dateFilter = `WHERE t.expense_type NOT IN ('other')`;
    }
    
    // Get summary with adjustments applied
    const summary = await db.getMany(
      `SELECT 
        t.expense_type,
        COUNT(DISTINCT t.id) as transaction_count,
        SUM(t.amount) as gross_amount,
        COALESCE(SUM(adj.adjustment_amount), 0) as total_adjustments,
        SUM(t.amount) - COALESCE(SUM(adj.adjustment_amount), 0) as total_amount
       FROM expenses t
       LEFT JOIN utility_adjustments adj ON adj.expense_id = t.id
       ${dateFilter}
       GROUP BY t.expense_type
       ORDER BY total_amount DESC`,
      params
    );
    
    // Calculate YTD totals if viewing 2025 data
    let ytdTotals = null;
    if (year && parseInt(year) === 2025) {
      // Get total expenses for 2025
      const expensesResult = await db.getOne(
        `SELECT 
          SUM(t.amount) - COALESCE(SUM(adj.adjustment_amount), 0) as total_expenses
         FROM expenses t
         LEFT JOIN utility_adjustments adj ON adj.expense_id = t.id
         WHERE EXTRACT(YEAR FROM t.date) = 2025
           AND t.expense_type NOT IN ('rent', 'other', 'utility_reimbursement')`
      );
      
      // Get actual rent income from paid payment requests
      const rentIncomeResult = await db.getOne(
        `SELECT SUM(amount::numeric) as rent_income
         FROM payment_requests
         WHERE year = 2025
           AND bill_type = 'rent'
           AND status = 'paid'`
      );
      
      // Calculate expected rent income for 2025
      // $1685 per month, but only count months that have passed
      const currentDate = new Date();
      const currentYear = currentDate.getFullYear();
      const currentMonth = currentDate.getMonth() + 1; // JavaScript months are 0-indexed
      let monthsWithRent = 0;
      
      if (currentYear === 2025) {
        // If we're in 2025, count months up to current month if date has passed
        monthsWithRent = currentDate.getDate() >= 1 ? currentMonth : currentMonth - 1;
      } else if (currentYear > 2025) {
        // If we're past 2025, count all 12 months
        monthsWithRent = 12;
      }
      
      const expectedRentIncome = monthsWithRent * 1685;
      
      // Get utility reimbursements from income table
      const reimbursementsResult = await db.getOne(
        `SELECT SUM(amount) as reimbursements
         FROM income
         WHERE EXTRACT(YEAR FROM date) = 2025
           AND income_type = 'utility_reimbursement'`
      );
      
      ytdTotals = {
        totalExpenses: parseFloat(expensesResult.total_expenses || 0),
        actualRentIncome: parseFloat(rentIncomeResult.rent_income || 0),
        expectedRentIncome: expectedRentIncome,
        utilityReimbursements: parseFloat(reimbursementsResult.reimbursements || 0),
        netIncome: expectedRentIncome + parseFloat(reimbursementsResult.reimbursements || 0) - parseFloat(expensesResult.total_expenses || 0)
      };
    }
    
    res.json({ 
      summary,
      ytdTotals: ytdTotals
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payment-requests', async (req, res) => {
  try {
    const { month, year, status } = req.query;
    
    let query = `
      SELECT 
        pr.*,
        pr.bill_type,
        pr.month,
        pr.year,
        pr.total_amount as bill_total_amount,
        CASE 
          WHEN pr.bill_type = 'electricity' THEN 'PG&E'
          WHEN pr.bill_type = 'water' THEN 'Great Oaks Water'
          ELSE pr.merchant_name
        END as company_name,
        pr.charge_date
      FROM payment_requests pr
      WHERE 1=1
    `;
    const params = [];
    
    if (month) {
      params.push(month);
      query += ` AND pr.month = $${params.length}`;
    }
    
    if (year) {
      params.push(year);
      query += ` AND pr.year = $${params.length}`;
    }
    
    if (status) {
      // Handle comma-separated statuses (e.g., 'pending,sent')
      const statuses = status.split(',').map(s => s.trim());
      const statusPlaceholders = statuses.map((_, i) => `$${params.length + i + 1}`).join(',');
      params.push(...statuses);
      query += ` AND pr.status IN (${statusPlaceholders})`;
    }
    
    query += ' ORDER BY pr.created_at DESC';
    
    const requests = await db.getMany(query, params);
    res.json(requests);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Payment status endpoints
app.post('/api/payment-requests/:id/mark-paid', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Start a transaction
    await db.query('BEGIN');
    
    try {
      // Get the payment request details with utility bill info
      const paymentRequest = await db.getOne(
        `SELECT pr.*, ub.id as utility_bill_id, ub.created_at as bill_date
         FROM payment_requests pr
         LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
         WHERE pr.id = $1`,
        [id]
      );
      
      if (!paymentRequest) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Payment request not found' });
      }
      
      // Update payment request status
      await db.query(
        'UPDATE payment_requests SET status = $1, paid_date = NOW(), updated_at = NOW() WHERE id = $2',
        ['paid', id]
      );
      
      // For utility bills, find the original expense and create adjustment
      if (paymentRequest.bill_type !== 'rent') {
        const utilityExpense = await db.getOne(
          `SELECT id, amount FROM expenses 
           WHERE expense_type = $1 
           AND date >= $2::date - INTERVAL '5 days'
           AND date <= $2::date + INTERVAL '5 days'
           ORDER BY ABS(amount - (SELECT total_amount FROM utility_bills WHERE id = $3)) ASC
           LIMIT 1`,
          [paymentRequest.bill_type, paymentRequest.bill_date || paymentRequest.created_at, paymentRequest.utility_bill_id]
        );
        
        if (utilityExpense) {
          // Create an adjustment record to track the reimbursement
          await db.insert('utility_adjustments', {
            expense_id: utilityExpense.id,
            payment_request_id: paymentRequest.id,
            adjustment_amount: parseFloat(paymentRequest.amount),
            adjustment_type: 'reimbursement',
            description: `Roommate payment for ${paymentRequest.bill_type} bill`,
            applied_date: new Date()
          });
          
          console.log(`Created adjustment of $${paymentRequest.amount} for expense ${utilityExpense.id}`);
        } else {
          console.log('Warning: Could not find matching utility expense');
        }
      }
      
      // Create income record for both rent and utility payments
      const incomeType = paymentRequest.bill_type === 'rent' ? 'rent' : 'utility_reimbursement';
      const description = paymentRequest.bill_type === 'rent' 
        ? `Rent Payment - ${paymentRequest.roommate_name}`
        : `${paymentRequest.roommate_name} - ${paymentRequest.bill_type === 'electricity' ? 'PG&E' : 'Water'} Payment`;
      
      // Use the month/year from the payment request for proper attribution
      // For utilities, this ensures income matches the expense month
      // For rent, it goes to the month it was for (e.g., March rent paid in August still goes to March)
      let incomeDate;
      if (paymentRequest.month && paymentRequest.year) {
        // Use the 15th of the month for utilities, 1st for rent
        const day = paymentRequest.bill_type === 'rent' ? 1 : 15;
        incomeDate = new Date(paymentRequest.year, paymentRequest.month - 1, day);
      } else {
        // Fallback to current date if month/year not set (shouldn't happen)
        console.warn(`Payment request ${id} missing month/year, using current date`);
        incomeDate = new Date();
      }
      
      await db.insert('income', {
        date: incomeDate,
        amount: parseFloat(paymentRequest.amount), // Positive for income
        description: description,
        income_type: incomeType,
        category: paymentRequest.bill_type === 'rent' ? null : paymentRequest.bill_type,
        source_type: 'payment_request',
        payment_request_id: paymentRequest.id,
        payer_name: paymentRequest.roommate_name,
        notes: `Payment request #${paymentRequest.id} marked as paid on ${new Date().toISOString().split('T')[0]}`
      });
      
      console.log(`Created income record for ${paymentRequest.roommate_name} - ${incomeType}`);
      
      
      await db.query('COMMIT');
      res.json({ success: true, message: 'Payment marked as paid with expense adjustment' });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Forego payment - mark as waived without reducing expenses
app.post('/api/payment-requests/:id/forego', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get the payment request to verify it exists
    const paymentRequest = await db.getOne(
      'SELECT * FROM payment_requests WHERE id = $1',
      [id]
    );
    
    if (!paymentRequest) {
      return res.status(404).json({ error: 'Payment request not found' });
    }
    
    // Update payment request status to 'foregone'
    await db.query(
      'UPDATE payment_requests SET status = $1, updated_at = NOW() WHERE id = $2',
      ['foregone', id]
    );
    
    // No expense adjustment is made - the expense remains as-is
    
    res.json({ success: true, message: 'Payment has been foregone' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Undo a payment (reset from paid to pending)
app.post('/api/payment-requests/:id/undo', async (req, res) => {
  try {
    const { id } = req.params;
    const { undoPayment } = require('../scripts/undo-payment');
    
    const result = await undoPayment(parseInt(id));
    
    if (result.success) {
      // Get the updated payment request
      const updated = await db.getOne(
        'SELECT * FROM payment_requests WHERE id = $1',
        [id]
      );
      res.json({ 
        success: true, 
        message: `Payment request #${id} has been reset to pending`,
        paymentRequest: updated
      });
    } else {
      res.status(400).json({ error: result.error });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Send Discord notification with Venmo link for a payment request
app.post('/api/payment-requests/:id/send-sms', async (req, res) => {
  try {
    const { id } = req.params;
    const discordService = require('./services/discordService');
    const roommateConfig = require('../config/roommate.config');
    
    // Get the payment request
    const request = await db.getOne(
      `SELECT pr.*
       FROM payment_requests pr
       WHERE pr.id = $1`,
      [id]
    );
    
    if (!request) {
      return res.status(404).json({ error: 'Payment request not found' });
    }
    
    // Generate or use existing Venmo link
    let venmoLink = request.venmo_link;
    if (!venmoLink) {
      const venmoLinkService = require('./services/venmoLinkService');
      venmoLink = venmoLinkService.generateVenmoLink(
        request.venmo_username || roommateConfig.roommate.venmoUsername,
        parseFloat(request.amount),
        `${request.bill_type} bill - ${request.merchant_name || ''} - Your share: $${request.amount}`
      );
      
      // Update the payment request with the generated link
      await db.query(
        'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
        [venmoLink, id]
      );
    }
    
    // Send Discord notification
    const notificationData = {
      billType: request.bill_type,
      totalAmount: request.total_amount || (parseFloat(request.amount) * 3),
      splitAmount: request.amount,
      merchantName: request.merchant_name || request.company_name,
      venmoLink,
      dueDate: request.due_date ? new Date(request.due_date).toLocaleDateString() : 'N/A',
      month: request.month,
      year: request.year,
      trackingId: request.tracking_id
    };
    
    try {
      await discordService.sendPaymentRequest(notificationData);
      
      // Don't update status to 'sent' here - wait for email confirmation
      // Status will change to 'sent' only when Venmo email is matched
      
      res.json({ 
        success: true, 
        message: 'Discord notification sent successfully',
        venmoLink: venmoLink
      });
    } catch (discordError) {
      console.error('Discord error:', discordError);
      res.status(500).json({ 
        error: 'Failed to send Discord notification', 
        details: discordError.message 
      });
    }
  } catch (error) {
    console.error('Error sending notification:', error);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/payment-confirmations', async (req, res) => {
  try {
    const confirmations = await db.getMany(
      `SELECT pc.*, pr.roommate_name, pr.bill_type
       FROM payment_confirmations pc
       JOIN payment_requests pr ON pc.payment_request_id = pr.id
       ORDER BY pc.processed_at DESC
       LIMIT 50`
    );
    
    res.json(confirmations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/check-payment-emails', async (req, res) => {
  try {
    console.log('Manually checking for payment emails via Gmail API...');
    
    // Use Gmail API service instead of old IMAP monitor
    const gmailService = require('./services/gmailService');
    
    // Check if Gmail is connected
    const isConnected = await gmailService.isConnected();
    if (!isConnected) {
      return res.status(400).json({ 
        error: 'Gmail not connected. Please connect Gmail first in Email Sync settings.' 
      });
    }
    
    // Process Venmo emails from the last 30 days
    const result = await gmailService.processVenmoEmails(30);
    
    console.log(`Gmail sync completed: ${result.processed} emails processed, ${result.matched} matched to payments`);
    
    res.json({ 
      success: true, 
      message: 'Email check completed',
      data: result
    });
  } catch (error) {
    console.error('Email check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Check all Venmo emails (requests and payments)
app.post('/api/check-venmo-emails', async (req, res) => {
  try {
    console.log('Checking for all Venmo emails...');
    await venmoEmailMonitor.checkForVenmoEmails();
    res.json({ success: true, message: 'Venmo email check completed' });
  } catch (error) {
    console.error('Venmo email check error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get Venmo payment requests (from Gmail)
app.get('/api/venmo-requests', async (req, res) => {
  try {
    const { status, month, year } = req.query;
    
    // Get Gmail-synced Venmo emails
    let query = `
      SELECT 
        ve.id,
        ve.venmo_actor as recipient_name,
        ve.venmo_amount as amount,
        ve.venmo_note as description,
        ve.email_type,
        ve.venmo_actor,
        ve.venmo_amount,
        ve.venmo_note,
        ve.received_date,
        ve.matched,
        ve.payment_request_id,
        CASE 
          WHEN ve.matched = true AND pr.status = 'paid' THEN 'paid'
          WHEN ve.email_type = 'payment_received' AND ve.matched = false THEN 'pending'
          WHEN ve.email_type = 'request_sent' THEN 'sent'
          WHEN ve.email_type = 'request_cancelled' THEN 'declined'
          ELSE 'pending'
        END as status,
        ve.received_date as request_date,
        CASE WHEN ve.matched = true THEN ve.received_date END as paid_date,
        NULL as declined_date,
        NULL as expired_date,
        0 as reminder_count,
        ve.gmail_message_id as email_id,
        pr.venmo_link,
        pr.bill_type,
        pr.month as bill_month,
        pr.year as bill_year
      FROM venmo_emails ve
      LEFT JOIN payment_requests pr ON ve.payment_request_id = pr.id
      WHERE 1=1
    `;
    const params = [];
    
    if (status) {
      if (status === 'paid') {
        query += ` AND ve.matched = true AND pr.status = 'paid'`;
      } else if (status === 'pending') {
        query += ` AND (ve.matched = false OR pr.status = 'pending')`;
      }
    }
    
    if (month && year) {
      params.push(month);
      params.push(year);
      query += ` AND EXTRACT(MONTH FROM ve.received_date) = $${params.length - 1}`;
      query += ` AND EXTRACT(YEAR FROM ve.received_date) = $${params.length}`;
    }
    
    query += ' ORDER BY ve.received_date DESC';
    
    const requests = await db.getMany(query, params);
    res.json(requests);
  } catch (error) {
    console.error('Error fetching venmo requests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get all Venmo emails
app.get('/api/venmo-emails', async (req, res) => {
  try {
    const emails = await db.getMany(
      `SELECT * FROM venmo_emails 
       ORDER BY received_date DESC`
    );
    res.json(emails);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get unmatched Venmo payments (from Gmail)
app.get('/api/venmo-unmatched', async (req, res) => {
  try {
    const unmatched = await db.getMany(`
      SELECT 
        ve.id,
        ve.venmo_actor as payer_name,
        ve.venmo_amount as amount,
        ve.subject as email_subject,
        ve.received_date as email_date,
        ve.matched,
        ve.payment_request_id as matched_request_id
      FROM venmo_emails ve
      WHERE ve.matched = FALSE
        AND ve.email_type = 'payment_received'
      ORDER BY ve.received_date DESC
    `);
    res.json(unmatched);
  } catch (error) {
    console.error('Error fetching unmatched payments:', error);
    res.status(500).json({ error: error.message });
  }
});

// Manually match a payment to a request
app.post('/api/venmo-match/:paymentId/:requestId', async (req, res) => {
  try {
    const { paymentId, requestId } = req.params;
    
    await db.query('BEGIN');
    
    // Update the unmatched payment
    await db.query(
      `UPDATE venmo_unmatched_payments 
       SET matched = true, 
           matched_request_id = $1 
       WHERE id = $2`,
      [requestId, paymentId]
    );
    
    // Update the request to paid
    await db.query(
      `UPDATE venmo_payment_requests 
       SET status = 'paid',
           paid_date = (SELECT email_date FROM venmo_unmatched_payments WHERE id = $1),
           updated_at = NOW()
       WHERE id = $2`,
      [paymentId, requestId]
    );
    
    await db.query('COMMIT');
    
    res.json({ success: true, message: 'Payment matched successfully' });
  } catch (error) {
    await db.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  }
});

// Get payment request summary (from Gmail)
app.get('/api/venmo-summary', async (req, res) => {
  try {
    const summary = await db.getOne(`
      SELECT 
        COUNT(*) FILTER (WHERE ve.email_type = 'payment_received' AND ve.matched = false) as pending_count,
        COUNT(*) FILTER (WHERE ve.email_type = 'payment_received' AND ve.matched = true) as paid_count,
        COUNT(*) FILTER (WHERE ve.email_type = 'request_cancelled') as declined_count,
        0 as expired_count,
        COALESCE(SUM(ve.venmo_amount) FILTER (WHERE ve.email_type = 'payment_received' AND ve.matched = false), 0) as pending_amount,
        COALESCE(SUM(ve.venmo_amount) FILTER (WHERE ve.email_type = 'payment_received' AND ve.matched = true), 0) as paid_amount
      FROM venmo_emails ve
      WHERE ve.received_date > NOW() - INTERVAL '90 days'
    `);
    
    res.json(summary);
  } catch (error) {
    console.error('Error fetching venmo summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// SimpleFIN sync endpoint (alternative to Plaid)
app.post('/api/simplefin/sync', async (req, res) => {
  try {
    console.log('Syncing with SimpleFIN...');
    const result = await simplefinService.syncTransactions();
    
    // After syncing transactions, check and add rent income for 2025
    if (result.success) {
      try {
        const { addRentForMonth } = require('./scripts/add-rent-income-2025');
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();
        const currentMonth = currentDate.getMonth() + 1;
        
        // Only process rent for 2025
        if (currentYear === 2025) {
          // Add rent for current month if we're on or after the 1st
          if (currentDate.getDate() >= 1) {
            const rentResult = await addRentForMonth(2025, currentMonth);
            if (rentResult.success) {
              console.log(`[Sync] ${rentResult.message}`);
              result.rentAdded = true;
              result.rentMessage = rentResult.message;
            }
          }
          
          // Also check previous months in case any were missed
          for (let month = 1; month < currentMonth; month++) {
            const rentResult = await addRentForMonth(2025, month);
            if (rentResult.success) {
              console.log(`[Sync] ${rentResult.message} (catch-up)`);
            }
          }
        }
      } catch (rentError) {
        console.error('Error adding rent income during sync:', rentError);
        // Don't fail the whole sync if rent addition fails
        result.rentError = rentError.message;
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('SimpleFIN sync error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Sync endpoints moved to routes/sync.js

// Process pending bills and create payment requests
app.post('/api/process-pending-bills', async (req, res) => {
  try {
    console.log('Processing pending bills...');
    const venmoLinkService = require('./services/venmoLinkService');
    const processedCount = await venmoLinkService.processPendingBills();
    res.json({ 
      success: true, 
      message: `Processed ${processedCount} bills`,
      count: processedCount
    });
  } catch (error) {
    console.error('Bill processing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// SimpleFIN test endpoint
app.get('/api/simplefin/test', async (req, res) => {
  try {
    const hasToken = !!process.env.SIMPLEFIN_TOKEN;
    console.log('SimpleFIN token configured:', hasToken);
    console.log('Token starts with:', process.env.SIMPLEFIN_TOKEN?.substring(0, 50) + '...');
    
    if (!hasToken) {
      return res.json({ 
        configured: false, 
        message: 'SIMPLEFIN_TOKEN not found in environment variables' 
      });
    }
    
    // Try to get accounts
    const accounts = await simplefinService.getAccounts();
    
    res.json({ 
      configured: true, 
      accounts: accounts.length,
      message: 'SimpleFIN is configured and working!'
    });
  } catch (error) {
    console.error('SimpleFIN test error:', error);
    res.json({ 
      configured: true, 
      error: error.message,
      message: 'Token found but connection failed' 
    });
  }
});

// Bank of America scraper endpoint
app.post('/api/bofa/scrape', async (req, res) => {
  try {
    console.log('Scraping Bank of America...');
    await bofaScraper.initialize();
    
    const transactions = await bofaScraper.scrapeTransactions(
      process.env.BOFA_USERNAME,
      process.env.BOFA_PASSWORD
    );
    
    const savedCount = await bofaScraper.saveTransactions(transactions);
    
    res.json({
      success: true,
      transactionsFound: transactions.length,
      transactionsSaved: savedCount
    });
  } catch (error) {
    console.error('BofA scraping error:', error);
    res.status(500).json({ error: error.message });
  }
});

// PDF statement upload endpoint
app.post('/api/upload-statement', async (req, res) => {
  try {
    // This would need multer for file uploads
    const { filePath } = req.body; // Simplified for now
    
    const transactions = await pdfParser.parseStatement(filePath);
    const savedCount = await pdfParser.saveTransactions(transactions);
    
    res.json({
      success: true,
      transactionsFound: transactions.length,
      transactionsSaved: savedCount
    });
  } catch (error) {
    console.error('PDF parsing error:', error);
    res.status(500).json({ error: error.message });
  }
});

// Transaction Review endpoints
app.get('/api/review/pending', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Get pending transactions
    const transactions = await db.query(`
      SELECT 
        id,
        simplefin_id,
        simplefin_account_id,
        amount,
        posted_date,
        description,
        payee,
        suggested_expense_type,
        suggested_merchant,
        confidence_score
      FROM raw_transactions
      WHERE processed = false 
        AND excluded = false
      ORDER BY posted_date DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get total count for pagination
    const countResult = await db.getOne(`
      SELECT COUNT(*) as total
      FROM raw_transactions
      WHERE processed = false AND excluded = false
    `);
    
    res.json({
      transactions: transactions.rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

app.post('/api/review/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_type, merchant_name } = req.body;
    
    // Get the raw transaction
    const rawTx = await db.getOne(
      'SELECT * FROM raw_transactions WHERE id = $1',
      [id]
    );
    
    if (!rawTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Check if already exists in main transactions (same date + amount = likely duplicate)
    const existing = await db.getOne(
      `SELECT id, expense_type, name FROM expenses 
       WHERE date = $1 
         AND amount = $2`,
      [rawTx.posted_date, Math.abs(rawTx.amount)]
    );
    
    if (existing) {
      // Mark the raw transaction as processed since it's a duplicate
      await db.query(
        'UPDATE raw_transactions SET processed = true, reviewed_at = NOW() WHERE id = $1',
        [id]
      );
      
      return res.status(400).json({ 
        error: 'Transaction already exists in main transactions table',
        existing_id: existing.id,
        existing_type: existing.expense_type,
        message: `Duplicate of: ${existing.name} (${existing.expense_type})`
      });
    }
    
    // Start a transaction
    await db.query('BEGIN');
    
    try {
      // Insert into main transactions table
      await db.insert('transactions', {
        plaid_transaction_id: `simplefin_${rawTx.simplefin_id}`,
        plaid_account_id: rawTx.simplefin_account_id,
        amount: Math.abs(rawTx.amount),
        date: rawTx.posted_date,
        name: rawTx.description,
        merchant_name: merchant_name || rawTx.suggested_merchant || rawTx.payee,
        expense_type: expense_type,
        category: rawTx.category || 'Manual Review',
        subcategory: null
      });
      
      // Mark as processed
      await db.query(
        'UPDATE raw_transactions SET processed = true, reviewed_at = NOW() WHERE id = $1',
        [id]
      );
      
      await db.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: 'Transaction approved',
        expense_type: expense_type
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error approving transaction:', error);
    res.status(500).json({ error: 'Failed to approve transaction' });
  }
});

app.post('/api/review/exclude/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await db.query(
      `UPDATE raw_transactions 
       SET excluded = true, 
           exclude_reason = $1, 
           reviewed_at = NOW() 
       WHERE id = $2`,
      [reason || 'Manual exclusion', id]
    );
    
    res.json({ success: true, message: 'Transaction excluded' });
  } catch (error) {
    console.error('Error excluding transaction:', error);
    res.status(500).json({ error: 'Failed to exclude transaction' });
  }
});

app.get('/api/review/expense-types', async (req, res) => {
  try {
    const types = [
      { value: 'rent', label: 'Rent Income' },
      { value: 'electricity', label: 'Electricity' },
      { value: 'water', label: 'Water' },
      { value: 'internet', label: 'Internet' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'landscape', label: 'Landscape' },
      { value: 'property_tax', label: 'Property Tax' },
      { value: 'insurance', label: 'Insurance' },
      { value: 'other', label: 'Other' }
    ];
    
    res.json(types);
  } catch (error) {
    console.error('Error fetching expense types:', error);
    res.status(500).json({ error: 'Failed to fetch expense types' });
  }
});

// Update transaction category
app.put('/api/transactions/:id/category', async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_type } = req.body;
    
    if (!expense_type) {
      return res.status(400).json({ error: 'expense_type is required' });
    }
    
    // Start a transaction to ensure consistency
    await db.query('BEGIN');
    
    try {
      // Get the current transaction details
      const transaction = await db.getOne(
        'SELECT * FROM expenses WHERE id = $1',
        [id]
      );
      
      if (!transaction) {
        await db.query('ROLLBACK');
        return res.status(404).json({ error: 'Transaction not found' });
      }
      
      // Update the main transactions table
      await db.query(
        'UPDATE expenses SET expense_type = $1, updated_at = NOW() WHERE id = $2',
        [expense_type, id]
      );
      
      // If this transaction came from SimpleFIN, update the raw_transactions table too
      if (transaction.plaid_transaction_id && transaction.plaid_transaction_id.startsWith('simplefin_')) {
        const simplefinId = transaction.plaid_transaction_id.replace('simplefin_', '');
        
        // Update the suggested_expense_type in raw_transactions
        await db.query(
          `UPDATE raw_transactions 
           SET suggested_expense_type = $1, 
               confidence_score = 1.0,
               reviewed_at = NOW() 
           WHERE simplefin_id = $2 
              OR (posted_date = $3 AND ABS(amount) = $4)`,
          [expense_type, simplefinId, transaction.date, transaction.amount]
        );
      }
      
      // Also check if we should update the ETL rules for better future categorization
      // Get merchant name or description pattern
      const merchantPattern = transaction.merchant_name || transaction.name;
      
      // Check if an ETL rule exists for this pattern
      const existingRule = await db.getOne(
        `SELECT * FROM etl_rules 
         WHERE LOWER($1) LIKE LOWER(pattern) 
         AND rule_type = 'merchant'`,
        [merchantPattern]
      );
      
      // If no rule exists and this isn't a one-off transaction, suggest creating one
      let ruleCreated = false;
      if (!existingRule && expense_type !== 'other') {
        // Check if we have multiple transactions with similar patterns
        const similarTransactions = await db.query(
          `SELECT COUNT(*) as count 
           FROM expenses 
           WHERE (LOWER(merchant_name) LIKE LOWER($1) 
                  OR LOWER(name) LIKE LOWER($1))
             AND id != $2`,
          [`%${merchantPattern}%`, id]
        );
        
        // If we have more similar transactions, it might be worth creating a rule
        if (similarTransactions.rows[0].count > 2) {
          ruleCreated = true;
        }
      }
      
      await db.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: 'Transaction category updated successfully',
        expense_type: expense_type,
        suggestion: ruleCreated ? 
          `Consider creating an ETL rule for "${merchantPattern}" to automatically categorize similar future transactions` : 
          null
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error updating transaction category:', error);
    res.status(500).json({ error: 'Failed to update transaction category' });
  }
});

// Initialize and start server
async function startServer() {
  try {
    // Initialize S3 bucket in development (optional - don't fail if LocalStack is down)
    if (process.env.NODE_ENV === 'development') {
      try {
        await s3Service.initializeBucket();
        console.log('S3 bucket initialized');
      } catch (error) {
        console.warn('Warning: Could not initialize S3 bucket. LocalStack may not be running.');
        console.warn('Excel exports will fail until LocalStack is started.');
      }
    }
    
    // Initialize email monitors
    emailMonitor.initialize();
    venmoEmailMonitor.initialize();
    
    // Start email monitoring if configured
    if (process.env.EMAIL_USER && process.env.EMAIL_APP_PASSWORD) {
      console.log('Starting email monitor for Venmo payment confirmations...');
      // Don't await this - let it run in background
      emailMonitor.startMonitoring().catch(err => {
        console.error('Failed to start email monitoring:', err);
      });
    }
    
    // Error handling middleware (must be last)
    app.use(notFoundHandler);
    app.use(errorHandler);
    
    app.listen(PORT, () => {
      console.log(`Backend server running on http://localhost:${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV}`);
      console.log(`Plaid Environment: ${process.env.PLAID_ENV}`);
      console.log(`Email Monitoring: ${emailMonitor.isMonitoring ? 'Active' : 'Inactive'}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();