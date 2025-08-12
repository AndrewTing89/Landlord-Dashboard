const db = require('../src/db/connection');

async function fixDuplicatePaymentRequests() {
  try {
    console.log('🔧 Fixing duplicate payment requests and bill dates...');
    console.log('=' + '='.repeat(60));
    
    // STEP 1: Identify duplicates
    console.log('\n📝 STEP 1: Identifying duplicate payment requests...');
    
    const duplicates = await db.query(`
      SELECT 
        bill_type, 
        month, 
        year, 
        amount, 
        roommate_name,
        COUNT(*) as count,
        STRING_AGG(id::text, ', ' ORDER BY id) as ids,
        MIN(id) as keep_id,
        MIN(charge_date) as charge_date
      FROM payment_requests
      WHERE bill_type IN ('electricity', 'water')
      GROUP BY bill_type, month, year, amount, roommate_name
      HAVING COUNT(*) > 1
      ORDER BY year, month, bill_type, roommate_name
    `);
    
    console.log(`  Found ${duplicates.rows.length} sets of duplicates`);
    
    // STEP 2: Remove duplicates (keep the first one)
    console.log('\n📝 STEP 2: Removing duplicate payment requests...');
    
    let totalDeleted = 0;
    for (const dup of duplicates.rows) {
      const idsArray = dup.ids.split(', ').map(id => parseInt(id));
      const toDelete = idsArray.filter(id => id !== parseInt(dup.keep_id));
      
      if (toDelete.length > 0) {
        await db.query(
          `DELETE FROM payment_requests WHERE id = ANY($1)`,
          [toDelete]
        );
        
        console.log(`  Deleted ${toDelete.length} duplicates for ${dup.bill_type} ${dup.month}/${dup.year} - ${dup.roommate_name}`);
        console.log(`    Kept ID: ${dup.keep_id}, Deleted IDs: ${toDelete.join(', ')}`);
        totalDeleted += toDelete.length;
      }
    }
    
    console.log(`  ✅ Deleted ${totalDeleted} duplicate payment requests`);
    
    // STEP 3: Add unique constraint to prevent future duplicates
    console.log('\n📝 STEP 3: Adding unique constraint to prevent future duplicates...');
    
    // First check if constraint already exists
    const constraintExists = await db.query(`
      SELECT 1 FROM pg_constraint 
      WHERE conname = 'payment_requests_unique_bill'
    `);
    
    if (constraintExists.rows.length === 0) {
      await db.query(`
        ALTER TABLE payment_requests
        ADD CONSTRAINT payment_requests_unique_bill
        UNIQUE (bill_type, month, year, roommate_name, amount)
      `);
      console.log('  ✅ Added unique constraint to prevent duplicates');
    } else {
      console.log('  ℹ️  Unique constraint already exists');
    }
    
    // STEP 4: Fix missing charge_date values
    console.log('\n📝 STEP 4: Fixing missing charge_date values...');
    
    // First, update payment requests to have charge_date from related expenses
    const missingDates = await db.query(`
      SELECT pr.id, pr.month, pr.year, pr.bill_type, e.date as expense_date
      FROM payment_requests pr
      LEFT JOIN utility_bills ub ON pr.utility_bill_id = ub.id
      LEFT JOIN expenses e ON e.expense_type = pr.bill_type 
        AND EXTRACT(MONTH FROM e.date) = pr.month 
        AND EXTRACT(YEAR FROM e.date) = pr.year
      WHERE pr.charge_date IS NULL
        AND e.date IS NOT NULL
    `);
    
    console.log(`  Found ${missingDates.rows.length} payment requests with missing charge_date`);
    
    for (const request of missingDates.rows) {
      await db.query(
        `UPDATE payment_requests SET charge_date = $1 WHERE id = $2`,
        [request.expense_date, request.id]
      );
      console.log(`  Updated charge_date for ID ${request.id}: ${request.expense_date}`);
    }
    
    // For any still missing, use a constructed date based on month/year
    const stillMissing = await db.query(`
      SELECT id, month, year, bill_type
      FROM payment_requests
      WHERE charge_date IS NULL
    `);
    
    for (const request of stillMissing.rows) {
      // Use the 10th of the month as a reasonable default
      const constructedDate = new Date(request.year, request.month - 1, 10);
      await db.query(
        `UPDATE payment_requests SET charge_date = $1 WHERE id = $2`,
        [constructedDate, request.id]
      );
      console.log(`  Set default charge_date for ID ${request.id}: ${constructedDate.toISOString().split('T')[0]}`);
    }
    
    // STEP 5: Update the trigger to prevent duplicates in the future
    console.log('\n📝 STEP 5: Updating database trigger to prevent duplicates...');
    
    await db.query(`
      CREATE OR REPLACE FUNCTION create_utility_payment_requests()
      RETURNS TRIGGER AS $$
      DECLARE
        split_amount DECIMAL(10,2);
        roommate_record RECORD;
        month_name TEXT;
        month_abbrev TEXT;
        utility_name TEXT;
        tracking_id_value TEXT;
        venmo_link_value TEXT;
        note_text TEXT;
        existing_id INTEGER;
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
          
          -- Get abbreviated month name
          month_abbrev := CASE EXTRACT(MONTH FROM NEW.date)
            WHEN 1 THEN 'Jan'
            WHEN 2 THEN 'Feb'
            WHEN 3 THEN 'Mar'
            WHEN 4 THEN 'Apr'
            WHEN 5 THEN 'May'
            WHEN 6 THEN 'Jun'
            WHEN 7 THEN 'Jul'
            WHEN 8 THEN 'Aug'
            WHEN 9 THEN 'Sep'
            WHEN 10 THEN 'Oct'
            WHEN 11 THEN 'Nov'
            WHEN 12 THEN 'Dec'
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
            -- Check if payment request already exists
            SELECT id INTO existing_id
            FROM payment_requests
            WHERE bill_type = NEW.expense_type
              AND month = EXTRACT(MONTH FROM NEW.date)
              AND year = EXTRACT(YEAR FROM NEW.date)
              AND roommate_name = roommate_record.name
              AND amount = split_amount
            LIMIT 1;
            
            -- Only create if it doesn't exist
            IF existing_id IS NULL THEN
              -- Generate note based on expense type
              IF NEW.expense_type = 'electricity' THEN
                note_text := CONCAT(tracking_id_value, ' - PG&E bill for ', month_abbrev, ' ', 
                                   EXTRACT(YEAR FROM NEW.date), ': Total $', NEW.amount, 
                                   ', your share is $', split_amount, ' (1/3). I''ve already paid the full amount.');
              ELSIF NEW.expense_type = 'water' THEN
                note_text := CONCAT(tracking_id_value, ' - Water bill for ', month_abbrev, ' ', 
                                   EXTRACT(YEAR FROM NEW.date), ': Total $', NEW.amount, 
                                   ', your share is $', split_amount, ' (1/3). I''ve already paid the full amount.');
              END IF;
              
              -- Generate Venmo link in new format
              venmo_link_value := CONCAT(
                'https://account.venmo.com/payment-link?amount=', split_amount,
                '&note=', REPLACE(REPLACE(REPLACE(note_text, ' ', '%20'), '''', '%27'), '$', '%24'),
                '&recipients=', REPLACE(roommate_record.venmo_username, '@', ''),
                '&txn=charge'
              );
              
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
                venmo_link_value,
                NOW()
              );
              
              RAISE NOTICE 'Created payment request for % - %', roommate_record.name, NEW.expense_type;
            ELSE
              RAISE NOTICE 'Payment request already exists for % - %', roommate_record.name, NEW.expense_type;
            END IF;
          END LOOP;
          
          -- Also create a utility_bills record for tracking (if it doesn't exist)
          IF NOT EXISTS (
            SELECT 1 FROM utility_bills 
            WHERE bill_type = NEW.expense_type
              AND month = EXTRACT(MONTH FROM NEW.date)
              AND year = EXTRACT(YEAR FROM NEW.date)
          ) THEN
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
          END IF;
          
          RAISE NOTICE 'Processed % bill: $% with tracking ID: %', 
                       NEW.expense_type, NEW.amount, tracking_id_value;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('  ✅ Updated trigger to check for existing payment requests');
    
    // STEP 6: Show final summary
    console.log('\n📊 Final Summary:');
    
    const summary = await db.query(`
      SELECT 
        bill_type,
        COUNT(DISTINCT CONCAT(month, '-', year, '-', roommate_name)) as unique_bills,
        COUNT(*) as total_requests,
        MIN(charge_date) as earliest_date,
        MAX(charge_date) as latest_date
      FROM payment_requests
      GROUP BY bill_type
      ORDER BY bill_type
    `);
    
    summary.rows.forEach(row => {
      console.log(`  ${row.bill_type}: ${row.total_requests} requests (${row.unique_bills} unique bills)`);
      if (row.earliest_date) {
        console.log(`    Date range: ${row.earliest_date.toISOString().split('T')[0]} to ${row.latest_date.toISOString().split('T')[0]}`);
      }
    });
    
    console.log('\n✅ All issues fixed!');
    console.log('  ✓ Removed duplicate payment requests');
    console.log('  ✓ Added unique constraint to prevent future duplicates');
    console.log('  ✓ Fixed missing charge_date values');
    console.log('  ✓ Updated trigger to check for existing requests');
    
  } catch (error) {
    console.error('❌ Error fixing payment requests:', error);
  } finally {
    process.exit(0);
  }
}

fixDuplicatePaymentRequests();