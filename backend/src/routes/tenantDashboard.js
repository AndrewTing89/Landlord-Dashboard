const express = require('express');
const db = require('../db/connection');
const { authenticateTenant } = require('../middleware/tenantAuth');

const router = express.Router();

// All routes require authentication
router.use(authenticateTenant);

/**
 * Get tenant dashboard overview
 * GET /api/tenant/dashboard
 */
router.get('/', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const currentDate = new Date();
    const currentMonth = currentDate.getMonth() + 1;
    const currentYear = currentDate.getFullYear();

    // Get current balance
    const balanceQuery = await db.query(`
      SELECT 
        COALESCE(SUM(CASE WHEN status IN ('pending', 'sent') THEN amount ELSE 0 END), 0) as balance_due,
        COUNT(CASE WHEN status IN ('pending', 'sent') THEN 1 END) as pending_payments,
        COUNT(CASE WHEN status = 'paid' AND EXTRACT(MONTH FROM charge_date) = $2 THEN 1 END) as paid_this_month
      FROM payment_requests
      WHERE tenant_id = $1 OR roommate_name = $3
    `, [tenantId, currentMonth, req.tenant.fullName]);

    // Get recent payments
    const recentPayments = await db.getMany(`
      SELECT 
        pr.id,
        pr.amount,
        pr.bill_type,
        pr.status,
        pr.charge_date,
        pr.month,
        pr.year,
        pr.tracking_id
      FROM payment_requests pr
      WHERE (pr.tenant_id = $1 OR pr.roommate_name = $2)
        AND pr.status = 'paid'
      ORDER BY pr.updated_at DESC
      LIMIT 5
    `, [tenantId, req.tenant.fullName]);

    // Get active maintenance requests
    const maintenanceRequests = await db.getMany(`
      SELECT 
        id,
        category,
        priority,
        title,
        status,
        submitted_at,
        CASE 
          WHEN status = 'resolved' THEN resolved_at
          WHEN status = 'in_progress' THEN started_at
          ELSE acknowledged_at
        END as last_update
      FROM maintenance_requests
      WHERE tenant_id = $1
        AND status NOT IN ('resolved', 'cancelled')
      ORDER BY 
        CASE priority 
          WHEN 'emergency' THEN 1
          WHEN 'high' THEN 2
          WHEN 'normal' THEN 3
          WHEN 'low' THEN 4
        END,
        submitted_at DESC
      LIMIT 3
    `, [tenantId]);

    // Get unread notifications count
    const notificationCount = await db.getOne(`
      SELECT COUNT(*) as unread_count
      FROM tenant_notifications
      WHERE tenant_id = $1
        AND is_read = false
        AND (expires_at IS NULL OR expires_at > NOW())
    `, [tenantId]);

    // Get upcoming payment
    const upcomingPayment = await db.getOne(`
      SELECT 
        pr.id,
        pr.amount,
        pr.bill_type,
        pr.charge_date as due_date,
        pr.tracking_id
      FROM payment_requests pr
      WHERE (pr.tenant_id = $1 OR pr.roommate_name = $2)
        AND pr.status IN ('pending', 'sent')
      ORDER BY pr.charge_date ASC
      LIMIT 1
    `, [tenantId, req.tenant.fullName]);

    // Get lease information
    const leaseInfo = await db.getOne(`
      SELECT 
        lease_start,
        lease_end,
        monthly_rent,
        CASE 
          WHEN lease_end < CURRENT_DATE THEN 'expired'
          WHEN lease_end < CURRENT_DATE + INTERVAL '30 days' THEN 'expiring_soon'
          ELSE 'active'
        END as lease_status,
        (lease_end - CURRENT_DATE)::integer as days_remaining
      FROM tenants
      WHERE id = $1
    `, [tenantId]);

    res.json({
      success: true,
      data: {
        balance: {
          totalDue: parseFloat(balanceQuery.rows[0].balance_due),
          pendingPayments: parseInt(balanceQuery.rows[0].pending_payments),
          paidThisMonth: parseInt(balanceQuery.rows[0].paid_this_month)
        },
        recentPayments,
        maintenanceRequests,
        notifications: {
          unreadCount: parseInt(notificationCount?.unread_count || 0)
        },
        upcomingPayment,
        leaseInfo,
        tenant: {
          name: req.tenant.fullName,
          unit: req.tenant.unitNumber,
          email: req.tenant.email
        }
      }
    });

  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({
      error: 'Failed to load dashboard data'
    });
  }
});

/**
 * Get tenant profile
 * GET /api/tenant/profile
 */
router.get('/profile', async (req, res) => {
  try {
    const tenant = await db.getOne(`
      SELECT 
        id,
        email,
        first_name,
        last_name,
        phone,
        unit_number,
        lease_start,
        lease_end,
        monthly_rent,
        security_deposit,
        created_at,
        last_login
      FROM tenants
      WHERE id = $1
    `, [req.tenant.id]);

    if (!tenant) {
      return res.status(404).json({
        error: 'Tenant profile not found'
      });
    }

    res.json({
      success: true,
      data: tenant
    });

  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({
      error: 'Failed to load profile'
    });
  }
});

/**
 * Update tenant profile
 * PUT /api/tenant/profile
 */
router.put('/profile', async (req, res) => {
  try {
    const { phone, emergencyContact, emergencyPhone } = req.body;
    const updates = [];
    const values = [];
    let paramCount = 1;

    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }

    // Add more fields as needed

    if (updates.length === 0) {
      return res.status(400).json({
        error: 'No valid fields to update'
      });
    }

    values.push(req.tenant.id);
    
    await db.query(
      `UPDATE tenants SET ${updates.join(', ')}, updated_at = NOW() WHERE id = $${paramCount}`,
      values
    );

    res.json({
      success: true,
      message: 'Profile updated successfully'
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      error: 'Failed to update profile'
    });
  }
});

/**
 * Get summary statistics
 * GET /api/tenant/stats
 */
router.get('/stats', async (req, res) => {
  try {
    const tenantId = req.tenant.id;
    const currentYear = new Date().getFullYear();

    // Get payment statistics
    const paymentStats = await db.getOne(`
      SELECT 
        COUNT(CASE WHEN status = 'paid' THEN 1 END) as total_payments,
        COALESCE(SUM(CASE WHEN status = 'paid' THEN amount END), 0) as total_paid,
        COALESCE(AVG(CASE 
          WHEN status = 'paid' AND paid_date IS NOT NULL 
          THEN (paid_date - charge_date)::integer
        END), 0) as avg_payment_days,
        COUNT(CASE WHEN status = 'paid' AND EXTRACT(YEAR FROM charge_date) = $2 THEN 1 END) as payments_this_year
      FROM payment_requests
      WHERE tenant_id = $1 OR roommate_name = $3
    `, [tenantId, currentYear, req.tenant.fullName]);

    // Get maintenance statistics
    const maintenanceStats = await db.getOne(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved_requests,
        COUNT(CASE WHEN status NOT IN ('resolved', 'cancelled') THEN 1 END) as active_requests,
        COALESCE(AVG(satisfaction_rating), 0) as avg_satisfaction,
        COALESCE(AVG(
          CASE WHEN resolved_at IS NOT NULL 
          THEN EXTRACT(EPOCH FROM (resolved_at - submitted_at))/3600
          END
        ), 0) as avg_resolution_hours
      FROM maintenance_requests
      WHERE tenant_id = $1
    `, [tenantId]);

    res.json({
      success: true,
      data: {
        payments: {
          totalPayments: parseInt(paymentStats.total_payments),
          totalPaid: parseFloat(paymentStats.total_paid),
          avgPaymentDays: parseFloat(paymentStats.avg_payment_days).toFixed(1),
          paymentsThisYear: parseInt(paymentStats.payments_this_year)
        },
        maintenance: {
          totalRequests: parseInt(maintenanceStats.total_requests),
          resolvedRequests: parseInt(maintenanceStats.resolved_requests),
          activeRequests: parseInt(maintenanceStats.active_requests),
          avgSatisfaction: parseFloat(maintenanceStats.avg_satisfaction).toFixed(1),
          avgResolutionHours: parseFloat(maintenanceStats.avg_resolution_hours).toFixed(1)
        }
      }
    });

  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({
      error: 'Failed to load statistics'
    });
  }
});

module.exports = router;