const axios = require('axios');
const db = require('../db/connection');
const moment = require('moment');
const paymentRequestService = require('./paymentRequestService');

class SimpleFINService {
  constructor() {
    // SimpleFIN tokens are full URLs with embedded auth
    this.accessUrl = process.env.SIMPLEFIN_TOKEN;
    
    if (!this.accessUrl) {
      console.error('SIMPLEFIN_TOKEN not configured');
    } else {
      console.log('[SimpleFIN] Token configured, length:', this.accessUrl.length);
    }
  }

  async getAccounts() {
    try {
      if (!this.accessUrl) {
        throw new Error('SimpleFIN not configured');
      }
      
      // SimpleFIN returns accounts from the /accounts endpoint
      const accountsUrl = `${this.accessUrl}/accounts`;
      console.log('[SimpleFIN getAccounts] URL:', accountsUrl);
      
      const response = await axios.get(accountsUrl);
      
      return response.data.accounts;
    } catch (error) {
      console.error('SimpleFIN accounts error:', error.message);
      throw error;
    }
  }

  async syncTransactions(startDate = null) {
    let totalSaved = 0; // Move this up so it's accessible in catch block
    
    try {
      if (!this.accessUrl) {
        console.error('SimpleFIN access URL is not configured');
        throw new Error('SimpleFIN not configured');
      }
      
      console.log('SimpleFIN access URL length:', this.accessUrl.length);
      console.log('Access URL starts with:', this.accessUrl.substring(0, 30));
      
      // Default to last 365 days if no start date
      if (!startDate) {
        startDate = moment().subtract(365, 'days').unix();
      } else {
        startDate = moment(startDate).unix();
      }
      
      const endDate = moment().unix();

      // SimpleFIN URLs already contain query params, use & to append
      const separator = this.accessUrl.includes('?') ? '&' : '?';
      const url = `${this.accessUrl}/accounts${separator}start-date=${startDate}&end-date=${endDate}`;
      
      const requestedDays = Math.round((endDate - startDate) / 86400);
      console.log(`Fetching transactions from ${moment.unix(startDate).format('YYYY-MM-DD')} to ${moment.unix(endDate).format('YYYY-MM-DD')}`);
      console.log(`Requesting ${requestedDays} days of transaction history`);
      console.log('Connecting to SimpleFIN...');
      
      // Debug URL construction
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        console.error('WARNING: Constructed URL does not start with http:// or https://');
        console.error('Access URL:', this.accessUrl);
        console.error('Constructed URL:', url);
      }
      
      // Validate URL before making request
      if (!url || typeof url !== 'string') {
        throw new Error(`Invalid SimpleFIN URL: ${url}`);
      }
      
      // Add timeout to prevent hanging
      const response = await axios.get(url, {
        timeout: 120000, // 2 minute timeout - more reasonable for large data fetches
        headers: {
          'User-Agent': 'LandlordDashboard/1.0'
        }
      });

      const accounts = response.data.accounts;
      // totalSaved already declared at top of function

      console.log(`Found ${accounts.length} accounts`);
      
      // Debug: Check date range of returned transactions
      let oldestDate = null;
      let newestDate = null;
      
      for (const account of accounts) {
        console.log(`Account: ${account.name}, Transactions: ${account.transactions?.length || 0}`);
        
        // Find date range of transactions
        if (account.transactions && account.transactions.length > 0) {
          const dates = account.transactions.map(t => new Date(t.posted * 1000));
          const accountOldest = new Date(Math.min(...dates));
          const accountNewest = new Date(Math.max(...dates));
          
          if (!oldestDate || accountOldest < oldestDate) oldestDate = accountOldest;
          if (!newestDate || accountNewest > newestDate) newestDate = accountNewest;
          
          console.log(`  Date range: ${accountOldest.toISOString().split('T')[0]} to ${accountNewest.toISOString().split('T')[0]}`);
        }
        
        // Process all accounts, not just checking
        const savedCount = await this.saveTransactions(account.transactions || [], account.id);
        totalSaved += savedCount;
      }
      
      if (oldestDate && newestDate) {
        const daysFetched = Math.round((newestDate - oldestDate) / (1000 * 60 * 60 * 24));
        console.log(`\n📊 Actual data received spans ${daysFetched} days`);
        console.log(`   Oldest transaction: ${oldestDate.toISOString().split('T')[0]}`);
        console.log(`   Newest transaction: ${newestDate.toISOString().split('T')[0]}`);
      }

      return {
        success: true,
        transactionsSaved: totalSaved,
        message: `Synced ${totalSaved} new transactions`
      };
    } catch (error) {
      console.error('SimpleFIN sync error:', error);
      console.error('Error details:', {
        code: error.code,
        message: error.message,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method
        } : 'No config'
      });
      
      // If it succeeded despite the error, return the results
      if (totalSaved > 0) {
        console.log(`Despite error, ${totalSaved} transactions were saved`);
        return {
          success: true,
          transactionsSaved: totalSaved,
          message: `Synced ${totalSaved} new transactions (with errors)`
        };
      }
      
      throw error;
    }
  }

  async saveTransactions(transactions, accountId) {
    let savedCount = 0;

    for (const transaction of transactions) {
      try {
        // Check if transaction already exists using natural keys (cross-source duplicate detection)
        const dateString = new Date(transaction.posted * 1000).toISOString().split('T')[0];
        const existing = await db.getOne(
          `SELECT id, simplefin_id FROM raw_transactions 
           WHERE posted_date = $1 
             AND amount = $2 
             AND description = $3`,
          [dateString, transaction.amount, transaction.description]
        );

        if (!existing) {
          // SimpleFIN provides amount as negative for debits
          const amount = Math.abs(transaction.amount);
          
          // Auto-exclude positive amounts (deposits/income)
          // We track income through payment requests, not bank deposits
          const isDeposit = transaction.amount > 0;
          let suggestions = { 
            excluded: isDeposit,
            exclude_reason: isDeposit ? 'Bank deposit - income tracked via payment requests' : null,
            expense_type: null,
            merchant: null,
            confidence: isDeposit ? 1.0 : 0,
            auto_approve: false
          };
          
          // Only apply ETL rules for expenses (negative amounts)
          if (!isDeposit) {
            suggestions = await this.applyETLRules(transaction);
          }
          
          // Save ALL transactions to raw_transactions for review
          await db.insert('raw_transactions', {
            simplefin_id: transaction.id,
            simplefin_account_id: accountId,
            amount: transaction.amount, // Keep original sign for reference
            posted_date: dateString,
            description: transaction.description,
            payee: transaction.payee,
            category: transaction.category,
            suggested_expense_type: suggestions.expense_type,
            suggested_merchant: suggestions.merchant,
            confidence_score: suggestions.confidence,
            excluded: suggestions.excluded,
            exclude_reason: suggestions.exclude_reason,
            processed: suggestions.auto_approve || isDeposit // Mark deposits as processed
          });

          // Only auto-approve EXPENSES (negative amounts) to expenses table
          if (suggestions.auto_approve && !suggestions.excluded && transaction.amount < 0) {
            console.log(`[Auto-Approve] ${transaction.description} -> ${suggestions.expense_type}`);
            
            const expense = await db.insert('expenses', {
              simplefin_transaction_id: `simplefin_${transaction.id}`,
              simplefin_account_id: accountId,
              amount: amount,
              date: dateString,
              name: transaction.description,
              merchant_name: suggestions.merchant || transaction.payee || this.extractMerchant(transaction.description),
              expense_type: suggestions.expense_type || 'other',
              category: transaction.category || 'Other',
              subcategory: null
            });
            
            // Payment requests are now created automatically by database trigger
          }

          savedCount++;
        }
      } catch (error) {
        console.error('Error saving transaction:', error);
      }
    }

    return savedCount;
  }

  classifyTransaction(transaction) {
    const description = (transaction.description || '').toLowerCase();
    const payee = (transaction.payee || '').toLowerCase();
    const combined = `${description} ${payee}`;
    const category = (transaction.category || '').toLowerCase();

    // First check SimpleFIN category data
    if (category) {
      // Internet/Cable/Phone services
      if (category.includes('cable') || category.includes('internet') || 
          category.includes('telecommunication') || category.includes('phone service')) {
        return 'internet';
      }
      // Utilities
      else if (category.includes('utilities') || category.includes('electric') || 
               category.includes('gas')) {
        // Further classify utilities based on merchant
        if (combined.includes('pge') || combined.includes('pg&e') || 
            combined.includes('pacific gas') || combined.includes('electric')) {
          return 'electricity';
        } else if (combined.includes('ebmud') || combined.includes('water') || 
                   combined.includes('great oaks')) {
          return 'water';
        } else if (combined.includes('xfinity mobile')) {
          return 'other'; // Phone service, not internet
        } else if (combined.includes('comcast') || combined.includes('xfinity')) {
          return 'internet';
        }
        // Default utilities to electricity if can't determine
        return 'electricity';
      }
      // Home improvement/maintenance
      else if (category.includes('home improvement') || category.includes('home supplies') ||
               category.includes('hardware') || category.includes('repair')) {
        return 'maintenance';
      }
      // Income/Transfers - likely rent (but not Venmo)
      else if (category.includes('transfer') || category.includes('deposit') || 
               category.includes('income')) {
        // Don't classify Venmo as rent anymore
        if (!combined.includes('venmo') && transaction.amount > 0 && transaction.amount > 1000) {
          return 'rent';
        }
      }
    }

    // Fallback to keyword matching if category didn't help
    // Check for specific Zelle payments first
    if (combined.includes('zelle') && combined.includes('carlos') && combined.includes('garden')) {
      return 'landscape';
    }
    // Check for Xfinity Mobile first (phone service, not internet)
    else if (combined.includes('xfinity mobile')) {
      return 'other'; // Phone service, not internet
    } else if (combined.includes('comcast') || combined.includes('xfinity')) {
      return 'internet';
    } else if (combined.includes('pg&e') || combined.includes('pacific gas') || combined.includes('pge')) {
      return 'electricity';
    } else if (combined.includes('great oaks') || combined.includes('water')) {
      return 'water';
    } else if (combined.includes('gardener') || combined.includes('landscape') || 
               combined.includes('lawn') || combined.includes('yard')) {
      return 'landscape';
    } else if (combined.includes('home depot') || combined.includes('lowes') || 
               combined.includes('repair') || combined.includes('maintenance')) {
      return 'maintenance';
    } else if (!combined.includes('venmo') && transaction.amount > 0 && transaction.amount > 1500) {
      // Large credits are likely rent payments (but not Venmo)
      return 'rent';
    } else {
      return 'other';
    }
  }

  extractMerchant(description) {
    // Extract merchant name from description
    const cleanDesc = description.replace(/[0-9]/g, '').trim();
    const parts = cleanDesc.split(/\s+/);
    return parts.slice(0, 3).join(' ');
  }

  async applyETLRules(transaction) {
    try {
      // Get all active ETL rules ordered by priority
      const rulesResult = await db.query(
        `SELECT * FROM etl_rules 
         WHERE active = true 
         ORDER BY priority DESC, id ASC`
      );
      
      const rules = rulesResult.rows;

      let result = {
        expense_type: null,
        merchant: null,
        confidence: 0,
        excluded: false,
        exclude_reason: null,
        auto_approve: false
      };

      const description = (transaction.description || '').toLowerCase();
      const payee = (transaction.payee || '').toLowerCase();
      const amount = transaction.amount;

      // Apply each rule
      for (const rule of rules) {
        let matches = true;

        // Check description pattern
        if (rule.description_pattern) {
          const regex = new RegExp(rule.description_pattern, 'i');
          if (!regex.test(description)) {
            matches = false;
          }
        }

        // Check payee pattern
        if (rule.payee_pattern && matches) {
          const regex = new RegExp(rule.payee_pattern, 'i');
          if (!regex.test(payee)) {
            matches = false;
          }
        }

        // Check amount range
        if (matches && (rule.amount_min !== null || rule.amount_max !== null)) {
          if (rule.amount_min !== null && amount < rule.amount_min) {
            matches = false;
          }
          if (rule.amount_max !== null && amount > rule.amount_max) {
            matches = false;
          }
        }

        // Apply rule if it matches
        if (matches) {
          if (rule.action === 'exclude') {
            result.excluded = true;
            result.exclude_reason = rule.exclude_reason || rule.rule_name;
            result.confidence = 1.0;
            break; // Stop processing if excluded
          } else if (rule.action === 'categorize' || rule.action === 'approve') {
            result.expense_type = rule.expense_type;
            result.merchant = rule.merchant_name;
            result.confidence = 0.9;
            // Auto-approve if action is 'approve' or high-priority categorize
            if (rule.action === 'approve' || rule.priority >= 100) {
              result.auto_approve = true;
            }
          }
        }
      }

      // If no rules matched, use basic classification
      if (!result.expense_type && !result.excluded) {
        result.expense_type = this.classifyTransaction(transaction);
        result.confidence = 0.5;
      }

      return result;
    } catch (error) {
      console.error('Error applying ETL rules:', error);
      return {
        expense_type: 'other',
        merchant: null,
        confidence: 0,
        excluded: false,
        exclude_reason: null,
        auto_approve: false
      };
    }
  }

  // Webhook setup removed - not used and was causing errors
  // SimpleFIN handles webhooks differently than this implementation
}

module.exports = new SimpleFINService();