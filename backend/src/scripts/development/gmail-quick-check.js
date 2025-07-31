/**
 * Quick Gmail status check
 * Shows connection status and recent activity at a glance
 */

require('dotenv').config();
const db = require('../../db/connection');
const chalk = require('chalk');

async function quickCheck() {
  try {
    console.log(chalk.blue('\n📧 Gmail Quick Status Check\n'));
    
    // Check connection
    const syncState = await db.getOne(`
      SELECT account_email, last_sync_date 
      FROM gmail_sync_state 
      WHERE active = true 
      ORDER BY updated_at DESC 
      LIMIT 1
    `);
    
    if (syncState) {
      console.log(chalk.green('✅ Gmail Connected'));
      console.log(`Account: ${chalk.cyan(syncState.account_email)}`);
      console.log(`Last sync: ${chalk.yellow(new Date(syncState.last_sync_date).toLocaleString())}\n`);
    } else {
      console.log(chalk.red('❌ Gmail Not Connected\n'));
      console.log('Connect at: http://localhost:3002/api/gmail/auth\n');
      return;
    }
    
    // Today's activity
    const todayStats = await db.getOne(`
      SELECT 
        COUNT(*) as emails_today,
        COUNT(CASE WHEN matched = true THEN 1 END) as matched_today,
        SUM(CASE WHEN email_type = 'payment_received' THEN venmo_amount ELSE 0 END) as payments_received
      FROM venmo_emails
      WHERE DATE(received_date) = CURRENT_DATE
    `);
    
    console.log(chalk.cyan('Today\'s Activity:'));
    console.log(`Emails processed: ${todayStats.emails_today || 0}`);
    console.log(`Payments matched: ${todayStats.matched_today || 0}`);
    if (todayStats.payments_received) {
      console.log(`Total received: ${chalk.green(`$${todayStats.payments_received.toFixed(2)}`)}`);
    }
    
    // Pending review
    const pendingReview = await db.getOne(`
      SELECT COUNT(*) as count
      FROM venmo_emails
      WHERE matched = false 
        AND manual_review_needed = true
        AND email_type = 'payment_received'
    `);
    
    if (pendingReview.count > 0) {
      console.log(chalk.yellow(`\n⚠️  ${pendingReview.count} payment(s) need manual review`));
      console.log('Review at: http://localhost:5173/email-review');
    } else {
      console.log(chalk.green('\n✅ All payments matched!'));
    }
    
    // Recent payments
    const recentPayments = await db.getMany(`
      SELECT 
        venmo_actor,
        venmo_amount,
        received_date,
        pr.bill_type
      FROM venmo_emails ve
      LEFT JOIN payment_requests pr ON ve.payment_request_id = pr.id
      WHERE ve.email_type = 'payment_received'
        AND ve.matched = true
      ORDER BY ve.received_date DESC
      LIMIT 5
    `);
    
    if (recentPayments.length > 0) {
      console.log(chalk.cyan('\nRecent Payments Received:'));
      recentPayments.forEach(payment => {
        const date = new Date(payment.received_date).toLocaleDateString();
        const billType = payment.bill_type || 'unknown';
        console.log(`• ${date} - $${payment.venmo_amount.toFixed(2)} from ${payment.venmo_actor} (${billType})`);
      });
    }
    
  } catch (error) {
    console.error(chalk.red('Error:'), error.message);
  } finally {
    await db.close();
  }
}

quickCheck();