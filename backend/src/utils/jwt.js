const jwt = require('jsonwebtoken');
const crypto = require('crypto');

// JWT configuration
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || crypto.randomBytes(32).toString('hex');
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Generate access token for tenant
 */
function generateAccessToken(tenant) {
  const payload = {
    id: tenant.id,
    email: tenant.email,
    firstName: tenant.first_name,
    lastName: tenant.last_name,
    type: 'tenant'
  };

  return jwt.sign(payload, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    issuer: 'landlord-dashboard',
    audience: 'tenant-portal'
  });
}

/**
 * Generate refresh token for tenant
 */
function generateRefreshToken(tenant) {
  const payload = {
    id: tenant.id,
    email: tenant.email,
    type: 'tenant-refresh'
  };

  return jwt.sign(payload, JWT_REFRESH_SECRET, {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    issuer: 'landlord-dashboard',
    audience: 'tenant-portal'
  });
}

/**
 * Verify access token
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'landlord-dashboard',
      audience: 'tenant-portal'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Access token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify refresh token
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'landlord-dashboard',
      audience: 'tenant-portal'
    });
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    }
    if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Generate email verification token
 */
function generateEmailToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Generate password reset token
 */
function generateResetToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateEmailToken,
  generateResetToken,
  JWT_SECRET,
  JWT_REFRESH_SECRET
};