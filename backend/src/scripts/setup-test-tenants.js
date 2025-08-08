#!/usr/bin/env node

/**
 * Setup Test Tenants Script
 * Creates realistic test tenants with proper data and payment histories
 * 
 * Usage: node src/scripts/setup-test-tenants.js
 */

const db = require('../db/connection');
const bcrypt = require('bcryptjs');

// Configuration for test tenants
const TEST_TENANTS = [
  {
    id: 1, // Update existing tenant
    email: 'ushi@test.com',
    password: 'password123',
    firstName: 'Ushi',
    lastName: 'Lo',
    phone: '555-0101',
    propertyId: 1,
    unitNumber: 'Unit A',
    leaseStart: '2024-01-01',
    leaseEnd: '2025-12-31',
    monthlyRent: 1685.00,
    securityDeposit: 1685.00,
    venmoUsername: '@UshiLo',
    paymentPattern: { onTime: 85, late: 15, early: 0 }, // 85% on-time, 15% late by 2-3 days
    lateDaysRange: [2, 3]
  },
  {
    email: 'alex@test.com',
    password: 'password123',
    firstName: 'Alex',
    lastName: 'Chen',
    phone: '555-0102',
    propertyId: 1,
    unitNumber: 'Unit B',
    leaseStart: '2024-06-01',
    leaseEnd: '2025-06-30',
    monthlyRent: 1685.00,
    securityDeposit: 1685.00,
    venmoUsername: '@AlexChen',
    paymentPattern: { onTime: 95, late: 0, early: 5 }, // 95% on-time, 5% early
    earlyDaysRange: [1, 3]
  },
  {
    email: 'sarah@test.com',
    password: 'password123',
    firstName: 'Sarah',
    lastName: 'Johnson',
    phone: '555-0103',
    propertyId: 2, // ADU property
    unitNumber: 'ADU',
    leaseStart: '2024-03-01',
    leaseEnd: '2025-03-31',
    monthlyRent: 2200.00,
    securityDeposit: 2200.00,
    venmoUsername: '@SarahJ',
    paymentPattern: { onTime: 70, late: 20, partial: 10 }, // 70% on-time, 20% late, 10% partial
    lateDaysRange: [3, 10],
    partialPercentage: [0.5, 0.8] // Pay 50-80% first, rest later
  }
];

// Payment types and their typical amounts/patterns
const PAYMENT_TYPES = {
  rent: {
    frequency: 'monthly',
    dayOfMonth: 1
  },
  electricity: {
    frequency: 'monthly',
    amounts: [80, 120, 150, 200, 250], // Seasonal variation
    splitBy: 3,
    months: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] // All months
  },
  water: {
    frequency: 'bimonthly', 
    amounts: [60, 80, 100, 120],
    splitBy: 3,
    months: [2, 4, 6, 8, 10, 12] // Every other month
  }
};

/**
 * Hash password for database storage
 */
async function hashPassword(password) {
  return await bcrypt.hash(password, 10);
}

/**
 * Generate random date within range
 */
function randomDate(baseDate, daysRange) {
  const base = new Date(baseDate);
  const randomDays = Math.floor(Math.random() * (daysRange[1] - daysRange[0] + 1)) + daysRange[0];
  const result = new Date(base);
  result.setDate(base.getDate() + randomDays);
  return result;
}

/**
 * Determine payment behavior based on tenant pattern
 */
function determinePaymentBehavior(tenant) {
  const rand = Math.random() * 100;
  
  if (rand < tenant.paymentPattern.onTime) {
    return { type: 'on_time', status: 'paid' };
  } else if (tenant.paymentPattern.early && rand < tenant.paymentPattern.onTime + tenant.paymentPattern.early) {
    return { type: 'early', status: 'paid' };
  } else if (tenant.paymentPattern.late && rand < tenant.paymentPattern.onTime + (tenant.paymentPattern.early || 0) + tenant.paymentPattern.late) {
    return { type: 'late', status: 'paid' };
  } else if (tenant.paymentPattern.partial) {
    return { type: 'partial', status: 'pending' };
  }
  
  return { type: 'pending', status: 'pending' };
}

/**
 * Create ADU property if it doesn't exist
 */
async function createADUProperty() {
  console.log('Creating ADU property...');
  
  const result = await db.query(`
    INSERT INTO properties (name, address, city, state, zip_code, rent_amount, is_active)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    ON CONFLICT DO NOTHING
    RETURNING id
  `, [
    'ADU Property',
    '123 Main Street ADU',
    'San Francisco',
    'CA',
    '94102',
    2200.00,
    true
  ]);
  
  // Check if property exists
  const existing = await db.query('SELECT id FROM properties WHERE name = $1', ['ADU Property']);
  const propertyId = result.rows[0]?.id || existing.rows[0]?.id;
  
  console.log(`✓ ADU property created/exists with ID: ${propertyId}`);
  return propertyId;
}

/**
 * Create or update tenant
 */
async function createTenant(tenantData) {
  const hashedPassword = await hashPassword(tenantData.password);
  
  if (tenantData.id) {
    // Update existing tenant
    console.log(`Updating existing tenant: ${tenantData.firstName} ${tenantData.lastName}`);
    
    await db.query(`
      UPDATE tenants 
      SET 
        email = $1,
        password_hash = $2,
        first_name = $3,
        last_name = $4,
        phone = $5,
        lease_start = $6,
        lease_end = $7,
        monthly_rent = $8,
        security_deposit = $9,
        property_id = $10,
        unit_number = $11,
        is_active = true,
        email_verified = true,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $12
    `, [
      tenantData.email,
      hashedPassword,
      tenantData.firstName,
      tenantData.lastName,
      tenantData.phone,
      tenantData.leaseStart,
      tenantData.leaseEnd,
      tenantData.monthlyRent,
      tenantData.securityDeposit,
      tenantData.propertyId,
      tenantData.unitNumber,
      tenantData.id
    ]);
    
    return tenantData.id;
  } else {
    // Create new tenant
    console.log(`Creating new tenant: ${tenantData.firstName} ${tenantData.lastName}`);
    
    const result = await db.query(`
      INSERT INTO tenants (
        email, password_hash, first_name, last_name, phone,
        lease_start, lease_end, monthly_rent, security_deposit,
        property_id, unit_number, is_active, email_verified
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, true, true)
      RETURNING id
    `, [
      tenantData.email,
      hashedPassword,
      tenantData.firstName,
      tenantData.lastName,
      tenantData.phone,
      tenantData.leaseStart,
      tenantData.leaseEnd,
      tenantData.monthlyRent,
      tenantData.securityDeposit,
      tenantData.propertyId,
      tenantData.unitNumber
    ]);
    
    return result.rows[0].id;
  }
}

/**
 * Generate tracking ID for payment request
 */
function generateTrackingId(year, month, type, tenantId) {
  const monthStr = month.toString().padStart(2, '0');
  return `${year}${monthStr}${type}_t${tenantId}`;
}

/**
 * Generate payment requests for a tenant
 */
async function generatePaymentHistory(tenant, tenantId) {
  console.log(`Generating payment history for ${tenant.firstName} ${tenant.lastName}...`);
  
  const leaseStart = new Date(tenant.leaseStart);
  const currentDate = new Date();
  const requestsCreated = [];
  
  // Generate monthly rent payments from Jan 2025 to current month
  for (let year = 2025; year <= currentDate.getFullYear(); year++) {
    const startMonth = year === 2025 ? 1 : 1;
    const endMonth = year === currentDate.getFullYear() ? currentDate.getMonth() + 1 : 12;
    
    for (let month = startMonth; month <= endMonth; month++) {
      // Skip months before lease start
      const paymentDate = new Date(year, month - 1, 1);
      if (paymentDate < leaseStart) continue;
      
      // Skip future months
      if (paymentDate > currentDate) continue;
      
      // Create rent payment request
      const behavior = determinePaymentBehavior(tenant);
      let dueDate = new Date(year, month - 1, 1);
      let paidDate = null;
      
      if (behavior.type === 'early' && tenant.earlyDaysRange) {
        paidDate = randomDate(dueDate, [-tenant.earlyDaysRange[1], -tenant.earlyDaysRange[0]]);
      } else if (behavior.type === 'late' && tenant.lateDaysRange) {
        paidDate = randomDate(dueDate, tenant.lateDaysRange);
      } else if (behavior.type === 'on_time') {
        paidDate = new Date(dueDate);
        paidDate.setDate(paidDate.getDate() + Math.floor(Math.random() * 2)); // 0-1 day variation
      }
      
      const rentRequest = await db.query(`
        INSERT INTO payment_requests (
          tenant_id, property_id, amount, total_amount, bill_type, month, year,
          status, tracking_id, charge_date, paid_date, roommate_name, venmo_username,
          venmo_link, created_at, request_date
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT (tracking_id) DO NOTHING
        RETURNING id
      `, [
        tenantId,
        tenant.propertyId,
        tenant.monthlyRent,
        tenant.monthlyRent,
        'rent',
        month,
        year,
        behavior.status,
        generateTrackingId(year, month, 'rent', tenantId),
        dueDate,
        paidDate,
        `${tenant.firstName} ${tenant.lastName}`,
        tenant.venmoUsername,
        `https://venmo.com/code?user_id=yourvenmo&amount=${tenant.monthlyRent}&note=Rent%20${year}-${month.toString().padStart(2, '0')}`,
        new Date(year, month - 1, Math.floor(Math.random() * 5) + 1), // Created 1-5 days into month
        dueDate // request_date same as charge_date for rent
      ]);
      
      if (rentRequest.rows.length > 0) {
        requestsCreated.push('rent');
      }
      
      // Generate utility bills (only for property_id 1 - main house with roommates)
      if (tenant.propertyId === 1) {
        // Electricity (monthly)
        if (PAYMENT_TYPES.electricity.months.includes(month)) {
          const amount = PAYMENT_TYPES.electricity.amounts[Math.floor(Math.random() * PAYMENT_TYPES.electricity.amounts.length)];
          const splitAmount = amount / PAYMENT_TYPES.electricity.splitBy;
          const utilBehavior = determinePaymentBehavior(tenant);
          let utilPaidDate = null;
          
          if (utilBehavior.status === 'paid') {
            utilPaidDate = randomDate(new Date(year, month - 1, 15), [0, 10]); // Pay within 10 days of bill date
          }
          
          const elecRequest = await db.query(`
            INSERT INTO payment_requests (
              tenant_id, property_id, amount, total_amount, bill_type, month, year,
              status, tracking_id, charge_date, paid_date, roommate_name, venmo_username,
              venmo_link, created_at, request_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (tracking_id) DO NOTHING
            RETURNING id
          `, [
            tenantId,
            tenant.propertyId,
            splitAmount,
            amount,
            'electricity',
            month,
            year,
            utilBehavior.status,
            generateTrackingId(year, month, 'electricity', tenantId),
            new Date(year, month - 1, 15),
            utilPaidDate,
            `${tenant.firstName} ${tenant.lastName}`,
            tenant.venmoUsername,
            `https://venmo.com/code?user_id=yourvenmo&amount=${splitAmount.toFixed(2)}&note=Electricity%20${year}-${month.toString().padStart(2, '0')}`,
            new Date(year, month - 1, 15 + Math.floor(Math.random() * 3)),
            new Date(year, month - 1, 15) // request_date same as charge_date
          ]);
          
          if (elecRequest.rows.length > 0) {
            requestsCreated.push('electricity');
          }
        }
        
        // Water (bimonthly)
        if (PAYMENT_TYPES.water.months.includes(month)) {
          const amount = PAYMENT_TYPES.water.amounts[Math.floor(Math.random() * PAYMENT_TYPES.water.amounts.length)];
          const splitAmount = amount / PAYMENT_TYPES.water.splitBy;
          const waterBehavior = determinePaymentBehavior(tenant);
          let waterPaidDate = null;
          
          if (waterBehavior.status === 'paid') {
            waterPaidDate = randomDate(new Date(year, month - 1, 20), [0, 10]);
          }
          
          const waterRequest = await db.query(`
            INSERT INTO payment_requests (
              tenant_id, property_id, amount, total_amount, bill_type, month, year,
              status, tracking_id, charge_date, paid_date, roommate_name, venmo_username,
              venmo_link, created_at, request_date
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
            ON CONFLICT (tracking_id) DO NOTHING
            RETURNING id
          `, [
            tenantId,
            tenant.propertyId,
            splitAmount,
            amount,
            'water',
            month,
            year,
            waterBehavior.status,
            generateTrackingId(year, month, 'water', tenantId),
            new Date(year, month - 1, 20),
            waterPaidDate,
            `${tenant.firstName} ${tenant.lastName}`,
            tenant.venmoUsername,
            `https://venmo.com/code?user_id=yourvenmo&amount=${splitAmount.toFixed(2)}&note=Water%20${year}-${month.toString().padStart(2, '0')}`,
            new Date(year, month - 1, 20 + Math.floor(Math.random() * 3)),
            new Date(year, month - 1, 20) // request_date same as charge_date
          ]);
          
          if (waterRequest.rows.length > 0) {
            requestsCreated.push('water');
          }
        }
      }
    }
  }
  
  console.log(`✓ Generated ${requestsCreated.length} payment requests for ${tenant.firstName}`);
  return requestsCreated.length;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🏠 Setting up test tenants and payment histories...\n');
    
    // Create ADU property first
    await createADUProperty();
    console.log('');
    
    const stats = {
      tenantsCreated: 0,
      tenantsUpdated: 0,
      totalPaymentRequests: 0,
      paymentPatterns: {}
    };
    
    // Process each tenant
    for (const tenantData of TEST_TENANTS) {
      console.log(`Processing ${tenantData.firstName} ${tenantData.lastName}...`);
      
      // Create/update tenant
      const tenantId = await createTenant(tenantData);
      
      if (tenantData.id) {
        stats.tenantsUpdated++;
      } else {
        stats.tenantsCreated++;
      }
      
      // Generate payment history
      const paymentCount = await generatePaymentHistory(tenantData, tenantId);
      stats.totalPaymentRequests += paymentCount;
      
      // Track payment patterns
      stats.paymentPatterns[`${tenantData.firstName} ${tenantData.lastName}`] = {
        pattern: tenantData.paymentPattern,
        requestsGenerated: paymentCount
      };
      
      console.log('');
    }
    
    // Final summary
    console.log('📊 SETUP COMPLETE - SUMMARY:');
    console.log('================================');
    console.log(`✓ Tenants created: ${stats.tenantsCreated}`);
    console.log(`✓ Tenants updated: ${stats.tenantsUpdated}`);
    console.log(`✓ Total payment requests generated: ${stats.totalPaymentRequests}`);
    console.log('');
    console.log('Payment Patterns Created:');
    for (const [tenant, info] of Object.entries(stats.paymentPatterns)) {
      console.log(`  ${tenant}:`);
      console.log(`    - Pattern: ${JSON.stringify(info.pattern)}`);
      console.log(`    - Requests: ${info.requestsGenerated}`);
    }
    
    // Verify tenant login credentials
    console.log('');
    console.log('🔐 Test Tenant Login Credentials:');
    console.log('================================');
    for (const tenant of TEST_TENANTS) {
      console.log(`${tenant.firstName} ${tenant.lastName}: ${tenant.email} / ${tenant.password}`);
    }
    
  } catch (error) {
    console.error('❌ Error during setup:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

// Run the script
if (require.main === module) {
  main();
}

module.exports = { main, TEST_TENANTS };