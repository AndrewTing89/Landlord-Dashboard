const express = require('express');
const bcrypt = require('bcryptjs');
const { body, validationResult } = require('express-validator');
const crypto = require('crypto');
const db = require('../db/connection');
const {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  generateEmailToken,
  generateResetToken
} = require('../utils/jwt');

const router = express.Router();

// Validation rules
const validateRegister = [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('firstName').trim().notEmpty(),
  body('lastName').trim().notEmpty(),
  body('phone').optional().isMobilePhone(),
  body('leaseCode').trim().notEmpty().withMessage('Lease code is required')
];

const validateLogin = [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty()
];

const validateResetPassword = [
  body('token').notEmpty(),
  body('newPassword').isLength({ min: 8 })
];

/**
 * Register new tenant
 * POST /api/tenant/auth/register
 */
router.post('/register', validateRegister, async (req, res) => {
  try {
    // Check validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password, firstName, lastName, phone, leaseCode } = req.body;

    // Verify lease code (format: LEASE-YYYY-MM-UNITNUMBER)
    // This would be provided by landlord when tenant signs lease
    const leasePattern = /^LEASE-\d{4}-\d{2}-\w+$/;
    if (!leasePattern.test(leaseCode)) {
      return res.status(400).json({
        error: 'Invalid lease code format'
      });
    }

    // Check if email already exists
    const existingTenant = await db.getOne(
      'SELECT id FROM tenants WHERE email = $1',
      [email]
    );

    if (existingTenant) {
      return res.status(409).json({
        error: 'An account with this email already exists'
      });
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate verification token
    const verificationToken = generateEmailToken();

    // Parse lease code to get dates
    const [, year, month, unitNumber] = leaseCode.split('-');
    const leaseStart = new Date(parseInt(year), parseInt(month) - 1, 1);
    const leaseEnd = new Date(parseInt(year) + 1, parseInt(month) - 1, 0); // 1 year lease

    // Create tenant account
    const result = await db.query(
      `INSERT INTO tenants (
        email, password_hash, first_name, last_name, phone,
        lease_start, lease_end, monthly_rent, unit_number,
        verification_token, email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id, email, first_name, last_name`,
      [
        email, passwordHash, firstName, lastName, phone,
        leaseStart, leaseEnd, 1685, unitNumber, // Default rent amount
        verificationToken, false
      ]
    );

    const tenant = result.rows[0];

    // TODO: Send verification email
    console.log(`Verification link: /verify-email?token=${verificationToken}`);

    res.status(201).json({
      success: true,
      message: 'Account created successfully. Please check your email to verify your account.',
      tenant: {
        id: tenant.id,
        email: tenant.email,
        firstName: tenant.first_name,
        lastName: tenant.last_name
      }
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      error: 'Failed to create account'
    });
  }
});

/**
 * Login tenant
 * POST /api/tenant/auth/login
 */
router.post('/login', validateLogin, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email, password } = req.body;

    // Find tenant
    const tenant = await db.getOne(
      'SELECT * FROM tenants WHERE email = $1 AND is_active = true',
      [email]
    );

    if (!tenant) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, tenant.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({
        error: 'Invalid email or password'
      });
    }

    // Check if email is verified
    if (!tenant.email_verified) {
      return res.status(403).json({
        error: 'Please verify your email before logging in',
        code: 'EMAIL_NOT_VERIFIED'
      });
    }

    // Generate tokens
    const accessToken = generateAccessToken(tenant);
    const refreshToken = generateRefreshToken(tenant);

    // Create session
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    await db.query(
      `INSERT INTO tenant_sessions (
        tenant_id, token_hash, ip_address, user_agent, expires_at
      ) VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days')`,
      [
        tenant.id,
        tokenHash,
        req.ip,
        req.get('user-agent')
      ]
    );

    // Update last login
    await db.query(
      'UPDATE tenants SET last_login = NOW() WHERE id = $1',
      [tenant.id]
    );

    // Log activity
    await db.query(
      `INSERT INTO tenant_activity_log (tenant_id, action, details, ip_address, user_agent)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        tenant.id,
        'LOGIN',
        JSON.stringify({ email }),
        req.ip,
        req.get('user-agent')
      ]
    );

    res.json({
      success: true,
      accessToken,
      refreshToken,
      tenant: {
        id: tenant.id,
        email: tenant.email,
        firstName: tenant.first_name,
        lastName: tenant.last_name,
        unitNumber: tenant.unit_number
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      error: 'Login failed'
    });
  }
});

/**
 * Refresh access token
 * POST /api/tenant/auth/refresh
 */
router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        error: 'Refresh token required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Check if session exists
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const session = await db.getOne(
      `SELECT * FROM tenant_sessions 
       WHERE tenant_id = $1 
       AND token_hash = $2 
       AND is_active = true 
       AND expires_at > NOW()`,
      [decoded.id, tokenHash]
    );

    if (!session) {
      return res.status(401).json({
        error: 'Invalid or expired refresh token'
      });
    }

    // Get tenant
    const tenant = await db.getOne(
      'SELECT * FROM tenants WHERE id = $1 AND is_active = true',
      [decoded.id]
    );

    if (!tenant) {
      return res.status(401).json({
        error: 'Tenant not found'
      });
    }

    // Generate new access token
    const accessToken = generateAccessToken(tenant);

    res.json({
      success: true,
      accessToken
    });

  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({
      error: 'Failed to refresh token'
    });
  }
});

/**
 * Logout tenant
 * POST /api/tenant/auth/logout
 */
router.post('/logout', async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      // Revoke the session
      const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
      await db.query(
        `UPDATE tenant_sessions 
         SET is_active = false, revoked_at = NOW()
         WHERE token_hash = $1`,
        [tokenHash]
      );
    }

    res.json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      error: 'Logout failed'
    });
  }
});

/**
 * Request password reset
 * POST /api/tenant/auth/forgot-password
 */
router.post('/forgot-password', body('email').isEmail(), async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { email } = req.body;

    // Find tenant
    const tenant = await db.getOne(
      'SELECT id, email, first_name FROM tenants WHERE email = $1 AND is_active = true',
      [email]
    );

    // Always return success to prevent email enumeration
    if (!tenant) {
      return res.json({
        success: true,
        message: 'If an account exists with this email, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = generateResetToken();
    const resetExpires = new Date(Date.now() + 3600000); // 1 hour

    // Save reset token
    await db.query(
      'UPDATE tenants SET reset_token = $1, reset_token_expires = $2 WHERE id = $3',
      [resetToken, resetExpires, tenant.id]
    );

    // TODO: Send reset email
    console.log(`Password reset link: /reset-password?token=${resetToken}`);

    res.json({
      success: true,
      message: 'If an account exists with this email, a password reset link has been sent.'
    });

  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      error: 'Failed to process request'
    });
  }
});

/**
 * Reset password
 * POST /api/tenant/auth/reset-password
 */
router.post('/reset-password', validateResetPassword, async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { token, newPassword } = req.body;

    // Find tenant with valid reset token
    const tenant = await db.getOne(
      `SELECT id FROM tenants 
       WHERE reset_token = $1 
       AND reset_token_expires > NOW()
       AND is_active = true`,
      [token]
    );

    if (!tenant) {
      return res.status(400).json({
        error: 'Invalid or expired reset token'
      });
    }

    // Hash new password
    const passwordHash = await bcrypt.hash(newPassword, 10);

    // Update password and clear reset token
    await db.query(
      `UPDATE tenants 
       SET password_hash = $1, reset_token = NULL, reset_token_expires = NULL
       WHERE id = $2`,
      [passwordHash, tenant.id]
    );

    // Revoke all existing sessions
    await db.query(
      'UPDATE tenant_sessions SET is_active = false WHERE tenant_id = $1',
      [tenant.id]
    );

    res.json({
      success: true,
      message: 'Password reset successfully. Please login with your new password.'
    });

  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      error: 'Failed to reset password'
    });
  }
});

/**
 * Verify email
 * GET /api/tenant/auth/verify-email
 */
router.get('/verify-email', async (req, res) => {
  try {
    const { token } = req.query;

    if (!token) {
      return res.status(400).json({
        error: 'Verification token required'
      });
    }

    // Find tenant with verification token
    const tenant = await db.getOne(
      'SELECT id FROM tenants WHERE verification_token = $1',
      [token]
    );

    if (!tenant) {
      return res.status(400).json({
        error: 'Invalid verification token'
      });
    }

    // Mark email as verified
    await db.query(
      'UPDATE tenants SET email_verified = true, verification_token = NULL WHERE id = $1',
      [tenant.id]
    );

    res.json({
      success: true,
      message: 'Email verified successfully. You can now login.'
    });

  } catch (error) {
    console.error('Email verification error:', error);
    res.status(500).json({
      error: 'Failed to verify email'
    });
  }
});

module.exports = router;