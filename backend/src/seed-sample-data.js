const db = require('./db/connection');
const moment = require('moment');
require('dotenv').config();

async function seedSampleData() {
  console.log('Seeding sample data for testing...');
  
  try {
    // Sample transactions for the current month
    const currentMonth = moment();
    const sampleTransactions = [
      // Rent income
      {
        plaid_transaction_id: 'rent_' + Date.now(),
        plaid_account_id: 'sample_account',
        amount: 3500,
        date: currentMonth.clone().subtract(5, 'days').format('YYYY-MM-DD'),
        name: 'Zelle Transfer - Tenant Payment',
        merchant_name: 'Zelle',
        category: 'Transfer',
        subcategory: 'Deposit',
        expense_type: 'rent'
      },
      // Utility bills
      {
        plaid_transaction_id: 'pge_' + Date.now(),
        plaid_account_id: 'sample_account',
        amount: 245.67,
        date: currentMonth.clone().subtract(7, 'days').format('YYYY-MM-DD'),
        name: 'PG&E AUTOPAY',
        merchant_name: 'Pacific Gas & Electric',
        category: 'Service',
        subcategory: 'Utilities',
        expense_type: 'electricity'
      },
      {
        plaid_transaction_id: 'water_' + Date.now(),
        plaid_account_id: 'sample_account',
        amount: 89.45,
        date: currentMonth.clone().subtract(10, 'days').format('YYYY-MM-DD'),
        name: 'EBMUD Water Service',
        merchant_name: 'East Bay Municipal Utility',
        category: 'Service',
        subcategory: 'Utilities',
        expense_type: 'water'
      },
      // Maintenance
      {
        plaid_transaction_id: 'hd_' + Date.now(),
        plaid_account_id: 'sample_account',
        amount: 156.32,
        date: currentMonth.clone().subtract(15, 'days').format('YYYY-MM-DD'),
        name: 'HOME DEPOT #1234',
        merchant_name: 'Home Depot',
        category: 'Shops',
        subcategory: 'Hardware Store',
        expense_type: 'maintenance'
      },
      {
        plaid_transaction_id: 'lowes_' + Date.now(),
        plaid_account_id: 'sample_account',
        amount: 78.99,
        date: currentMonth.clone().subtract(20, 'days').format('YYYY-MM-DD'),
        name: 'LOWES #5678',
        merchant_name: 'Lowes',
        category: 'Shops',
        subcategory: 'Hardware Store',
        expense_type: 'maintenance'
      },
      // Other expenses
      {
        plaid_transaction_id: 'other_' + Date.now(),
        plaid_account_id: 'sample_account',
        amount: 45.00,
        date: currentMonth.clone().subtract(12, 'days').format('YYYY-MM-DD'),
        name: 'Property Management Software',
        merchant_name: 'PropSoft Inc',
        category: 'Service',
        subcategory: 'Subscription',
        expense_type: 'other'
      }
    ];

    // Insert transactions
    console.log('\nInserting sample transactions...');
    for (const transaction of sampleTransactions) {
      try {
        await db.insert('transactions', transaction);
        console.log(`  ✓ Added: ${transaction.name} - $${transaction.amount}`);
      } catch (error) {
        if (error.code === '23505') { // Unique constraint violation
          console.log(`  - Skipped: ${transaction.name} (already exists)`);
        } else {
          console.error(`  ✗ Error adding ${transaction.name}:`, error.message);
        }
      }
    }

    // Calculate summary
    const summary = await db.getMany(
      `SELECT expense_type, COUNT(*) as count, SUM(amount) as total
       FROM transactions
       GROUP BY expense_type`
    );

    console.log('\n📊 Current Database Summary:');
    console.log('================================');
    summary.forEach(item => {
      console.log(`${item.expense_type}: ${item.count} transactions, $${item.total}`);
    });
    console.log('================================');

    console.log('\n✅ Sample data seeding complete!');
    console.log('You can now view the dashboard at http://localhost:3000');
    
  } catch (error) {
    console.error('Error seeding data:', error);
  } finally {
    await db.close();
  }
}

// Run if called directly
if (require.main === module) {
  seedSampleData();
}

module.exports = seedSampleData;