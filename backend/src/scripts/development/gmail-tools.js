/**
 * Useful Gmail tracking tools and utilities
 * 
 * Usage:
 *   node src/scripts/development/gmail-tools.js [command]
 * 
 * Commands:
 *   status       - Check Gmail connection status
 *   sync         - Manually sync Gmail emails
 *   test-parse   - Test email parsing with sample data
 *   stats        - Show Gmail sync statistics
 *   review       - Show emails needing review
 *   match        - Manually match an email to a payment request
 *   history      - Show recent email processing history
 */

require('dotenv').config();
const db = require('../../db/connection');
const gmailService = require('../../services/gmailService');
const venmoMatchingService = require('../../services/venmoMatchingService');
const Table = require('cli-table3');
const chalk = require('chalk');

const command = process.argv[2] || 'help';

const commands = {
  async status() {
    console.log(chalk.blue('\n📧 Gmail Connection Status\n'));
    
    try {
      const connected = await gmailService.loadTokens();
      
      if (connected) {
        console.log(chalk.green('✅ Gmail is connected'));
        
        // Get sync state
        const syncState = await db.getOne(`
          SELECT account_email, last_sync_date, active 
          FROM gmail_sync_state 
          WHERE active = true 
          ORDER BY updated_at DESC 
          LIMIT 1
        `);
        
        if (syncState) {
          console.log(`Account: ${chalk.cyan(syncState.account_email)}`);
          console.log(`Last sync: ${chalk.yellow(new Date(syncState.last_sync_date).toLocaleString())}`);
        }
      } else {
        console.log(chalk.red('❌ Gmail not connected'));
        console.log('\nTo connect Gmail:');
        console.log('1. Start the backend server');
        console.log('2. Visit: http://localhost:3002/api/gmail/auth');
      }
    } catch (error) {
      console.error(chalk.red('Error checking status:'), error.message);
    }
  },

  async sync() {
    console.log(chalk.blue('\n🔄 Syncing Gmail...\n'));
    
    try {
      const connected = await gmailService.loadTokens();
      if (!connected) {
        console.log(chalk.red('❌ Gmail not connected. Run "status" command for connection instructions.'));
        return;
      }
      
      const result = await gmailService.processVenmoEmails();
      
      console.log(chalk.green('✅ Sync completed!'));
      console.log(`Total emails found: ${chalk.cyan(result.total)}`);
      console.log(`New emails processed: ${chalk.yellow(result.processed)}`);
      console.log(`Payments matched: ${chalk.green(result.matched)}`);
      
    } catch (error) {
      console.error(chalk.red('Error syncing:'), error.message);
    }
  },

  async stats() {
    console.log(chalk.blue('\n📊 Gmail Sync Statistics\n'));
    
    try {
      // Overall stats
      const stats = await db.getOne(`
        SELECT 
          COUNT(*) as total_emails,
          COUNT(CASE WHEN matched = true THEN 1 END) as matched_emails,
          COUNT(CASE WHEN manual_review_needed = true THEN 1 END) as needs_review,
          COUNT(DISTINCT email_type) as email_types
        FROM venmo_emails
      `);
      
      console.log(chalk.cyan('Overall Statistics:'));
      console.log(`Total emails processed: ${chalk.yellow(stats.total_emails)}`);
      console.log(`Successfully matched: ${chalk.green(stats.matched_emails)} (${((stats.matched_emails/stats.total_emails)*100).toFixed(1)}%)`);
      console.log(`Needs manual review: ${chalk.orange(stats.needs_review)}`);
      
      // Email type breakdown
      const typeBreakdown = await db.getMany(`
        SELECT email_type, COUNT(*) as count
        FROM venmo_emails
        GROUP BY email_type
        ORDER BY count DESC
      `);
      
      console.log(chalk.cyan('\nEmail Type Breakdown:'));
      const typeTable = new Table({
        head: ['Type', 'Count'],
        style: { head: ['cyan'] }
      });
      
      typeBreakdown.forEach(row => {
        typeTable.push([
          row.email_type.replace('_', ' '),
          row.count
        ]);
      });
      
      console.log(typeTable.toString());
      
      // Recent activity
      const recentActivity = await db.getMany(`
        SELECT 
          DATE(received_date) as date,
          COUNT(*) as emails_received,
          COUNT(CASE WHEN matched = true THEN 1 END) as matched
        FROM venmo_emails
        WHERE received_date > NOW() - INTERVAL '7 days'
        GROUP BY DATE(received_date)
        ORDER BY date DESC
      `);
      
      if (recentActivity.length > 0) {
        console.log(chalk.cyan('\nLast 7 Days Activity:'));
        const activityTable = new Table({
          head: ['Date', 'Emails', 'Matched'],
          style: { head: ['cyan'] }
        });
        
        recentActivity.forEach(row => {
          activityTable.push([
            new Date(row.date).toLocaleDateString(),
            row.emails_received,
            row.matched
          ]);
        });
        
        console.log(activityTable.toString());
      }
      
    } catch (error) {
      console.error(chalk.red('Error getting stats:'), error.message);
    }
  },

  async review() {
    console.log(chalk.blue('\n📋 Emails Needing Review\n'));
    
    try {
      const unmatched = await venmoMatchingService.getUnmatchedEmails();
      
      if (unmatched.length === 0) {
        console.log(chalk.green('✅ No emails need review!'));
        return;
      }
      
      console.log(chalk.yellow(`${unmatched.length} emails need manual review:\n`));
      
      const table = new Table({
        head: ['ID', 'Date', 'Type', 'Amount', 'From/To', 'Best Match %'],
        style: { head: ['cyan'] }
      });
      
      unmatched.forEach(email => {
        const potentialMatches = email.potential_matches ? 
          JSON.parse(email.potential_matches) : [];
        const bestMatch = potentialMatches[0];
        
        table.push([
          email.id,
          new Date(email.received_date).toLocaleDateString(),
          email.email_type.replace('_', ' '),
          `$${email.venmo_amount.toFixed(2)}`,
          email.venmo_actor,
          bestMatch ? `${(bestMatch.confidence * 100).toFixed(0)}%` : 'N/A'
        ]);
      });
      
      console.log(table.toString());
      console.log('\nTo match an email, use: node gmail-tools.js match [email_id] [payment_request_id]');
      
    } catch (error) {
      console.error(chalk.red('Error getting review list:'), error.message);
    }
  },

  async match() {
    const emailId = process.argv[3];
    const paymentRequestId = process.argv[4];
    
    if (!emailId || !paymentRequestId) {
      console.log(chalk.red('Usage: node gmail-tools.js match [email_id] [payment_request_id]'));
      console.log('\nTo see unmatched emails: node gmail-tools.js review');
      return;
    }
    
    try {
      console.log(chalk.blue(`\n🔗 Matching email ${emailId} to payment request ${paymentRequestId}...\n`));
      
      const result = await venmoMatchingService.manualMatch(
        parseInt(emailId), 
        parseInt(paymentRequestId)
      );
      
      if (result.success) {
        console.log(chalk.green('✅ Successfully matched!'));
        console.log('- Payment status updated to "paid"');
        console.log('- Recuperation transaction created');
        console.log('- Discord notification sent');
      }
      
    } catch (error) {
      console.error(chalk.red('Error matching:'), error.message);
    }
  },

  async history() {
    console.log(chalk.blue('\n📜 Recent Email Processing History\n'));
    
    try {
      const history = await db.getMany(`
        SELECT 
          ve.id,
          ve.email_type,
          ve.venmo_amount,
          ve.venmo_actor,
          ve.received_date,
          ve.matched,
          pr.id as payment_request_id,
          pr.bill_type
        FROM venmo_emails ve
        LEFT JOIN payment_requests pr ON ve.payment_request_id = pr.id
        ORDER BY ve.received_date DESC
        LIMIT 20
      `);
      
      const table = new Table({
        head: ['Date', 'Type', 'Amount', 'Actor', 'Status', 'Matched To'],
        style: { head: ['cyan'] },
        colWidths: [12, 20, 10, 20, 10, 20]
      });
      
      history.forEach(email => {
        table.push([
          new Date(email.received_date).toLocaleDateString(),
          email.email_type.replace('_', ' '),
          `$${email.venmo_amount?.toFixed(2) || '?'}`,
          email.venmo_actor || '?',
          email.matched ? chalk.green('✓') : chalk.yellow('pending'),
          email.payment_request_id ? 
            `${email.bill_type} #${email.payment_request_id}` : 
            '-'
        ]);
      });
      
      console.log(table.toString());
      
    } catch (error) {
      console.error(chalk.red('Error getting history:'), error.message);
    }
  },

  async 'test-parse'() {
    console.log(chalk.blue('\n🧪 Test Email Parsing\n'));
    
    const sampleEmails = {
      payment: {
        subject: 'UshiLo paid you $123.45',
        body: `UshiLo paid you $123.45

Payment note: "PG&E bill for November 2024: Total $370.35, your share is $123.45 (1/3). I've already paid the full amount."

This payment was made on November 15, 2024.

View transaction in Venmo: https://venmo.com/...`
      },
      request: {
        subject: 'You requested $123.45 from UshiLo',
        body: `You requested $123.45 from UshiLo

Request note: "Water bill for November 2024: Total $370.35, your share is $123.45 (1/3). I've already paid the full amount."

This request was sent on November 10, 2024.`
      }
    };
    
    console.log(chalk.cyan('Testing payment received email:'));
    const paymentParsed = gmailService.parseVenmoEmail({
      id: 'test-payment',
      subject: sampleEmails.payment.subject,
      body: sampleEmails.payment.body,
      snippet: sampleEmails.payment.body.substring(0, 100),
      date: new Date(),
      from: 'Venmo <venmo@venmo.com>'
    });
    
    console.log('Parsed result:');
    console.log(JSON.stringify(paymentParsed, null, 2));
    
    console.log(chalk.cyan('\nTesting request sent email:'));
    const requestParsed = gmailService.parseVenmoEmail({
      id: 'test-request',
      subject: sampleEmails.request.subject,
      body: sampleEmails.request.body,
      snippet: sampleEmails.request.body.substring(0, 100),
      date: new Date(),
      from: 'Venmo <venmo@venmo.com>'
    });
    
    console.log('Parsed result:');
    console.log(JSON.stringify(requestParsed, null, 2));
  },

  help() {
    console.log(chalk.blue('\n📧 Gmail Tracking Tools\n'));
    console.log('Usage: node src/scripts/development/gmail-tools.js [command]\n');
    console.log('Commands:');
    console.log(chalk.cyan('  status       ') + '- Check Gmail connection status');
    console.log(chalk.cyan('  sync         ') + '- Manually sync Gmail emails');
    console.log(chalk.cyan('  test-parse   ') + '- Test email parsing with sample data');
    console.log(chalk.cyan('  stats        ') + '- Show Gmail sync statistics');
    console.log(chalk.cyan('  review       ') + '- Show emails needing review');
    console.log(chalk.cyan('  match        ') + '- Manually match an email to a payment request');
    console.log(chalk.cyan('  history      ') + '- Show recent email processing history');
    console.log(chalk.cyan('  help         ') + '- Show this help message');
  }
};

// Run command
(async () => {
  try {
    if (commands[command]) {
      await commands[command]();
    } else {
      console.log(chalk.red(`Unknown command: ${command}`));
      commands.help();
    }
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  } finally {
    await db.close();
    process.exit(0);
  }
})();