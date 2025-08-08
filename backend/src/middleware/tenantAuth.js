const { verifyAccessToken } = require('../utils/jwt');
const db = require('../db/connection');

/**
 * Middleware to authenticate tenant requests
 */
async function authenticateTenant(req, res, next) {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'No valid authorization header found'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Check if tenant exists and is active
    const tenant = await db.getOne(
      'SELECT * FROM tenants WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (!tenant) {
      return res.status(401).json({
        error: 'Tenant not found or inactive'
      });
    }

    // Check if session is still valid
    const session = await db.getOne(
      `SELECT * FROM tenant_sessions 
       WHERE tenant_id = $1 
       AND is_active = true 
       AND expires_at > NOW()
       ORDER BY created_at DESC
       LIMIT 1`,
      [tenant.id]
    );

    if (!session) {
      return res.status(401).json({
        error: 'Session expired. Please login again.'
      });
    }

    // Attach tenant to request
    req.tenant = {
      id: tenant.id,
      email: tenant.email,
      firstName: tenant.first_name,
      lastName: tenant.last_name,
      fullName: `${tenant.first_name} ${tenant.last_name}`,
      propertyId: tenant.property_id,
      unitNumber: tenant.unit_number
    };

    // Log activity
    await db.query(
      `INSERT INTO tenant_activity_log (tenant_id, action, ip_address, user_agent)
       VALUES ($1, $2, $3, $4)`,
      [
        tenant.id,
        `${req.method} ${req.path}`,
        req.ip,
        req.get('user-agent')
      ]
    );

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.message === 'Access token expired') {
      return res.status(401).json({
        error: 'Token expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    return res.status(401).json({
      error: 'Authentication failed'
    });
  }
}

/**
 * Middleware to optionally authenticate tenant (for public/private endpoints)
 */
async function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // No token provided, continue without authentication
    req.tenant = null;
    return next();
  }

  // Token provided, try to authenticate
  try {
    const token = authHeader.substring(7);
    const decoded = verifyAccessToken(token);
    
    const tenant = await db.getOne(
      'SELECT * FROM tenants WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (tenant) {
      req.tenant = {
        id: tenant.id,
        email: tenant.email,
        firstName: tenant.first_name,
        lastName: tenant.last_name,
        fullName: `${tenant.first_name} ${tenant.last_name}`,
        propertyId: tenant.property_id,
        unitNumber: tenant.unit_number
      };
    }
  } catch (error) {
    // Invalid token, continue without authentication
    req.tenant = null;
  }

  next();
}

module.exports = {
  authenticateTenant,
  optionalAuth
};