// Configuration for easy local/AWS switching
const isDevelopment = import.meta.env.DEV;

const config = {
  // API Configuration
  api: {
    baseURL: import.meta.env.VITE_API_URL || '',
    endpoints: {
      // Plaid
      createLinkToken: '/api/plaid/create-link-token',
      exchangePublicToken: '/api/plaid/exchange-public-token',
      
      // Lambda functions
      syncTransactions: '/api/lambda/plaid-sync',
      processBills: '/api/lambda/process-bills',
      generateReport: '/api/lambda/generate-report',
      
      // Dashboard
      transactions: '/api/transactions',
      summary: '/api/summary',
      monthlyComparison: '/api/monthly-comparison',
      paymentRequests: '/api/payment-requests',
      ledger: '/api/ledger',
      ledgerSummary: '/api/ledger/summary',
    }
  },
  
  // Feature flags
  features: {
    authentication: false, // Enable when adding Cognito
    realtimeSync: false,  // Enable when adding WebSockets
  },
  
  // UI Configuration
  ui: {
    itemsPerPage: 25,
    dateFormat: 'MM/dd/yyyy',
    currencyFormat: {
      style: 'currency',
      currency: 'USD',
    }
  },
  
  // Plaid Configuration (public settings only)
  plaid: {
    environment: import.meta.env.VITE_PLAID_ENV || 'sandbox',
    products: ['transactions'],
    countryCodes: ['US'],
  }
};

export default config;