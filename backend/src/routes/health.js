const express = require('express');
const router = express.Router();
const db = require('../db/connection');

// Get comprehensive health status
router.get('/status', async (req, res) => {
  try {
    // Get last sync information
    const lastSync = await db.getOne(`
      SELECT 
        started_at as date,
        status,
        transactions_imported,
        bills_processed
      FROM sync_history
      ORDER BY started_at DESC
      LIMIT 1
    `);

    // Get pending items counts
    const pendingCounts = await db.getOne(`
      SELECT 
        (SELECT COUNT(*) FROM raw_transactions WHERE processed = false AND excluded = false) as raw_transactions,
        (SELECT COUNT(*) FROM venmo_emails WHERE matched = false AND (ignored IS NULL OR ignored = false)) as unmatched_emails,
        (SELECT COUNT(*) FROM payment_requests WHERE status IN ('pending', 'sent')) as pending_payments,
        (SELECT COUNT(*) FROM raw_transactions WHERE processed = false AND excluded = false AND suggested_expense_type IS NULL) as review_required
    `);

    // Check data integrity issues
    const integrityIssues = await db.getOne(`
      SELECT 
        (SELECT COUNT(*) FROM income WHERE payment_request_id IS NULL AND income_type = 'utility_reimbursement') as orphaned_income,
        (SELECT COUNT(*) FROM payment_requests WHERE 
          (status = 'paid' AND paid_date IS NULL) OR 
          (status = 'pending' AND paid_date IS NOT NULL)) as invalid_statuses,
        (SELECT COUNT(*) FROM payment_requests WHERE total_amount IS NULL AND bill_type IN ('electricity', 'water')) as missing_amounts,
        (SELECT COUNT(*) FROM (
          SELECT date, amount, COUNT(*) 
          FROM expenses 
          GROUP BY date, amount, name 
          HAVING COUNT(*) > 1
        ) dupes) as duplicate_transactions
    `);

    // Check system health
    const systemHealth = {
      databaseConnected: true, // If we got here, DB is connected
      emailServiceActive: false,
      bankConnectionValid: false,
      lastBackup: null
    };

    // Check email service
    try {
      const emailState = await db.getOne('SELECT last_sync_date FROM gmail_sync_state WHERE active = true LIMIT 1');
      systemHealth.emailServiceActive = emailState && emailState.last_sync_date && 
        (new Date() - new Date(emailState.last_sync_date)) < 86400000; // Active if synced in last 24h
    } catch (e) {
      console.error('Email service check failed:', e);
    }

    // Check bank connection
    try {
      const bankConnection = await db.getOne('SELECT last_sync FROM simplefin_connections LIMIT 1');
      systemHealth.bankConnectionValid = bankConnection && bankConnection.last_sync && 
        (new Date() - new Date(bankConnection.last_sync)) < 172800000; // Valid if synced in last 48h
    } catch (e) {
      console.error('Bank connection check failed:', e);
    }

    // Check for backups
    try {
      const lastBackup = await db.getOne(`
        SELECT created_at 
        FROM backups 
        ORDER BY created_at DESC 
        LIMIT 1
      `);
      systemHealth.lastBackup = lastBackup?.created_at || null;
    } catch (e) {
      // Backups table might not exist yet
    }

    // Determine overall health
    let overall = 'healthy';
    const totalPending = pendingCounts.raw_transactions + pendingCounts.unmatched_emails + pendingCounts.review_required;
    const totalIntegrity = integrityIssues.orphaned_income + integrityIssues.invalid_statuses + 
                          integrityIssues.missing_amounts + integrityIssues.duplicate_transactions;

    if (totalIntegrity > 10 || !systemHealth.databaseConnected || !systemHealth.bankConnectionValid) {
      overall = 'critical';
    } else if (totalPending > 20 || totalIntegrity > 0 || !systemHealth.emailServiceActive) {
      overall = 'warning';
    }

    res.json({
      overall,
      lastSync: {
        date: lastSync?.date || null,
        status: lastSync?.status || 'never',
        transactionsImported: lastSync?.transactions_imported || 0,
        billsProcessed: lastSync?.bills_processed || 0
      },
      pendingItems: {
        rawTransactions: pendingCounts.raw_transactions,
        unmatchedEmails: pendingCounts.unmatched_emails,
        pendingPayments: pendingCounts.pending_payments,
        reviewRequired: pendingCounts.review_required
      },
      dataIntegrity: {
        orphanedIncome: integrityIssues.orphaned_income,
        invalidStatuses: integrityIssues.invalid_statuses,
        missingAmounts: integrityIssues.missing_amounts,
        duplicateTransactions: integrityIssues.duplicate_transactions
      },
      systemHealth
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({ error: 'Failed to get health status' });
  }
});

// Process all pending raw transactions
router.post('/process-pending', async (req, res) => {
  try {
    await db.query('BEGIN');

    // Get all unprocessed transactions
    const pending = await db.getMany(`
      SELECT * FROM raw_transactions 
      WHERE processed = false 
        AND excluded = false
      ORDER BY posted_date DESC
    `);

    let processed = 0;
    let failed = 0;

    for (const transaction of pending) {
      try {
        // Check if already exists in expenses
        const existing = await db.getOne(
          `SELECT id FROM expenses 
           WHERE date = $1 AND amount = $2 AND name = $3`,
          [transaction.posted_date, Math.abs(transaction.amount), transaction.description]
        );

        if (existing) {
          // Mark as processed (duplicate)
          await db.query(
            'UPDATE raw_transactions SET processed = true, notes = $1 WHERE id = $2',
            ['Duplicate of expense #' + existing.id, transaction.id]
          );
        } else if (transaction.suggested_expense_type) {
          // Auto-process if we have a suggested type
          await db.insert('expenses', {
            simplefin_transaction_id: `simplefin_${transaction.simplefin_id}`,
            simplefin_account_id: transaction.simplefin_account_id,
            amount: Math.abs(transaction.amount),
            date: transaction.posted_date,
            name: transaction.description,
            merchant_name: transaction.suggested_merchant || transaction.payee,
            expense_type: transaction.suggested_expense_type,
            category: transaction.category || 'Auto-processed'
          });

          await db.query(
            'UPDATE raw_transactions SET processed = true, processed_at = NOW() WHERE id = $1',
            [transaction.id]
          );
          processed++;
        } else {
          // Needs manual review
          failed++;
        }
      } catch (e) {
        console.error(`Failed to process transaction ${transaction.id}:`, e);
        failed++;
      }
    }

    await db.query('COMMIT');

    res.json({
      success: true,
      message: `Processed ${processed} transactions, ${failed} need manual review`,
      processed,
      failed,
      total: pending.length
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Process pending error:', error);
    res.status(500).json({ error: 'Failed to process pending transactions' });
  }
});

// Fix data integrity issues
router.post('/fix-integrity', async (req, res) => {
  try {
    await db.query('BEGIN');

    let fixes = {
      orphanedIncome: 0,
      invalidStatuses: 0,
      missingAmounts: 0,
      duplicates: 0
    };

    // Fix orphaned income records
    const orphaned = await db.getMany(`
      SELECT id, amount, description 
      FROM income 
      WHERE payment_request_id IS NULL 
        AND income_type = 'utility_reimbursement'
    `);

    for (const income of orphaned) {
      // Try to match with a payment request
      const match = await db.getOne(`
        SELECT id FROM payment_requests 
        WHERE amount = $1 
          AND status = 'paid'
          AND paid_date::date = (SELECT date FROM income WHERE id = $2)
        LIMIT 1
      `, [income.amount, income.id]);

      if (match) {
        await db.query(
          'UPDATE income SET payment_request_id = $1 WHERE id = $2',
          [match.id, income.id]
        );
        fixes.orphanedIncome++;
      }
    }

    // Fix invalid status combinations
    await db.query(`
      UPDATE payment_requests 
      SET paid_date = NULL 
      WHERE status = 'pending' AND paid_date IS NOT NULL
    `);
    
    await db.query(`
      UPDATE payment_requests 
      SET paid_date = NOW() 
      WHERE status = 'paid' AND paid_date IS NULL
    `);
    
    fixes.invalidStatuses = await db.getOne(
      'SELECT COUNT(*) as count FROM payment_requests WHERE status = $1 AND paid_date IS NOT NULL',
      ['pending']
    ).then(r => r.count);

    // Fix missing total amounts
    const missingTotals = await db.getMany(`
      SELECT id, amount, bill_type 
      FROM payment_requests 
      WHERE total_amount IS NULL 
        AND bill_type IN ('electricity', 'water')
    `);

    for (const pr of missingTotals) {
      // For utilities, total is usually 3x the split amount
      await db.query(
        'UPDATE payment_requests SET total_amount = $1 WHERE id = $2',
        [pr.amount * 3, pr.id]
      );
      fixes.missingAmounts++;
    }

    // Remove duplicate transactions
    const duplicates = await db.getMany(`
      SELECT MIN(id) as keep_id, array_agg(id) as all_ids
      FROM expenses
      GROUP BY date, amount, name
      HAVING COUNT(*) > 1
    `);

    for (const dup of duplicates) {
      const idsToDelete = dup.all_ids.filter(id => id !== dup.keep_id);
      if (idsToDelete.length > 0) {
        await db.query(
          'DELETE FROM expenses WHERE id = ANY($1::int[])',
          [idsToDelete]
        );
        fixes.duplicates += idsToDelete.length;
      }
    }

    await db.query('COMMIT');

    res.json({
      success: true,
      message: 'Data integrity issues fixed',
      fixes
    });
  } catch (error) {
    await db.query('ROLLBACK');
    console.error('Fix integrity error:', error);
    res.status(500).json({ error: 'Failed to fix data integrity' });
  }
});

module.exports = router;