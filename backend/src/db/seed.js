require('dotenv').config();
const db = require('./connection');

async function seed() {
  console.log('Starting database seed...');

  try {
    // Clear existing data
    await db.query('DELETE FROM payment_requests');
    await db.query('DELETE FROM utility_bills');
    await db.query('DELETE FROM transactions');
    
    // Insert sample transactions
    const transactions = [
      {
        plaid_transaction_id: 'sample_001',
        name: 'PG&E Energy Statement',
        merchant_name: 'PG&E',
        amount: 245.67,
        date: new Date('2025-01-15'),
        expense_type: 'electricity',
        plaid_account_id: 'bank_account_1'
      },
      {
        plaid_transaction_id: 'sample_002',
        name: 'Great Oaks Water Company',
        merchant_name: 'Great Oaks Water District',
        amount: 98.34,
        date: new Date('2025-01-18'),
        expense_type: 'water',
        plaid_account_id: 'bank_account_1'
      },
      {
        plaid_transaction_id: 'sample_003',
        name: 'Tenant Rent Payment',
        merchant_name: 'Venmo',
        amount: 2100.00,
        date: new Date('2025-01-01'),
        expense_type: 'rent',
        plaid_account_id: 'bank_account_1'
      },
      {
        plaid_transaction_id: 'sample_004',
        name: 'Home Depot - Maintenance',
        merchant_name: 'Home Depot',
        amount: 67.89,
        date: new Date('2025-01-20'),
        expense_type: 'maintenance',
        plaid_account_id: 'bank_account_1'
      },
      {
        plaid_transaction_id: 'sample_005',
        name: 'PG&E Energy Statement',
        merchant_name: 'Pacific Gas & Electric',
        amount: 189.45,
        date: new Date('2024-12-15'),
        expense_type: 'electricity',
        plaid_account_id: 'bank_account_1'
      },
      {
        plaid_transaction_id: 'sample_006',
        name: 'Great Oaks Water Service',
        merchant_name: 'Great Oaks Water',
        amount: 112.67,
        date: new Date('2024-12-18'),
        expense_type: 'water',
        plaid_account_id: 'bank_account_1'
      },
      {
        plaid_transaction_id: 'sample_007',
        name: 'Pacific Gas and Electric',
        merchant_name: 'PGE',
        amount: 312.89,
        date: new Date('2024-11-15'),
        expense_type: 'electricity',
        plaid_account_id: 'bank_account_1'
      },
      {
        plaid_transaction_id: 'sample_008',
        name: 'Water Bill',
        merchant_name: 'Great Oaks Water Company',
        amount: 87.23,
        date: new Date('2024-11-18'),
        expense_type: 'water',
        plaid_account_id: 'bank_account_1'
      }
    ];

    console.log('Inserting transactions...');
    for (const transaction of transactions) {
      await db.insert('transactions', transaction);
    }

    console.log(`Inserted ${transactions.length} transactions`);
    
    // Now run bill processing for the current month
    const processBills = require('../lambdas/processBills');
    console.log('Running bill processing for January 2025...');
    
    const result = await processBills.handler({ 
      date: '2025-01-30' // Process for January 2025
    }, {});
    
    console.log('Bill processing result:', JSON.parse(result.body));

    console.log('Seed completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Seed error:', error);
    process.exit(1);
  }
}

seed();