require('dotenv').config();
const db = require('../src/db/connection');

async function checkWaterIssue() {
  try {
    console.log('Checking water transactions and rules...\n');

    // Check ETL rules for water
    const waterRules = await db.query(
      `SELECT * FROM etl_rules WHERE expense_type = 'water' ORDER BY priority DESC`
    );
    
    console.log('Water ETL Rules:');
    console.log('================');
    if (waterRules.rows.length === 0) {
      console.log('❌ No water ETL rules found!');
    } else {
      waterRules.rows.forEach(rule => {
        console.log(`Rule: ${rule.rule_name}`);
        console.log(`  Description Pattern: ${rule.description_pattern}`);
        console.log(`  Payee Pattern: ${rule.payee_pattern}`);
        console.log(`  Priority: ${rule.priority}`);
        console.log(`  Auto-approve: ${rule.priority >= 100 ? 'Yes' : 'No'}`);
        console.log('');
      });
    }

    // Check water transactions
    const waterTransactions = await db.query(
      `SELECT * FROM transactions WHERE expense_type = 'water' ORDER BY date DESC LIMIT 10`
    );
    
    console.log('\nWater Transactions:');
    console.log('==================');
    if (waterTransactions.rows.length === 0) {
      console.log('❌ No water transactions found!');
    } else {
      waterTransactions.rows.forEach(tx => {
        console.log(`Date: ${tx.date}, Amount: $${tx.amount}, Merchant: ${tx.merchant_name}`);
        console.log(`  Description: ${tx.name}`);
      });
    }

    // Check utility bills for water
    const waterBills = await db.query(
      `SELECT * FROM utility_bills WHERE bill_type = 'water' ORDER BY created_at DESC LIMIT 10`
    );
    
    console.log('\nWater Utility Bills:');
    console.log('===================');
    if (waterBills.rows.length === 0) {
      console.log('❌ No water utility bills found!');
    } else {
      waterBills.rows.forEach(bill => {
        console.log(`Month: ${bill.month}/${bill.year}, Total: $${bill.total_amount}, Split: $${bill.split_amount}`);
      });
    }

    // Check payment requests for water
    const waterPaymentRequests = await db.query(
      `SELECT * FROM payment_requests WHERE bill_type = 'water' ORDER BY created_at DESC LIMIT 10`
    );
    
    console.log('\nWater Payment Requests:');
    console.log('======================');
    if (waterPaymentRequests.rows.length === 0) {
      console.log('❌ No water payment requests found!');
    } else {
      waterPaymentRequests.rows.forEach(pr => {
        console.log(`Amount: $${pr.amount}, Status: ${pr.status}, Total: $${pr.bill_total_amount || 'NULL'}`);
      });
    }

    // Check for potential water transactions that weren't classified
    const potentialWaterTransactions = await db.query(
      `SELECT * FROM transactions 
       WHERE (name ILIKE '%water%' OR name ILIKE '%great oaks%' OR merchant_name ILIKE '%water%' OR merchant_name ILIKE '%great oaks%')
       AND expense_type != 'water'
       ORDER BY date DESC LIMIT 10`
    );
    
    console.log('\nPotential Misclassified Water Transactions:');
    console.log('==========================================');
    if (potentialWaterTransactions.rows.length === 0) {
      console.log('✅ No misclassified water transactions found');
    } else {
      potentialWaterTransactions.rows.forEach(tx => {
        console.log(`Date: ${tx.date}, Amount: $${tx.amount}, Type: ${tx.expense_type}`);
        console.log(`  Name: ${tx.name}`);
        console.log(`  Merchant: ${tx.merchant_name}`);
      });
    }

  } catch (error) {
    console.error('Error:', error);
  } finally {
    process.exit();
  }
}

checkWaterIssue();