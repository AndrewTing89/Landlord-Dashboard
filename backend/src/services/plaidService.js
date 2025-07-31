require('dotenv').config();
const { Configuration, PlaidApi, PlaidEnvironments } = require('plaid');

// Configure Plaid client
const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV || 'sandbox'],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

const plaidClient = new PlaidApi(configuration);

// Store access token in memory (will be loaded from DB in production)
let ACCESS_TOKEN = null;

const plaidService = {
  // Create link token for Plaid Link
  createLinkToken: async (userId = 'landlord-dashboard-user') => {
    try {
      const request = {
        user: {
          client_user_id: userId,
        },
        client_name: 'Landlord Dashboard',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en',
        // Add webhook for real-time updates (optional)
        // webhook: 'https://your-api.com/plaid/webhook',
      };

      const response = await plaidClient.linkTokenCreate(request);
      return response.data.link_token;
    } catch (error) {
      console.error('Error creating link token:', error.response?.data || error);
      throw error;
    }
  },

  // Exchange public token for access token
  exchangePublicToken: async (publicToken) => {
    try {
      const request = {
        public_token: publicToken,
      };

      const response = await plaidClient.itemPublicTokenExchange(request);
      ACCESS_TOKEN = response.data.access_token;
      
      // Get item details
      const itemResponse = await plaidClient.itemGet({
        access_token: ACCESS_TOKEN,
      });
      
      return {
        access_token: ACCESS_TOKEN,
        item_id: response.data.item_id,
        institution: itemResponse.data.item.institution_id,
      };
    } catch (error) {
      console.error('Error exchanging public token:', error.response?.data || error);
      throw error;
    }
  },

  // Get accounts
  getAccounts: async (accessToken = ACCESS_TOKEN) => {
    try {
      const request = {
        access_token: accessToken,
      };

      const response = await plaidClient.accountsGet(request);
      return response.data.accounts;
    } catch (error) {
      console.error('Error getting accounts:', error.response?.data || error);
      throw error;
    }
  },

  // Get transactions for date range
  getTransactions: async (startDate, endDate, accessToken = ACCESS_TOKEN) => {
    try {
      const request = {
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
        options: {
          count: 500,
          offset: 0,
        },
      };

      let allTransactions = [];
      let hasMore = true;

      while (hasMore) {
        const response = await plaidClient.transactionsGet(request);
        allTransactions = allTransactions.concat(response.data.transactions);
        
        if (response.data.total_transactions > allTransactions.length) {
          request.options.offset = allTransactions.length;
        } else {
          hasMore = false;
        }
      }

      return allTransactions;
    } catch (error) {
      console.error('Error getting transactions:', error.response?.data || error);
      throw error;
    }
  },

  // Sync transactions (for real-time updates)
  syncTransactions: async (accessToken = ACCESS_TOKEN, cursor = null) => {
    try {
      let hasMore = true;
      let nextCursor = cursor;
      const allTransactions = {
        added: [],
        modified: [],
        removed: [],
      };

      while (hasMore) {
        const request = {
          access_token: accessToken,
        };
        
        if (nextCursor) {
          request.cursor = nextCursor;
        }

        const response = await plaidClient.transactionsSync(request);
        const data = response.data;

        allTransactions.added.push(...data.added);
        allTransactions.modified.push(...data.modified);
        allTransactions.removed.push(...data.removed);
        
        hasMore = data.has_more;
        nextCursor = data.next_cursor;
      }

      return allTransactions.added; // For now, just return added transactions
    } catch (error) {
      console.error('Error syncing transactions:', error.response?.data || error);
      
      // If sync fails, fall back to regular transaction fetch
      if (error.response?.status === 400) {
        console.log('Falling back to regular transaction fetch...');
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        return await plaidService.getTransactions(startDate, endDate, accessToken);
      }
      
      throw error;
    }
  },

  // Create sandbox test data
  createSandboxData: async (accessToken = ACCESS_TOKEN) => {
    if (process.env.PLAID_ENV !== 'sandbox') {
      throw new Error('Sandbox data creation only available in sandbox mode');
    }

    try {
      // Fire webhook to populate transactions
      await plaidClient.sandboxItemFireWebhook({
        access_token: accessToken,
        webhook_code: 'DEFAULT_UPDATE',
      });

      console.log('Sandbox data creation initiated');
      return true;
    } catch (error) {
      console.error('Error creating sandbox data:', error.response?.data || error);
      throw error;
    }
  },

  // Set access token (for loading from database)
  setAccessToken: (token) => {
    ACCESS_TOKEN = token;
  },

  // Get access token
  getAccessToken: () => {
    return ACCESS_TOKEN;
  }
};

module.exports = plaidService;