const db = require('../src/db/connection');
const { generateTrackingId } = require('../src/utils/trackingId');

async function updateExistingTrackingIds() {
  try {
    console.log('🔄 Updating existing payment requests with new tracking ID format...\n');
    
    // Get all payment requests without tracking IDs
    const requests = await db.getMany(`
      SELECT id, month, year, bill_type 
      FROM payment_requests 
      WHERE tracking_id IS NULL
      ORDER BY year DESC, month DESC
    `);
    
    console.log(`Found ${requests.length} payment requests without tracking IDs`);
    
    let updated = 0;
    for (const request of requests) {
      const trackingId = generateTrackingId(request.month, request.year, request.bill_type);
      
      // Check if this tracking ID already exists
      const existing = await db.getOne(
        'SELECT id FROM payment_requests WHERE tracking_id = $1',
        [trackingId]
      );
      
      if (existing) {
        console.log(`⚠️  Skipping request ${request.id} - tracking ID ${trackingId} already exists`);
        continue;
      }
      
      await db.query(
        'UPDATE payment_requests SET tracking_id = $1 WHERE id = $2',
        [trackingId, request.id]
      );
      
      console.log(`✅ Updated request ${request.id}: ${trackingId}`);
      updated++;
    }
    
    console.log(`\n✨ Updated ${updated} payment requests with tracking IDs`);
    
    // Show sample of updated requests
    const samples = await db.getMany(`
      SELECT id, tracking_id, month, year, bill_type, amount
      FROM payment_requests 
      WHERE tracking_id IS NOT NULL
      ORDER BY year DESC, month DESC
      LIMIT 5
    `);
    
    console.log('\nSample updated requests:');
    samples.forEach(req => {
      console.log(`  ${req.tracking_id} - $${req.amount}`);
    });
    
    await db.end();
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

updateExistingTrackingIds();