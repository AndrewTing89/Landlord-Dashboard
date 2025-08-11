const db = require('../src/db/connection');
const simplefinService = require('../src/services/simplefinService');
const paymentRequestService = require('../src/services/paymentRequestService');

async function runETLProcessing() {
  console.log('🔧 Running ETL processing on raw transactions...');
  
  try {
    // Get all unprocessed raw transactions
    const rawTxs = await db.query(`
      SELECT * FROM raw_transactions 
      WHERE processed = false 
      ORDER BY posted_date DESC
    `);
    
    console.log(`Found ${rawTxs.rows.length} unprocessed transactions`);
    
    let processed = 0;
    let autoApproved = 0;
    
    for (const rawTx of rawTxs.rows) {
      console.log(`\n📋 Processing: ${rawTx.description} ($${rawTx.amount})`);
      
      // Create a mock transaction object for ETL processing
      const mockTransaction = {
        id: rawTx.simplefin_id,
        amount: rawTx.amount,
        description: rawTx.description,
        payee: rawTx.payee,
        category: rawTx.category
      };
      
      // Apply ETL rules
      const suggestions = await simplefinService.applyETLRules(mockTransaction);
      
      console.log(`   ETL Result: ${suggestions.expense_type} (confidence: ${suggestions.confidence}, auto_approve: ${suggestions.auto_approve})`);
      
      // Update the raw transaction with suggestions
      await db.query(`
        UPDATE raw_transactions 
        SET suggested_expense_type = $1,
            suggested_merchant = $2,
            confidence_score = $3,
            excluded = $4,
            exclude_reason = $5,
            processed = $6
        WHERE id = $7
      `, [
        suggestions.expense_type,
        suggestions.merchant,
        suggestions.confidence,
        suggestions.excluded,
        suggestions.exclude_reason,
        suggestions.auto_approve || rawTx.amount > 0, // Mark income as processed
        rawTx.id
      ]);
      
      // If auto-approved and it's an expense, create expense record
      if (suggestions.auto_approve && !suggestions.excluded && rawTx.amount < 0) {
        console.log(`   ✅ Auto-approving as ${suggestions.expense_type}`);
        
        const expense = await db.insert('expenses', {
          simplefin_transaction_id: `simplefin_${rawTx.simplefin_id}`,
          simplefin_account_id: rawTx.simplefin_account_id,
          amount: Math.abs(rawTx.amount),
          date: rawTx.posted_date,
          name: rawTx.description,
          merchant_name: suggestions.merchant || rawTx.payee || 'Unknown',
          expense_type: suggestions.expense_type || 'other',
          category: rawTx.category || 'Other'
        });
        
        autoApproved++;
        
        // Create utility payment requests for electricity/water
        if (['electricity', 'water'].includes(suggestions.expense_type)) {
          try {
            console.log(`   💸 Creating utility payment requests...`);
            await paymentRequestService.createUtilityPaymentRequests(expense);
          } catch (error) {
            console.log(`   ⚠️ Error creating payment requests: ${error.message}`);
          }
        }
      }
      
      processed++;
    }
    
    console.log(`\n📊 ETL Processing Complete:`);
    console.log(`   - Processed: ${processed} transactions`);
    console.log(`   - Auto-approved: ${autoApproved} expenses`);
    console.log(`   - Need manual review: ${processed - autoApproved}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

runETLProcessing();