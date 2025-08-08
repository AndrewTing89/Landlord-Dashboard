const bcrypt = require('bcryptjs');
const db = require('../db/connection');

async function seedTenantData() {
  console.log('🌱 Seeding tenant data...\n');

  try {
    // Create test tenant account
    const passwordHash = await bcrypt.hash('testpassword123', 10);
    
    console.log('Creating test tenant: Ushi Lo');
    const tenantResult = await db.query(`
      INSERT INTO tenants (
        email,
        password_hash,
        first_name,
        last_name,
        phone,
        lease_start,
        lease_end,
        monthly_rent,
        security_deposit,
        unit_number,
        is_active,
        email_verified
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        email_verified = EXCLUDED.email_verified
      RETURNING id
    `, [
      'ushi@example.com',
      passwordHash,
      'Ushi',
      'Lo',
      '555-0123',
      new Date('2024-01-01'),
      new Date('2025-01-01'),
      1685.00,
      1685.00,
      'Unit 1',
      true,
      true // Pre-verified for testing
    ]);

    const tenantId = tenantResult.rows[0].id;
    console.log(`✓ Tenant created with ID: ${tenantId}`);

    // Link existing payment requests to the tenant
    console.log('\nLinking existing payment requests to tenant...');
    const updateResult = await db.query(`
      UPDATE payment_requests 
      SET tenant_id = $1 
      WHERE roommate_name = 'Ushi Lo'
      RETURNING id
    `, [tenantId]);
    console.log(`✓ Linked ${updateResult.rowCount} payment requests`);

    // Create sample maintenance requests
    console.log('\nCreating sample maintenance requests...');
    
    const maintenanceRequests = [
      {
        category: 'plumbing',
        priority: 'high',
        title: 'Bathroom sink leaking',
        description: 'The bathroom sink has been dripping constantly for the past week. Water is pooling under the sink.',
        status: 'in_progress',
        submitted_at: new Date('2024-12-15'),
        acknowledged_at: new Date('2024-12-15T14:00:00'),
        started_at: new Date('2024-12-16T09:00:00')
      },
      {
        category: 'electrical',
        priority: 'normal',
        title: 'Living room outlet not working',
        description: 'The outlet near the TV in the living room stopped working. Other outlets in the room are fine.',
        status: 'submitted',
        submitted_at: new Date('2024-12-20')
      },
      {
        category: 'appliance',
        priority: 'low',
        title: 'Dishwasher making noise',
        description: 'Dishwasher works but makes a grinding noise during the wash cycle.',
        status: 'resolved',
        submitted_at: new Date('2024-11-10'),
        acknowledged_at: new Date('2024-11-11'),
        started_at: new Date('2024-11-15'),
        resolved_at: new Date('2024-11-16'),
        resolution_notes: 'Replaced worn bearing in pump motor',
        satisfaction_rating: 5,
        rating_comments: 'Fixed quickly and works like new!',
        actual_cost: 125.00
      }
    ];

    for (const request of maintenanceRequests) {
      await db.query(`
        INSERT INTO maintenance_requests (
          tenant_id, category, priority, title, description, status,
          submitted_at, acknowledged_at, started_at, resolved_at,
          resolution_notes, satisfaction_rating, rating_comments, actual_cost
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        tenantId, request.category, request.priority, request.title,
        request.description, request.status, request.submitted_at,
        request.acknowledged_at, request.started_at, request.resolved_at,
        request.resolution_notes, request.satisfaction_rating,
        request.rating_comments, request.actual_cost
      ]);
    }
    console.log(`✓ Created ${maintenanceRequests.length} maintenance requests`);

    // Create sample notifications
    console.log('\nCreating sample notifications...');
    
    const notifications = [
      {
        type: 'payment_due',
        title: 'Rent Payment Due',
        message: 'Your monthly rent payment of $1,685 is due on January 1st.',
        priority: 'high'
      },
      {
        type: 'maintenance_update',
        title: 'Maintenance Update',
        message: 'Your bathroom sink repair is scheduled for tomorrow at 9 AM.',
        priority: 'normal'
      },
      {
        type: 'announcement',
        title: 'Holiday Schedule',
        message: 'The management office will be closed from Dec 24-26 for the holidays.',
        priority: 'low'
      }
    ];

    for (const notification of notifications) {
      await db.query(`
        INSERT INTO tenant_notifications (
          tenant_id, type, title, message, priority
        ) VALUES ($1, $2, $3, $4, $5)
      `, [
        tenantId, notification.type, notification.title,
        notification.message, notification.priority
      ]);
    }
    console.log(`✓ Created ${notifications.length} notifications`);

    // Create sample documents
    console.log('\nCreating sample documents...');
    
    const documents = [
      {
        type: 'lease',
        name: 'Lease Agreement 2024',
        path: '/documents/lease-2024.pdf'
      },
      {
        type: 'addendum',
        name: 'Pet Addendum',
        path: '/documents/pet-addendum.pdf'
      },
      {
        type: 'insurance',
        name: 'Renters Insurance Requirements',
        path: '/documents/insurance-requirements.pdf'
      }
    ];

    for (const doc of documents) {
      await db.query(`
        INSERT INTO tenant_documents (
          tenant_id, document_type, document_name, file_path, uploaded_by
        ) VALUES ($1, $2, $3, $4, 'landlord')
      `, [tenantId, doc.type, doc.name, doc.path]);
    }
    console.log(`✓ Created ${documents.length} documents`);

    console.log('\n✅ Tenant data seeding complete!');
    console.log('\n📝 Test credentials:');
    console.log('   Email: ushi@example.com');
    console.log('   Password: testpassword123');
    console.log('   Lease Code: LEASE-2024-01-Unit 1');

  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await db.close();
  }
}

// Run the seeding
seedTenantData();