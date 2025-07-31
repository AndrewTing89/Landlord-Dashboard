const simplefinService = require('../services/simplefinService');
const db = require('../db/connection');

/**
 * Lambda handler for syncing transactions via SimpleFIN
 * This replaces the Plaid sync functionality
 */
exports.handler = async (event, context) => {
  console.log('Starting SimpleFIN sync Lambda', { event });
  
  try {
    // Sync transactions from SimpleFIN
    const syncResult = await simplefinService.syncTransactions();
    
    // Log the sync job
    await db.insert('job_runs', {
      job_name: 'simplefin_sync',
      run_date: new Date(),
      status: 'success',
      details: syncResult
    });
    
    console.log('SimpleFIN sync completed:', syncResult);
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        ...syncResult
      })
    };
    
  } catch (error) {
    console.error('SimpleFIN sync error:', error);
    
    // Log the failed job
    await db.insert('job_runs', {
      job_name: 'simplefin_sync',
      run_date: new Date(),
      status: 'failed',
      details: { error: error.message }
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};