const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Get pending transactions for review
router.get('/pending', async (req, res) => {
  try {
    const { limit = 50, offset = 0 } = req.query;
    
    // Get pending transactions
    const transactions = await db.query(`
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
      ORDER BY posted_date DESC
      LIMIT $1 OFFSET $2
    `, [limit, offset]);
    
    // Get total count for pagination
    const countResult = await db.getOne(`
      SELECT COUNT(*) as total
      FROM raw_transactions
      WHERE processed = false AND excluded = false
    `);
    
    res.json({
      transactions: transactions.rows,
      total: parseInt(countResult.total),
      limit: parseInt(limit),
      offset: parseInt(offset)
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
      // Insert into main transactions table
      await db.insert('transactions', {
        plaid_transaction_id: `simplefin_${rawTx.simplefin_id}`,
        plaid_account_id: rawTx.simplefin_account_id,
        amount: Math.abs(rawTx.amount),
        date: rawTx.posted_date,
        name: rawTx.description,
        merchant_name: merchant_name || rawTx.suggested_merchant || rawTx.payee,
        expense_type: expense_type,
        category: rawTx.category || 'Manual Review',
        subcategory: null
      });
      
      // Mark as processed
      await db.query(
        'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
        [id]
      );
      
      await db.query('COMMIT');
      
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
    const { transaction_ids, expense_type } = req.body;
    
    if (!Array.isArray(transaction_ids) || transaction_ids.length === 0) {
      return res.status(400).json({ error: 'No transactions provided' });
    }
    
    await db.query('BEGIN');
    
    try {
      let approved = 0;
      
      for (const id of transaction_ids) {
        // Get the raw transaction
        const rawTx = await db.getOne(
          'SELECT * FROM raw_transactions WHERE id = $1 AND processed = false AND excluded = false',
          [id]
        );
        
        if (rawTx) {
          // Insert into main transactions
          await db.insert('transactions', {
            plaid_transaction_id: `simplefin_${rawTx.simplefin_id}`,
            plaid_account_id: rawTx.simplefin_account_id,
            amount: Math.abs(rawTx.amount),
            date: rawTx.posted_date,
            name: rawTx.description,
            merchant_name: rawTx.suggested_merchant || rawTx.payee,
            expense_type: expense_type || rawTx.suggested_expense_type || 'other',
            category: rawTx.category || 'Bulk Approved',
            subcategory: null
          });
          
          // Mark as processed
          await db.query(
            'UPDATE raw_transactions SET processed = true, updated_at = NOW() WHERE id = $1',
            [id]
          );
          
          approved++;
        }
      }
      
      await db.query('COMMIT');
      
      res.json({ 
        success: true, 
        message: `Approved ${approved} transactions`,
        approved: approved
      });
    } catch (error) {
      await db.query('ROLLBACK');
      throw error;
    }
  } catch (error) {
    console.error('Error bulk approving transactions:', error);
    res.status(500).json({ error: 'Failed to bulk approve transactions' });
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
      { value: 'yard_maintenance', label: 'Yard Maintenance' },
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