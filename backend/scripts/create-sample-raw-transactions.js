const db = require('../src/db/connection');

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function subtractDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() - days);
  return result;
}

function subtractMonths(date, months) {
  const result = new Date(date);
  result.setMonth(result.getMonth() - months);
  return result;
}

async function createSampleRawTransactions() {
  console.log('🎯 Creating sample raw transactions for testing...');
  
  try {
    const currentDate = new Date();
    const sampleTransactions = [
      // Recent electricity bills (PG&E)
      {
        simplefin_id: `pge_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -245.67,
        posted_date: formatDate(subtractDays(currentDate, 5)),
        description: 'PG&E AUTOPAY',
        payee: 'Pacific Gas & Electric',
        category: 'Service',
        suggested_expense_type: 'electricity',
        confidence_score: 0.95,
        processed: false
      },
      {
        simplefin_id: `pge_${Date.now()}_2`,
        simplefin_account_id: 'sample_account',
        amount: -189.34,
        posted_date: formatDate(subtractMonths(currentDate, 1)),
        description: 'PG&E ELECTRIC BILL',
        payee: 'PG&E',
        category: 'Service',
        suggested_expense_type: 'electricity',
        confidence_score: 0.90,
        processed: false
      },
      
      // Water bills
      {
        simplefin_id: `water_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -89.45,
        posted_date: formatDate(subtractDays(currentDate, 8)),
        description: 'GREAT OAKS WATER CO',
        payee: 'Great Oaks Water',
        category: 'Service',
        suggested_expense_type: 'water',
        confidence_score: 0.92,
        processed: false
      },
      {
        simplefin_id: `water_${Date.now()}_2`,
        simplefin_account_id: 'sample_account',
        amount: -76.23,
        posted_date: formatDate(subtractMonths(currentDate, 1)),
        description: 'GREAT OAKS WATER CO AUTOPAY',
        payee: 'Great Oaks Water',
        category: 'Service',
        suggested_expense_type: 'water',
        confidence_score: 0.95,
        processed: false
      },

      // Internet bills (Comcast)
      {
        simplefin_id: `internet_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -79.95,
        posted_date: formatDate(subtractDays(currentDate, 3)),
        description: 'COMCAST CABLE BILL',
        payee: 'Comcast',
        category: 'Service',
        suggested_expense_type: 'internet',
        confidence_score: 0.88,
        processed: false
      },
      
      // Maintenance/Supplies from Home Depot
      {
        simplefin_id: `hd_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -127.45,
        posted_date: formatDate(subtractDays(currentDate, 12)),
        description: 'HOME DEPOT #1234',
        payee: 'Home Depot',
        category: 'Shops',
        suggested_expense_type: 'maintenance',
        confidence_score: 0.85,
        processed: false
      },
      {
        simplefin_id: `lowes_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -85.67,
        posted_date: formatDate(subtractDays(currentDate, 18)),
        description: 'LOWES #5678',
        payee: 'Lowes',
        category: 'Shops',
        suggested_expense_type: 'maintenance',
        confidence_score: 0.87,
        processed: false
      },

      // Cleaning/Maintenance service (Carlos Gardener - should auto-approve with ETL rule)
      {
        simplefin_id: `carlos_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -150.00,
        posted_date: formatDate(subtractDays(currentDate, 7)),
        description: 'VENMO PAYMENT - CARLOS GARDENER',
        payee: 'Carlos Gardener',
        category: 'Service',
        suggested_expense_type: 'landscape',
        confidence_score: 0.98,
        processed: false
      },

      // Property tax
      {
        simplefin_id: `tax_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -2750.00,
        posted_date: formatDate(subtractDays(currentDate, 30)),
        description: 'ALAMEDA COUNTY TAX COLLECTOR',
        payee: 'Alameda County',
        category: 'Government Services',
        suggested_expense_type: 'property_tax',
        confidence_score: 0.99,
        processed: false
      },

      // Insurance
      {
        simplefin_id: `insurance_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: -145.83,
        posted_date: formatDate(subtractDays(currentDate, 15)),
        description: 'FARMERS INSURANCE AUTOPAY',
        payee: 'Farmers Insurance',
        category: 'Service',
        suggested_expense_type: 'insurance',
        confidence_score: 0.93,
        processed: false
      },

      // Some rent income (these should stay as 'other' and not be auto-processed)
      {
        simplefin_id: `rent_${Date.now()}_1`,
        simplefin_account_id: 'sample_account',
        amount: 1685.00,
        posted_date: formatDate(subtractDays(currentDate, 2)),
        description: 'ZELLE FROM USHI LO',
        payee: 'Zelle',
        category: 'Transfer',
        suggested_expense_type: 'other',
        confidence_score: 0.75,
        processed: false
      },
      {
        simplefin_id: `rent_${Date.now()}_2`,
        simplefin_account_id: 'sample_account',
        amount: 1685.00,
        posted_date: formatDate(subtractMonths(currentDate, 1)),
        description: 'ZELLE FROM USHI LO - RENT',
        payee: 'Zelle',
        category: 'Transfer',
        suggested_expense_type: 'other',
        confidence_score: 0.80,
        processed: false
      }
    ];

    console.log(`🔄 Inserting ${sampleTransactions.length} sample transactions...`);
    
    for (const transaction of sampleTransactions) {
      const result = await db.insert('raw_transactions', {
        simplefin_id: transaction.simplefin_id,
        simplefin_account_id: transaction.simplefin_account_id,
        amount: transaction.amount,
        posted_date: transaction.posted_date,
        description: transaction.description,
        payee: transaction.payee,
        category: transaction.category,
        suggested_expense_type: transaction.suggested_expense_type,
        confidence_score: transaction.confidence_score,
        processed: transaction.processed,
        created_at: new Date()
      });
      
      console.log(`✅ Added: ${transaction.description} - $${transaction.amount}`);
    }
    
    console.log('\\n✨ Sample raw transactions created successfully!');
    console.log('📊 Summary:');
    
    const totalExpenses = sampleTransactions
      .filter(t => t.amount < 0)
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    const totalIncome = sampleTransactions
      .filter(t => t.amount > 0)
      .reduce((sum, t) => sum + t.amount, 0);
    
    console.log(`   - Total Expenses: $${totalExpenses.toFixed(2)}`);
    console.log(`   - Total Income: $${totalIncome.toFixed(2)}`);
    console.log(`   - Net: $${(totalIncome - totalExpenses).toFixed(2)}`);
    console.log('\\n🎯 Ready to run ETL processing!');
    
  } catch (error) {
    console.error('❌ Error creating sample data:', error);
    process.exit(1);
  }
}

// Run the creation
createSampleRawTransactions()
  .then(() => {
    console.log('\\n✅ Sample data creation complete!');
    process.exit(0);
  })
  .catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
  });