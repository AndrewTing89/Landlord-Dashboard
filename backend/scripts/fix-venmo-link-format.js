const db = require('../src/db/connection');

async function fixVenmoLinkFormat() {
  try {
    console.log('🔧 Fixing Venmo link format to use account.venmo.com/payment-link...');
    console.log('=' + '='.repeat(60));
    
    // Get all pending payment requests
    const requests = await db.query(`
      SELECT 
        id, 
        venmo_username, 
        amount, 
        total_amount,
        tracking_id, 
        bill_type, 
        month, 
        year,
        roommate_name
      FROM payment_requests
      WHERE status = 'pending'
      ORDER BY year, month, bill_type
    `);
    
    console.log(`\n📝 Found ${requests.rows.length} pending payment requests to update\n`);
    
    for (const request of requests.rows) {
      // Clean username (remove @ if present)
      const cleanUsername = request.venmo_username.replace('@', '');
      
      // Format the amount
      const amount = parseFloat(request.amount).toFixed(2);
      const totalAmount = parseFloat(request.total_amount || (request.amount * 3)).toFixed(2);
      
      // Get month name for the note
      const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
      ];
      const monthName = monthNames[request.month - 1];
      
      // Create a detailed note based on bill type
      let note = '';
      if (request.bill_type === 'electricity') {
        note = `${request.tracking_id} - PG&E bill for ${monthName} ${request.year}: Total $${totalAmount}, your share is $${amount} (1/3). I've already paid the full amount.`;
      } else if (request.bill_type === 'water') {
        note = `${request.tracking_id} - Water bill for ${monthName} ${request.year}: Total $${totalAmount}, your share is $${amount} (1/3). I've already paid the full amount.`;
      } else if (request.bill_type === 'internet') {
        note = `${request.tracking_id} - Internet bill for ${monthName} ${request.year}: Total $${totalAmount}, your share is $${amount} (1/3). I've already paid the full amount.`;
      } else if (request.bill_type === 'rent') {
        note = `${request.tracking_id} - Monthly rent for ${monthName} ${request.year}: $${amount}`;
      } else {
        note = `${request.tracking_id} - ${request.bill_type} for ${monthName} ${request.year}: $${amount}`;
      }
      
      // URL encode the note
      const encodedNote = encodeURIComponent(note);
      
      // Generate the new format Venmo link
      const venmoLink = `https://account.venmo.com/payment-link?amount=${amount}&note=${encodedNote}&recipients=${cleanUsername}&txn=charge`;
      
      // Update the database
      await db.query(
        'UPDATE payment_requests SET venmo_link = $1 WHERE id = $2',
        [venmoLink, request.id]
      );
      
      console.log(`✅ Updated #${request.id} (${request.tracking_id})`);
      console.log(`   Amount: $${amount}`);
      console.log(`   Recipient: ${cleanUsername}`);
      console.log(`   Note: ${note.substring(0, 60)}...`);
    }
    
    // Also update the database trigger to use the new format
    console.log('\n📝 Updating database trigger for future requests...');
    
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
    
    console.log('✅ Updated database trigger to use new Venmo link format');
    
    // Show a sample of the new links
    console.log('\n📊 Sample of updated Venmo links:');
    const samples = await db.query(`
      SELECT tracking_id, venmo_link 
      FROM payment_requests 
      WHERE status = 'pending' 
      LIMIT 3
    `);
    
    samples.rows.forEach(row => {
      console.log(`\n${row.tracking_id}:`);
      console.log(`${row.venmo_link.substring(0, 100)}...`);
    });
    
    console.log('\n✅ All Venmo links updated to new format!');
    console.log('  ✓ Using account.venmo.com/payment-link');
    console.log('  ✓ Detailed notes with bill type and split info');
    console.log('  ✓ Proper recipients parameter');
    console.log('  ✓ Database trigger updated for future requests');
    
  } catch (error) {
    console.error('❌ Error fixing Venmo links:', error);
  } finally {
    process.exit(0);
  }
}

fixVenmoLinkFormat();