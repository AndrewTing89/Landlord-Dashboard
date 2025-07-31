#!/usr/bin/env node

require('dotenv').config();
const db = require('../src/db/connection');

async function forego2024Payments() {
  console.log('=== Mass Forego 2024 Payment Requests ===\n');
  
  try {
    // Get all 2024 payment requests
    const result = await db.query(
      `SELECT id, amount, status, month, year, bill_type, roommate_name, merchant_name
       FROM payment_requests 
       WHERE year = 2024 
       ORDER BY month`
    );
    
    console.log(`Found ${result.rows.length} payment requests from 2024\n`);
    
    // Group by status
    const byStatus = {};
    result.rows.forEach(r => {
      byStatus[r.status] = (byStatus[r.status] || 0) + 1;
    });
    
    console.log('Current Status Breakdown:');
    Object.entries(byStatus).forEach(([status, count]) => {
      console.log(`  ${status}: ${count}`);
    });
    
    // Filter for pending/sent payments
    const toForego = result.rows.filter(r => r.status === 'pending' || r.status === 'sent');
    
    if (toForego.length === 0) {
      console.log('\n✅ No pending or sent payments from 2024 to forego!');
      process.exit(0);
    }
    
    console.log(`\n${toForego.length} payments need to be foregone:\n`);
    
    // Show summary by type
    const byType = {};
    toForego.forEach(p => {
      const key = p.bill_type || 'other';
      if (!byType[key]) byType[key] = { count: 0, total: 0 };
      byType[key].count++;
      byType[key].total += parseFloat(p.amount);
    });
    
    console.log('By Bill Type:');
    Object.entries(byType).forEach(([type, data]) => {
      console.log(`  ${type}: ${data.count} payments, total $${data.total.toFixed(2)}`);
    });
    
    // Ask for confirmation
    console.log('\nThis will mark all these payments as "foregone" without reducing your expenses.');
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...\n');
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Update all pending/sent 2024 payments to foregone
    console.log('Updating payment requests...');
    
    const updateResult = await db.query(
      `UPDATE payment_requests 
       SET status = 'foregone', updated_at = NOW() 
       WHERE year = 2024 
       AND status IN ('pending', 'sent')`
    );
    
    console.log(`\n✅ Successfully foregone ${updateResult.rowCount} payment requests from 2024!`);
    
    // Show final summary
    const finalResult = await db.query(
      `SELECT status, COUNT(*) as count 
       FROM payment_requests 
       WHERE year = 2024 
       GROUP BY status`
    );
    
    console.log('\nFinal 2024 Status Summary:');
    finalResult.rows.forEach(r => {
      console.log(`  ${r.status}: ${r.count}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

// Add a command line flag to skip confirmation
if (process.argv.includes('--no-confirm')) {
  // Direct execution without wait
  (async () => {
    try {
      const updateResult = await db.query(
        `UPDATE payment_requests 
         SET status = 'foregone', updated_at = NOW() 
         WHERE year = 2024 
         AND status IN ('pending', 'sent')`
      );
      console.log(`✅ Successfully foregone ${updateResult.rowCount} payment requests from 2024!`);
      process.exit(0);
    } catch (error) {
      console.error('Error:', error);
      process.exit(1);
    }
  })();
} else {
  forego2024Payments();
}