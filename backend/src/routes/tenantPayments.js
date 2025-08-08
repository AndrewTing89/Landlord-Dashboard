const express = require('express');
const db = require('../db/connection');
const { authenticateTenant } = require('../middleware/tenantAuth');

const router = express.Router();

// All routes require authentication
router.use(authenticateTenant);

/**
 * Get payment history
 * GET /api/tenant/payments
 */
router.get('/', async (req, res) => {
  try {
    const { status, year, month, limit = 50, offset = 0 } = req.query;
    const tenantId = req.tenant.id;
    
    let query = `
      SELECT 
        pr.id,
        pr.amount,
        pr.total_amount,
        pr.bill_type,
        pr.status,
        pr.charge_date,
        pr.paid_date,
        pr.month,
        pr.year,
        pr.tracking_id,
        pr.venmo_link,
        pr.company_name,
        pr.created_at,
        CASE 
          WHEN pr.status IN ('pending', 'sent') AND pr.charge_date < CURRENT_DATE THEN true
          ELSE false
        END as is_overdue
      FROM payment_requests pr
      WHERE (pr.tenant_id = $1 OR pr.roommate_name = $2)
    `;
    
    const params = [tenantId, req.tenant.fullName];
    let paramIndex = 3;

    if (status) {
      query += ` AND pr.status = $${paramIndex++}`;
      params.push(status);
    }

    if (year) {
      query += ` AND pr.year = $${paramIndex++}`;
      params.push(parseInt(year));
    }

    if (month) {
      query += ` AND pr.month = $${paramIndex++}`;
      params.push(parseInt(month));
    }

    query += ` ORDER BY pr.year DESC, pr.month DESC, pr.created_at DESC`;
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const payments = await db.getMany(query, params);

    // Get total count for pagination
    let countQuery = `
      SELECT COUNT(*) as total
      FROM payment_requests pr
      WHERE (pr.tenant_id = $1 OR pr.roommate_name = $2)
    `;
    
    const countParams = [tenantId, req.tenant.fullName];
    let countParamIndex = 3;

    if (status) {
      countQuery += ` AND pr.status = $${countParamIndex++}`;
      countParams.push(status);
    }

    if (year) {
      countQuery += ` AND pr.year = $${countParamIndex++}`;
      countParams.push(parseInt(year));
    }

    if (month) {
      countQuery += ` AND pr.month = $${countParamIndex++}`;
      countParams.push(parseInt(month));
    }

    const countResult = await db.getOne(countQuery, countParams);

    res.json({
      success: true,
      data: {
        payments,
        pagination: {
          total: parseInt(countResult.total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + payments.length < parseInt(countResult.total)
        }
      }
    });

  } catch (error) {
    console.error('Get payments error:', error);
    res.status(500).json({
      error: 'Failed to retrieve payment history'
    });
  }
});

/**
 * Get pending payments (bills due)
 * GET /api/tenant/payments/pending
 */
router.get('/pending', async (req, res) => {
  try {
    const tenantId = req.tenant.id;

    const pendingPayments = await db.getMany(`
      SELECT 
        pr.id,
        pr.amount,
        pr.total_amount,
        pr.bill_type,
        pr.status,
        pr.charge_date as due_date,
        pr.month,
        pr.year,
        pr.tracking_id,
        pr.venmo_link,
        pr.company_name,
        pr.created_at,
        CASE 
          WHEN pr.charge_date < CURRENT_DATE THEN true
          ELSE false
        END as is_overdue,
        (pr.charge_date - CURRENT_DATE)::integer as days_until_due
      FROM payment_requests pr
      WHERE (pr.tenant_id = $1 OR pr.roommate_name = $2)
        AND pr.status IN ('pending', 'sent')
      ORDER BY pr.charge_date ASC
    `, [tenantId, req.tenant.fullName]);

    // Calculate total amount due
    const totalDue = pendingPayments.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

    res.json({
      success: true,
      data: {
        payments: pendingPayments,
        summary: {
          totalDue,
          count: pendingPayments.length,
          overdueCount: pendingPayments.filter(p => p.is_overdue).length
        }
      }
    });

  } catch (error) {
    console.error('Get pending payments error:', error);
    res.status(500).json({
      error: 'Failed to retrieve pending payments'
    });
  }
});

/**
 * Get payment details
 * GET /api/tenant/payments/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    const payment = await db.getOne(`
      SELECT 
        pr.*,
        ub.service_address,
        ub.service_period_start,
        ub.service_period_end,
        ub.usage_kwh,
        ub.usage_gallons
      FROM payment_requests pr
      LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
      WHERE pr.id = $1
        AND (pr.tenant_id = $2 OR pr.roommate_name = $3)
    `, [id, tenantId, req.tenant.fullName]);

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found'
      });
    }

    // Get bill split information if it's a utility
    let splitInfo = null;
    if (['electricity', 'water', 'internet'].includes(payment.bill_type)) {
      splitInfo = await db.getMany(`
        SELECT 
          roommate_name,
          amount,
          status
        FROM payment_requests
        WHERE utility_bill_id = $1
        ORDER BY roommate_name
      `, [payment.utility_bill_id]);
    }

    res.json({
      success: true,
      data: {
        payment,
        splitInfo
      }
    });

  } catch (error) {
    console.error('Get payment details error:', error);
    res.status(500).json({
      error: 'Failed to retrieve payment details'
    });
  }
});

/**
 * Mark payment as acknowledged/seen
 * POST /api/tenant/payments/:id/acknowledge
 */
router.post('/:id/acknowledge', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    // Verify payment belongs to tenant
    const payment = await db.getOne(`
      SELECT id 
      FROM payment_requests 
      WHERE id = $1 
        AND (tenant_id = $2 OR roommate_name = $3)
    `, [id, tenantId, req.tenant.fullName]);

    if (!payment) {
      return res.status(404).json({
        error: 'Payment not found'
      });
    }

    // Log activity
    await db.query(`
      INSERT INTO tenant_activity_log (tenant_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      tenantId,
      'PAYMENT_ACKNOWLEDGED',
      'payment',
      id,
      JSON.stringify({ timestamp: new Date() })
    ]);

    res.json({
      success: true,
      message: 'Payment acknowledged'
    });

  } catch (error) {
    console.error('Acknowledge payment error:', error);
    res.status(500).json({
      error: 'Failed to acknowledge payment'
    });
  }
});

/**
 * Get payment receipt
 * GET /api/tenant/payments/:id/receipt
 */
router.get('/:id/receipt', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    const payment = await db.getOne(`
      SELECT 
        pr.*,
        t.first_name,
        t.last_name,
        t.unit_number
      FROM payment_requests pr
      JOIN tenants t ON (t.id = $2 OR CONCAT(t.first_name, ' ', t.last_name) = pr.roommate_name)
      WHERE pr.id = $1
        AND pr.status = 'paid'
        AND (pr.tenant_id = $2 OR pr.roommate_name = $3)
    `, [id, tenantId, req.tenant.fullName]);

    if (!payment) {
      return res.status(404).json({
        error: 'Receipt not found or payment not yet completed'
      });
    }

    // Generate receipt data
    const receipt = {
      receiptNumber: `RCP-${payment.year}-${String(payment.month).padStart(2, '0')}-${payment.id}`,
      paymentDate: payment.paid_date,
      tenant: {
        name: `${payment.first_name} ${payment.last_name}`,
        unit: payment.unit_number
      },
      payment: {
        amount: payment.amount,
        type: payment.bill_type,
        period: `${payment.month}/${payment.year}`,
        trackingId: payment.tracking_id
      },
      status: 'PAID'
    };

    res.json({
      success: true,
      data: receipt
    });

  } catch (error) {
    console.error('Get receipt error:', error);
    res.status(500).json({
      error: 'Failed to generate receipt'
    });
  }
});

/**
 * Get payment summary by month
 * GET /api/tenant/payments/summary
 */
router.get('/summary/monthly', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const { year = new Date().getFullYear() } = req.query;

    const summary = await db.getMany(`
      SELECT 
        month,
        year,
        SUM(CASE WHEN status = 'paid' THEN amount ELSE 0 END) as paid_amount,
        SUM(CASE WHEN status IN ('pending', 'sent') THEN amount ELSE 0 END) as pending_amount,
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as paid_count,
        COUNT(CASE WHEN status IN ('pending', 'sent') THEN 1 END) as pending_count
      FROM payment_requests
      WHERE (tenant_id = $1 OR roommate_name = $2)
        AND year = $3
      GROUP BY year, month
      ORDER BY month
    `, [tenantId, req.tenant.fullName, parseInt(year)]);

    res.json({
      success: true,
      data: summary
    });

  } catch (error) {
    console.error('Get payment summary error:', error);
    res.status(500).json({
      error: 'Failed to retrieve payment summary'
    });
  }
});

module.exports = router;