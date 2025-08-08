const express = require('express');
const { body, validationResult } = require('express-validator');
const db = require('../db/connection');
const { authenticateTenant } = require('../middleware/tenantAuth');

const router = express.Router();

// All routes require authentication
router.use(authenticateTenant);

// Validation rules
const validateMaintenanceRequest = [
  body('category').isIn(['plumbing', 'electrical', 'appliance', 'hvac', 'structural', 'other']),
  body('priority').isIn(['emergency', 'high', 'normal', 'low']),
  body('title').trim().notEmpty().isLength({ max: 255 }),
  body('description').trim().notEmpty()
];

/**
 * Get maintenance requests
 * GET /api/tenant/maintenance
 */
router.get('/', async (req, res) => {
  try {
    const { status, priority, limit = 50, offset = 0 } = req.query;
    const tenantId = req.tenant.id;
    
    let query = `
      SELECT 
        id,
        category,
        priority,
        title,
        description,
        status,
        submitted_at,
        acknowledged_at,
        started_at,
        resolved_at,
        resolution_notes,
        satisfaction_rating,
        estimated_cost,
        actual_cost,
        photos,
        CASE 
          WHEN status = 'resolved' THEN resolved_at
          WHEN status = 'in_progress' THEN started_at
          WHEN status = 'acknowledged' THEN acknowledged_at
          ELSE submitted_at
        END as last_update
      FROM maintenance_requests
      WHERE tenant_id = $1
    `;
    
    const params = [tenantId];
    let paramIndex = 2;

    if (status) {
      query += ` AND status = $${paramIndex++}`;
      params.push(status);
    }

    if (priority) {
      query += ` AND priority = $${paramIndex++}`;
      params.push(priority);
    }

    query += ` ORDER BY 
      CASE status 
        WHEN 'submitted' THEN 1
        WHEN 'acknowledged' THEN 2
        WHEN 'in_progress' THEN 3
        WHEN 'pending_parts' THEN 4
        WHEN 'resolved' THEN 5
        WHEN 'cancelled' THEN 6
      END,
      CASE priority 
        WHEN 'emergency' THEN 1
        WHEN 'high' THEN 2
        WHEN 'normal' THEN 3
        WHEN 'low' THEN 4
      END,
      submitted_at DESC`;
    
    query += ` LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
    params.push(parseInt(limit), parseInt(offset));

    const requests = await db.getMany(query, params);

    // Get total count
    let countQuery = `
      SELECT COUNT(*) as total
      FROM maintenance_requests
      WHERE tenant_id = $1
    `;
    
    const countParams = [tenantId];
    let countParamIndex = 2;

    if (status) {
      countQuery += ` AND status = $${countParamIndex++}`;
      countParams.push(status);
    }

    if (priority) {
      countQuery += ` AND priority = $${countParamIndex++}`;
      countParams.push(priority);
    }

    const countResult = await db.getOne(countQuery, countParams);

    res.json({
      success: true,
      data: {
        requests,
        pagination: {
          total: parseInt(countResult.total),
          limit: parseInt(limit),
          offset: parseInt(offset),
          hasMore: parseInt(offset) + requests.length < parseInt(countResult.total)
        }
      }
    });

  } catch (error) {
    console.error('Get maintenance requests error:', error);
    res.status(500).json({
      error: 'Failed to retrieve maintenance requests'
    });
  }
});

/**
 * Submit new maintenance request
 * POST /api/tenant/maintenance
 */
router.post('/', validateMaintenanceRequest, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { category, priority, title, description, photos = [] } = req.body;
    const tenantId = req.tenant.id;

    // Create maintenance request
    const result = await db.query(`
      INSERT INTO maintenance_requests (
        tenant_id, category, priority, title, description, photos, status
      ) VALUES ($1, $2, $3, $4, $5, $6, 'submitted')
      RETURNING *
    `, [tenantId, category, priority, title, description, photos]);

    const request = result.rows[0];

    // Create notification for landlord (future implementation)
    await db.query(`
      INSERT INTO tenant_notifications (
        tenant_id, type, title, message, priority
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      tenantId,
      'maintenance_update',
      'Maintenance Request Submitted',
      `Your ${category} request "${title}" has been submitted and will be reviewed shortly.`,
      priority === 'emergency' ? 'urgent' : 'normal'
    ]);

    // Log activity
    await db.query(`
      INSERT INTO tenant_activity_log (tenant_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      tenantId,
      'MAINTENANCE_SUBMITTED',
      'maintenance',
      request.id,
      JSON.stringify({ category, priority, title })
    ]);

    res.status(201).json({
      success: true,
      data: request,
      message: 'Maintenance request submitted successfully'
    });

  } catch (error) {
    console.error('Submit maintenance request error:', error);
    res.status(500).json({
      error: 'Failed to submit maintenance request'
    });
  }
});

/**
 * Get maintenance request details
 * GET /api/tenant/maintenance/:id
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenant.id;

    const request = await db.getOne(`
      SELECT * 
      FROM maintenance_requests
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    if (!request) {
      return res.status(404).json({
        error: 'Maintenance request not found'
      });
    }

    // Get status history (simplified - could be expanded with a proper history table)
    const statusHistory = [];
    
    if (request.submitted_at) {
      statusHistory.push({
        status: 'submitted',
        timestamp: request.submitted_at,
        note: 'Request submitted'
      });
    }
    
    if (request.acknowledged_at) {
      statusHistory.push({
        status: 'acknowledged',
        timestamp: request.acknowledged_at,
        note: 'Request acknowledged by management'
      });
    }
    
    if (request.started_at) {
      statusHistory.push({
        status: 'in_progress',
        timestamp: request.started_at,
        note: 'Work started'
      });
    }
    
    if (request.resolved_at) {
      statusHistory.push({
        status: 'resolved',
        timestamp: request.resolved_at,
        note: request.resolution_notes || 'Issue resolved'
      });
    }

    res.json({
      success: true,
      data: {
        request,
        statusHistory
      }
    });

  } catch (error) {
    console.error('Get maintenance request error:', error);
    res.status(500).json({
      error: 'Failed to retrieve maintenance request'
    });
  }
});

/**
 * Update maintenance request (cancel or add notes)
 * PUT /api/tenant/maintenance/:id
 */
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { action, notes } = req.body;
    const tenantId = req.tenant.id;

    // Verify request belongs to tenant
    const request = await db.getOne(`
      SELECT * FROM maintenance_requests 
      WHERE id = $1 AND tenant_id = $2
    `, [id, tenantId]);

    if (!request) {
      return res.status(404).json({
        error: 'Maintenance request not found'
      });
    }

    // Handle different actions
    if (action === 'cancel') {
      if (request.status === 'resolved' || request.status === 'cancelled') {
        return res.status(400).json({
          error: 'Cannot cancel a resolved or already cancelled request'
        });
      }

      await db.query(`
        UPDATE maintenance_requests 
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = $1
      `, [id]);

      // Log activity
      await db.query(`
        INSERT INTO tenant_activity_log (tenant_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        tenantId,
        'MAINTENANCE_CANCELLED',
        'maintenance',
        id,
        JSON.stringify({ reason: notes })
      ]);

      return res.json({
        success: true,
        message: 'Maintenance request cancelled'
      });
    }

    // Add notes (future expansion)
    if (notes) {
      // Could implement a notes/comments table
      await db.query(`
        INSERT INTO tenant_activity_log (tenant_id, action, entity_type, entity_id, details)
        VALUES ($1, $2, $3, $4, $5)
      `, [
        tenantId,
        'MAINTENANCE_NOTE_ADDED',
        'maintenance',
        id,
        JSON.stringify({ note: notes })
      ]);
    }

    res.json({
      success: true,
      message: 'Request updated successfully'
    });

  } catch (error) {
    console.error('Update maintenance request error:', error);
    res.status(500).json({
      error: 'Failed to update maintenance request'
    });
  }
});

/**
 * Rate completed maintenance request
 * POST /api/tenant/maintenance/:id/rate
 */
router.post('/:id/rate', [
  body('rating').isInt({ min: 1, max: 5 }),
  body('comments').optional().trim()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { id } = req.params;
    const { rating, comments } = req.body;
    const tenantId = req.tenant.id;

    // Verify request belongs to tenant and is resolved
    const request = await db.getOne(`
      SELECT * FROM maintenance_requests 
      WHERE id = $1 AND tenant_id = $2 AND status = 'resolved'
    `, [id, tenantId]);

    if (!request) {
      return res.status(404).json({
        error: 'Maintenance request not found or not yet resolved'
      });
    }

    if (request.satisfaction_rating) {
      return res.status(400).json({
        error: 'This request has already been rated'
      });
    }

    // Update rating
    await db.query(`
      UPDATE maintenance_requests 
      SET satisfaction_rating = $1, rating_comments = $2, updated_at = NOW()
      WHERE id = $3
    `, [rating, comments, id]);

    // Log activity
    await db.query(`
      INSERT INTO tenant_activity_log (tenant_id, action, entity_type, entity_id, details)
      VALUES ($1, $2, $3, $4, $5)
    `, [
      tenantId,
      'MAINTENANCE_RATED',
      'maintenance',
      id,
      JSON.stringify({ rating, comments })
    ]);

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Rate maintenance request error:', error);
    res.status(500).json({
      error: 'Failed to submit rating'
    });
  }
});

/**
 * Get maintenance statistics
 * GET /api/tenant/maintenance/stats
 */
router.get('/stats/summary', async (req, res) => {
  try {
    const tenantId = req.tenant.id;

    const stats = await db.getOne(`
      SELECT 
        COUNT(*) as total_requests,
        COUNT(CASE WHEN status = 'resolved' THEN 1 END) as resolved,
        COUNT(CASE WHEN status IN ('submitted', 'acknowledged', 'in_progress', 'pending_parts') THEN 1 END) as active,
        COUNT(CASE WHEN priority = 'emergency' THEN 1 END) as emergency_requests,
        COALESCE(AVG(satisfaction_rating), 0) as avg_rating,
        COALESCE(AVG(
          CASE 
            WHEN resolved_at IS NOT NULL AND submitted_at IS NOT NULL
            THEN EXTRACT(EPOCH FROM (resolved_at - submitted_at))/86400
          END
        ), 0) as avg_resolution_days
      FROM maintenance_requests
      WHERE tenant_id = $1
    `, [tenantId]);

    res.json({
      success: true,
      data: {
        totalRequests: parseInt(stats.total_requests),
        resolved: parseInt(stats.resolved),
        active: parseInt(stats.active),
        emergencyRequests: parseInt(stats.emergency_requests),
        avgRating: parseFloat(stats.avg_rating).toFixed(1),
        avgResolutionDays: parseFloat(stats.avg_resolution_days).toFixed(1)
      }
    });

  } catch (error) {
    console.error('Get maintenance stats error:', error);
    res.status(500).json({
      error: 'Failed to retrieve maintenance statistics'
    });
  }
});

module.exports = router;