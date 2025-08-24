const express = require('express');
const router = express.Router();
const db = require('../db/connection');
const paymentRequestService = require('../services/paymentRequestService');

// Get pending transactions for review
router.get('/pending', async (req, res) => {
  try {
    const { limit = 50, offset = 0, type } = req.query;
    
    let query = `
      SELECT 
        id,
        simplefin_id,
        simplefin_account_id,
        amount,
        posted_date,
        description,
        payee,
        suggested_expense_type,
        suggested_merchant,
        confidence_score
      FROM raw_transactions
      WHERE processed = false 
        AND excluded = false
    `;
    
    let countQuery = `
      SELECT COUNT(*) as total
      FROM raw_transactions
      WHERE processed = false AND excluded = false
    `;
    
    const params = [limit, offset];
    const countParams = [];
    
    // Add type filter if provided
    if (type) {
      query += ` AND suggested_expense_type = $3`;
      countQuery += ` AND suggested_expense_type = $1`;
      params.push(type);
      countParams.push(type);
    }
    
    query += ` ORDER BY posted_date DESC LIMIT $1 OFFSET $2`;
    
    // Get pending transactions
    const transactions = await db.query(query, params);
    
    // Get total count for pagination
    const countResult = await db.getOne(countQuery, countParams);
    
    res.json({
      transactions: transactions.rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset),
      type: type || null
    });
  } catch (error) {
    console.error('Error fetching pending transactions:', error);
    res.status(500).json({ error: 'Failed to fetch pending transactions' });
  }
});

// Approve a transaction
router.post('/approve/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { expense_type, merchant_name } = req.body;
    
    // Get the raw transaction
    const rawTx = await db.getOne(
      'SELECT * FROM raw_transactions WHERE id = $1',
      [id]
    );
    
    if (!rawTx) {
      return res.status(404).json({ error: 'Transaction not found' });
    }
    
    // Start a transaction
    await db.query('BEGIN');
    
    try {
      // Only process expenses (negative amounts)
      // Positive amounts (deposits) should be excluded, not approved
      if (rawTx.amount > 0) {
        // If trying to approve a deposit, just mark it as excluded instead
        await db.query(
          `UPDATE raw_transactions 
           SET excluded = true, 
               exclude_reason = 'Bank deposit - income tracked via payment requests',
               processed = true,
               updated_at = NOW() 
           WHERE id = $1`,
          [id]
        );
      } else {
        // Expense (negative amounts) - insert into expenses table
        await db.insert('expenses', {
          plaid_transaction_id: rawTx.simplefin_id ? `simplefin_${rawTx.simplefin_id}` : null,
          plaid_account_id: rawTx.simplefin_account_id || 'unknown',
          amount: Math.abs(rawTx.amount),
          date: rawTx.posted_date,
          name: rawTx.description,
          merchant_name: merchant_name || rawTx.suggested_merchant || rawTx.payee,
          expense_type: expense_type,
          category: rawTx.category || 'Manual Review',
          subcategory: null,
          tax_year: new Date(rawTx.posted_date).getFullYear()
        });
        
        // Mark as processed
        await db.query(
          'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
          [id]
        );
      }
      
      await db.query('COMMIT');
      
      // Payment requests are now created automatically by database trigger
      
      res.json({ 
        success: true, 
        message: 'Transaction approved',
        expense_type: expense_type
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error approving transaction:', error);
    res.status(500).json({ error: 'Failed to approve transaction' });
  }
});

// Exclude a transaction
router.post('/exclude/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    await db.query(
      `UPDATE raw_transactions 
       SET excluded = true, 
           exclude_reason = $1, 
           updated_at = NOW() 
       WHERE id = $2`,
      [reason || 'Manual exclusion', id]
    );
    
    res.json({ success: true, message: 'Transaction excluded' });
  } catch (error) {
    console.error('Error excluding transaction:', error);
    res.status(500).json({ error: 'Failed to exclude transaction' });
  }
});

// Bulk approve transactions
router.post('/bulk-approve', async (req, res) => {
  try {
    const { transaction_ids, expense_type, bulk_type } = req.body;
    
    console.log('Bulk approve request:', { transaction_ids, expense_type, bulk_type });
    
    let targetTransactionIds = transaction_ids;
    
    // If bulk_type is provided, fetch ALL pending transactions of that type
    if (bulk_type) {
      const allTransactions = await db.query(`
        SELECT id
        FROM raw_transactions 
        WHERE processed = false 
          AND excluded = false 
          AND suggested_expense_type = $1
      `, [bulk_type]);
      
      targetTransactionIds = allTransactions.rows.map(t => t.id);
      console.log(`Found ${targetTransactionIds.length} total ${bulk_type} transactions to process`);
    }
    
    if (!Array.isArray(targetTransactionIds) || targetTransactionIds.length === 0) {
      return res.status(400).json({ error: 'No transactions to process' });
    }
    
    await db.query('BEGIN');
    
    try {
      let approved = 0;
      let errors = [];
      
      // Use bulk_type as expense_type if provided, otherwise use the passed expense_type
      const finalExpenseType = bulk_type || expense_type;
      
      for (const id of targetTransactionIds) {
        try {
          // Get the raw transaction
          const rawTx = await db.getOne(
            'SELECT * FROM raw_transactions WHERE id = $1 AND processed = false AND excluded = false',
            [id]
          );
          
          if (rawTx) {
            // Check if transaction already exists using natural keys
            const existing = await db.getOne(
              'SELECT id FROM expenses WHERE date = $1 AND amount = $2 AND name = $3',
              [rawTx.posted_date, Math.abs(rawTx.amount), rawTx.description]
            );
            
            if (existing) {
              console.log(`Transaction already exists: ${rawTx.simplefin_id}`);
              // Just mark as processed
              await db.query(
                'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
                [id]
              );
            } else {
              // Only process expenses (negative amounts)
              if (rawTx.amount > 0) {
                // Exclude deposits
                await db.query(
                  `UPDATE raw_transactions 
                   SET excluded = true, 
                       exclude_reason = 'Bank deposit - income tracked via payment requests',
                       processed = true,
                       updated_at = NOW() 
                   WHERE id = $1`,
                  [id]
                );
              } else {
                // Insert expense into expenses table
                const newExpense = await db.insert('expenses', {
                  plaid_transaction_id: rawTx.simplefin_id ? `simplefin_${rawTx.simplefin_id}` : null,
                  plaid_account_id: rawTx.simplefin_account_id || 'unknown',
                  amount: Math.abs(rawTx.amount),
                  date: rawTx.posted_date,
                  name: rawTx.description,
                  merchant_name: rawTx.suggested_merchant || rawTx.payee,
                  expense_type: finalExpenseType || rawTx.suggested_expense_type || 'other',
                  category: rawTx.category || 'Bulk Approved',
                  subcategory: null,
                  tax_year: new Date(rawTx.posted_date).getFullYear()
                });
                
                // Mark as processed
                await db.query(
                  'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
                  [id]
                );
                
                // Automatically create payment requests for electricity and water bills only
                // Internet (Comcast) is NOT split among roommates
                if (['electricity', 'water'].includes(finalExpenseType)) {
                  try {
                    // First create a utility_bill record
                    const billDate = new Date(rawTx.posted_date);
                    const utilityBill = await db.insert('utility_bills', {
                      transaction_id: newExpense.id,
                      bill_type: finalExpenseType,
                      total_amount: Math.abs(rawTx.amount),
                      split_amount: (Math.abs(rawTx.amount) / 3).toFixed(2),
                      month: billDate.getMonth() + 1,
                      year: billDate.getFullYear(),
                      payment_requested: false
                    });
                    
                    // Now create payment requests using the utility_bill
                    const expenseWithBillId = { ...newExpense, utility_bill_id: utilityBill.id };
                    await paymentRequestService.createUtilityPaymentRequests(expenseWithBillId);
                    console.log(`Created utility bill and payment requests for ${finalExpenseType} (Bill ID: ${utilityBill.id})`);
                  } catch (err) {
                    console.error(`Error creating payment requests for ${finalExpenseType} bill:`, err);
                    // Don't fail the approval if payment request creation fails
                  }
                }
                
                // For internet bills, still create utility_bills entry but NO payment requests
                if (finalExpenseType === 'internet') {
                  try {
                    const billDate = new Date(rawTx.posted_date);
                    await db.insert('utility_bills', {
                      transaction_id: newExpense.id,
                      bill_type: finalExpenseType,
                      total_amount: Math.abs(rawTx.amount),
                      split_amount: Math.abs(rawTx.amount), // No split for internet
                      month: billDate.getMonth() + 1,
                      year: billDate.getFullYear(),
                      payment_requested: false
                    });
                    console.log(`Created internet utility bill record (NO payment requests)`);
                  } catch (err) {
                    console.error(`Error creating internet utility bill:`, err);
                  }
                }
              }
            }
            
            approved++;
          }
        } catch (txError) {
          console.error(`Error processing transaction ${id}:`, txError);
          errors.push({ id, error: txError.message });
        }
      }
      
      await db.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: `Approved ${approved} transactions`,
        approved: approved,
        errors: errors.length > 0 ? errors : undefined
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error bulk approving transactions:', error);
    res.status(500).json({ error: error.message || 'Failed to bulk approve transactions' });
  }
});

// Get count of pending transactions for bulk approval
router.get('/bulk-count', async (req, res) => {
  try {
    const { type } = req.query;
    
    if (!type) {
      return res.status(400).json({ error: 'Transaction type is required' });
    }
    
    const result = await db.getOne(`
      SELECT COUNT(*) as count
      FROM raw_transactions 
      WHERE processed = false 
        AND excluded = false 
        AND suggested_expense_type = $1
    `, [type]);
    
    res.json({ 
      count: parseInt(result.count),
      type: type 
    });
  } catch (error) {
    console.error('Error getting bulk count:', error);
    res.status(500).json({ error: 'Failed to get transaction count' });
  }
});

// Get all pending transaction types with counts (for summary cards)
router.get('/pending-summary', async (req, res) => {
  try {
    const result = await db.query(`
      SELECT 
        suggested_expense_type,
        COUNT(*) as count
      FROM raw_transactions 
      WHERE processed = false 
        AND excluded = false 
        AND suggested_expense_type IS NOT NULL
      GROUP BY suggested_expense_type
      ORDER BY count DESC
    `);
    
    const summary = {};
    result.rows.forEach(row => {
      summary[row.suggested_expense_type || 'uncategorized'] = parseInt(row.count);
    });
    
    res.json(summary);
  } catch (error) {
    console.error('Error getting pending summary:', error);
    res.status(500).json({ error: 'Failed to get pending summary' });
  }
});

// Get expense type options
router.get('/expense-types', async (req, res) => {
  try {
    const types = [
      { value: 'rent', label: 'Rent Income' },
      { value: 'electricity', label: 'Electricity' },
      { value: 'water', label: 'Water' },
      { value: 'internet', label: 'Internet' },
      { value: 'maintenance', label: 'Maintenance' },
      { value: 'landscape', label: 'Landscape' },
      { value: 'property_tax', label: 'Property Tax' },
      { value: 'insurance', label: 'Insurance' },
      { value: 'other', label: 'Other' }
    ];
    
    res.json(types);
  } catch (error) {
    console.error('Error fetching expense types:', error);
    res.status(500).json({ error: 'Failed to fetch expense types' });
  }
});

module.exports = router;