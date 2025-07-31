const db = require('../db/connection');

class SyncTracker {
  async startSync(syncType, details = {}) {
    try {
      const result = await db.insert('sync_history', {
        sync_type: syncType,
        status: 'running',
        details: JSON.stringify(details),
        started_at: new Date()
      });
      return result.id;
    } catch (error) {
      console.error('Error starting sync tracking:', error);
      return null;
    }
  }

  async completeSync(syncId, results) {
    try {
      // Use db.update with includeUpdatedAt = false since sync_history doesn't have updated_at
      await db.update('sync_history', syncId, {
        status: 'completed',
        completed_at: new Date(),
        transactions_imported: results.transactions || 0,
        bills_processed: results.bills || 0,
        payment_requests_created: results.paymentRequests || 0,
        pending_review: results.pendingReview || 0,
        errors: results.errors || []
      }, false); // false = don't include updated_at
    } catch (error) {
      console.error('Error completing sync tracking:', error);
      // Fallback to direct query if db.update fails
      try {
        await db.query(
          `UPDATE sync_history 
           SET status = 'completed',
               completed_at = CURRENT_TIMESTAMP,
               transactions_imported = $2,
               bills_processed = $3,
               payment_requests_created = $4,
               pending_review = $5,
               errors = $6
           WHERE id = $1`,
          [
            syncId,
            results.transactions || 0,
            results.bills || 0,
            results.paymentRequests || 0,
            results.pendingReview || 0,
            results.errors || []
          ]
        );
      } catch (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
      }
    }
  }

  async failSync(syncId, error) {
    try {
      // Use db.update with includeUpdatedAt = false
      await db.update('sync_history', syncId, {
        status: 'failed',
        completed_at: new Date(),
        errors: [error.message || 'Unknown error']
      }, false); // false = don't include updated_at
    } catch (updateError) {
      console.error('Error failing sync tracking:', updateError);
      // Fallback to direct query
      try {
        await db.query(
          `UPDATE sync_history 
           SET status = 'failed',
               completed_at = CURRENT_TIMESTAMP,
               errors = $2
           WHERE id = $1`,
          [syncId, [error.message || 'Unknown error']]
        );
      } catch (fallbackError) {
        console.error('Fallback update also failed:', fallbackError);
      }
    }
  }

  async getRecentSyncs(limit = 10) {
    try {
      return await db.getMany(
        `SELECT * FROM sync_history 
         ORDER BY started_at DESC 
         LIMIT $1`,
        [limit]
      );
    } catch (error) {
      console.error('Error getting recent syncs:', error);
      return [];
    }
  }

  async getSyncStats() {
    try {
      const stats = await db.getOne(`
        SELECT 
          COUNT(*) FILTER (WHERE status = 'completed') as successful_syncs,
          COUNT(*) FILTER (WHERE status = 'failed') as failed_syncs,
          COUNT(*) FILTER (WHERE status = 'running') as running_syncs,
          MAX(completed_at) FILTER (WHERE status = 'completed') as last_successful_sync,
          SUM(transactions_imported) FILTER (WHERE status = 'completed') as total_transactions,
          SUM(payment_requests_created) FILTER (WHERE status = 'completed') as total_payment_requests
        FROM sync_history
        WHERE started_at > NOW() - INTERVAL '30 days'
      `);
      
      const pendingReview = await db.getOne(
        `SELECT COUNT(*) as count FROM raw_transactions WHERE processed = false AND excluded = false`
      );
      
      return {
        ...stats,
        current_pending_review: pendingReview.count
      };
    } catch (error) {
      console.error('Error getting sync stats:', error);
      return null;
    }
  }
}

module.exports = new SyncTracker();