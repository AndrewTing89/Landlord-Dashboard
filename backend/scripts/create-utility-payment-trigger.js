const db = require('../src/db/connection');

async function createUtilityPaymentTrigger() {
  try {
    console.log('🔧 Creating automatic utility payment request trigger...');
    
    // First, create the trigger function
    await db.query(`
      CREATE OR REPLACE FUNCTION create_utility_payment_requests()
      RETURNS TRIGGER AS $$
      DECLARE
        split_amount DECIMAL;
        roommate_record RECORD;
      BEGIN
        -- Only process electricity and water expenses
        IF NEW.expense_type IN ('electricity', 'water') THEN
          
          -- Calculate split amount (divide by 3 for roommates)
          split_amount := NEW.amount / 3;
          
          -- Get roommate configuration from config
          FOR roommate_record IN
            SELECT name, venmo_username 
            FROM (VALUES 
              ('Ushi Lo', '@UshiLo'),
              ('Eileen', '@eileen-venmo')
            ) AS roommates(name, venmo_username)
          LOOP
            -- Create payment request for each roommate
            INSERT INTO payment_requests (
              roommate_name,
              venmo_username, 
              amount,
              request_date,
              status,
              bill_type,
              month,
              year,
              total_amount,
              tracking_id,
              created_at
            ) VALUES (
              roommate_record.name,
              roommate_record.venmo_username,
              split_amount,
              NEW.date,
              'pending',
              NEW.expense_type,
              EXTRACT(MONTH FROM NEW.date),
              EXTRACT(YEAR FROM NEW.date),
              NEW.amount,
              CONCAT(EXTRACT(YEAR FROM NEW.date), 
                     LPAD(EXTRACT(MONTH FROM NEW.date)::text, 2, '0'), 
                     NEW.expense_type),
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
          
          RAISE NOTICE 'Created payment requests for % bill: $%', NEW.expense_type, NEW.amount;
        END IF;
        
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    
    console.log('✅ Created trigger function');
    
    // Drop existing trigger if it exists
    await db.query(`
      DROP TRIGGER IF EXISTS utility_payment_trigger ON expenses;
    `);
    
    // Create the trigger
    await db.query(`
      CREATE TRIGGER utility_payment_trigger
        AFTER INSERT ON expenses
        FOR EACH ROW
        EXECUTE FUNCTION create_utility_payment_requests();
    `);
    
    console.log('✅ Created trigger on expenses table');
    console.log('');
    console.log('🎯 Trigger will automatically create payment requests for:');
    console.log('  - electricity expenses (split 3 ways)');
    console.log('  - water expenses (split 3 ways)');
    console.log('  - Creates utility_bills tracking record');
    console.log('  - Works for ANY expense insertion (CSV, API, manual)');
    
  } catch (error) {
    console.error('❌ Error creating trigger:', error);
  } finally {
    process.exit(0);
  }
}

createUtilityPaymentTrigger();