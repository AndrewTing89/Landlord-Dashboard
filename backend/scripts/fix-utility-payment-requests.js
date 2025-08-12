const db = require('../src/db/connection');

async function fixUtilityPaymentRequests() {
  try {
    console.log('🔧 Fixing utility payment request issues...');
    console.log('=' + '='.repeat(60));
    
    // STEP 1: Fix the database trigger to use proper tracking ID format
    console.log('\n📝 STEP 1: Updating trigger function for proper tracking ID format...');
    
    await db.query(`
      CREATE OR REPLACE FUNCTION create_utility_payment_requests()
      RETURNS TRIGGER AS $$
      DECLARE
        split_amount DECIMAL(10,2);
        roommate_record RECORD;
        month_name TEXT;
        utility_name TEXT;
        tracking_id_value TEXT;
      BEGIN
        -- Only process electricity and water expenses
        IF NEW.expense_type IN ('electricity', 'water') THEN
          -- Calculate split amount (3 ways)
          split_amount := NEW.amount / 3;
          
          -- Get month name
          month_name := CASE EXTRACT(MONTH FROM NEW.date)
            WHEN 1 THEN 'January'
            WHEN 2 THEN 'February'
            WHEN 3 THEN 'March'
            WHEN 4 THEN 'April'
            WHEN 5 THEN 'May'
            WHEN 6 THEN 'June'
            WHEN 7 THEN 'July'
            WHEN 8 THEN 'August'
            WHEN 9 THEN 'September'
            WHEN 10 THEN 'October'
            WHEN 11 THEN 'November'
            WHEN 12 THEN 'December'
          END;
          
          -- Capitalize utility type
          utility_name := CASE NEW.expense_type
            WHEN 'electricity' THEN 'Electricity'
            WHEN 'water' THEN 'Water'
            ELSE INITCAP(NEW.expense_type)
          END;
          
          -- Generate tracking ID in format: YYYY-Month-Utility
          tracking_id_value := CONCAT(
            EXTRACT(YEAR FROM NEW.date),
            '-',
            month_name,
            '-',
            utility_name
          );
          
          -- Create payment requests for roommates
          FOR roommate_record IN 
            SELECT unnest(ARRAY['Ushi Lo', 'Eileen']) as name,
                   unnest(ARRAY['@UshiLo', '@eileen-venmo']) as venmo_username
          LOOP
            INSERT INTO payment_requests (
              utility_bill_id,
              roommate_name,
              venmo_username,
              amount,
              total_amount,
              bill_type,
              status,
              request_date,
              charge_date,
              month,
              year,
              tracking_id,
              venmo_link,
              created_at
            ) VALUES (
              NULL, -- Will be updated if we create utility_bills
              roommate_record.name,
              roommate_record.venmo_username,
              split_amount,
              NEW.amount,
              NEW.expense_type,
              'pending',
              NOW(),
              NEW.date,
              EXTRACT(MONTH FROM NEW.date),
              EXTRACT(YEAR FROM NEW.date),
              tracking_id_value,
              CONCAT('https://venmo.com/', 
                     REPLACE(roommate_record.venmo_username, '@', ''),
                     '?txn=charge&amount=', split_amount,
                     '&note=', tracking_id_value),
              NOW()
            );
          END LOOP;
          
          -- Also create a utility_bills record for tracking
          INSERT INTO utility_bills (
            transaction_id,
            bill_type,
            total_amount,
            split_amount,
            month,
            year,
            payment_requested,
            created_at
          ) VALUES (
            NEW.id,
            NEW.expense_type,
            NEW.amount,
            split_amount,
            EXTRACT(MONTH FROM NEW.date),
            EXTRACT(YEAR FROM NEW.date),
            true,
            NOW()
          );
          
          RAISE NOTICE 'Created payment requests for % bill: $% with tracking ID: %', 
                       NEW.expense_type, NEW.amount, tracking_id_value;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('  ✅ Updated trigger function with proper tracking ID format');
    
    // STEP 2: Fix existing tracking IDs
    console.log('\n📝 STEP 2: Fixing existing tracking IDs...');
    
    const badRequests = await db.query(`
      SELECT id, tracking_id, month, year, bill_type
      FROM payment_requests
      WHERE tracking_id NOT LIKE '%-%-%'
        AND bill_type IN ('electricity', 'water')
    `);
    
    console.log(`  Found ${badRequests.rows.length} payment requests with old format tracking IDs`);
    
    for (const request of badRequests.rows) {
      const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
      ];
      
      const monthName = monthNames[request.month - 1];
      const utilityName = request.bill_type.charAt(0).toUpperCase() + request.bill_type.slice(1);
      const newTrackingId = `${request.year}-${monthName}-${utilityName}`;
      
      await db.query(
        'UPDATE payment_requests SET tracking_id = $1 WHERE id = $2',
        [newTrackingId, request.id]
      );
      
      console.log(`  Updated #${request.id}: ${request.tracking_id} → ${newTrackingId}`);
    }
    
    // STEP 3: Fix Venmo links with proper format
    console.log('\n📝 STEP 3: Regenerating Venmo links...');
    
    const allRequests = await db.query(`
      SELECT id, venmo_username, amount, tracking_id, bill_type, month, year
      FROM payment_requests
      WHERE status = 'pending'
    `);
    
    for (const request of allRequests.rows) {
      // Clean username (remove @ if present)
      const cleanUsername = request.venmo_username.replace('@', '');
      
      // Generate proper note
      const note = `${request.tracking_id}`;
      const encodedNote = encodeURIComponent(note);
      
      // Generate proper Venmo link
      const venmoLink = `https://venmo.com/${cleanUsername}?txn=charge&amount=${parseFloat(request.amount).toFixed(2)}&note=${encodedNote}`;
      
      await db.query(
        'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
        [venmoLink, request.id]
      );
      
      console.log(`  Updated Venmo link for #${request.id}`);
    }
    
    // STEP 4: Ensure all payment requests have total_amount set
    console.log('\n📝 STEP 4: Fixing missing total_amount fields...');
    
    const missingTotals = await db.query(`
      SELECT pr.id, pr.amount, pr.bill_type, ub.total_amount
      FROM payment_requests pr
      LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
      WHERE pr.total_amount IS NULL OR pr.total_amount = 0
    `);
    
    for (const request of missingTotals.rows) {
      // If we have a utility bill, use its total, otherwise calculate from split
      const totalAmount = request.total_amount || (parseFloat(request.amount) * 3);
      
      await db.query(
        'UPDATE payment_requests SET total_amount = $1 WHERE id = $2',
        [totalAmount, request.id]
      );
      
      console.log(`  Set total_amount for #${request.id}: $${totalAmount}`);
    }
    
    // STEP 5: Show summary
    console.log('\n📊 Final Summary:');
    
    const summary = await db.query(`
      SELECT 
        bill_type,
        COUNT(*) as count,
        STRING_AGG(DISTINCT tracking_id, ', ' ORDER BY tracking_id) as tracking_ids
      FROM payment_requests
      GROUP BY bill_type
      ORDER BY bill_type
    `);
    
    summary.rows.forEach(row => {
      console.log(`  ${row.bill_type}: ${row.count} requests`);
      console.log(`    Tracking IDs: ${row.tracking_ids}`);
    });
    
    console.log('\n✅ All issues fixed!');
    console.log('  ✓ Tracking IDs now use consistent format: YYYY-Month-Utility');
    console.log('  ✓ Venmo links regenerated with proper format');
    console.log('  ✓ Total amounts populated for Discord cards');
    console.log('  ✓ Database trigger updated for future requests');
    
  } catch (error) {
    console.error('❌ Error fixing payment requests:', error);
  } finally {
    process.exit(0);
  }
}

fixUtilityPaymentRequests();