const db = require('../db/connection');

class TransactionClassifier {
  constructor() {
    this.categories = null;
  }

  // Load categories from database
  async loadCategories() {
    try {
      const categories = await db.getMany('SELECT * FROM expense_categories');
      this.categories = categories.map(cat => ({
        ...cat,
        keywords: cat.keywords // JSONB is automatically parsed by pg
      }));
      console.log(`Loaded ${this.categories.length} expense categories`);
    } catch (error) {
      console.error('Error loading categories:', error);
      throw error;
    }
  }

  // Classify a single transaction
  classifyTransaction(transaction) {
    if (!this.categories) {
      throw new Error('Categories not loaded. Call loadCategories() first.');
    }

    const transactionName = (transaction.name || '').toUpperCase();
    const merchantName = (transaction.merchant_name || '').toUpperCase();
    const amount = transaction.amount;
    
    // Special logic for rent (income) - negative amounts in Plaid mean money coming in
    if (amount < 0) {
      const lowerName = transactionName.toLowerCase();
      const lowerMerchant = merchantName.toLowerCase();
      
      // Check for common rent payment patterns (but not Venmo anymore)
      if (lowerName.includes('rent') || 
          lowerName.includes('tenant')) {
        return 'rent';
      }
    }
    
    // Check each category for expense classification
    for (const category of this.categories) {
      if (category.category_name === 'other') continue; // Skip 'other' for now
      
      // Check if any keyword matches
      for (const keyword of category.keywords) {
        if (keyword && (transactionName.includes(keyword) || merchantName.includes(keyword))) {
          return category.category_name;
        }
      }
    }
    
    // Check Plaid categories as fallback
    if (transaction.category) {
      const plaidCategory = transaction.category[0]?.toLowerCase() || '';
      
      if (plaidCategory.includes('utilities')) {
        // Try to determine if it's water or electricity based on merchant
        if (merchantName.includes('WATER') || merchantName.includes('EBMUD')) {
          return 'water';
        } else if (merchantName.includes('PGE') || merchantName.includes('ELECTRIC')) {
          return 'electricity';
        }
      }
      
      if (plaidCategory.includes('home improvement') || plaidCategory.includes('hardware')) {
        return 'maintenance';
      }
    }

    // Default to 'other'
    return 'other';
  }

  // Classify multiple transactions
  async classifyTransactions(transactions) {
    if (!this.categories) {
      await this.loadCategories();
    }

    console.log(`Classifying ${transactions.length} transactions...`);
    
    const classified = transactions.map(transaction => ({
      ...transaction,
      expense_type: this.classifyTransaction(transaction)
    }));

    // Log classification summary
    const summary = classified.reduce((acc, t) => {
      acc[t.expense_type] = (acc[t.expense_type] || 0) + 1;
      return acc;
    }, {});
    
    console.log('Classification summary:', summary);
    
    return classified;
  }

  // Add or update classification rules
  async updateCategoryKeywords(categoryName, keywords) {
    try {
      await db.query(
        `UPDATE expense_categories 
         SET keywords = $1::jsonb 
         WHERE category_name = $2`,
        [JSON.stringify(keywords), categoryName]
      );
      
      // Reload categories
      await this.loadCategories();
      
      return true;
    } catch (error) {
      console.error('Error updating category keywords:', error);
      throw error;
    }
  }

  // Get classification statistics
  async getClassificationStats(startDate, endDate) {
    try {
      const stats = await db.getMany(
        `SELECT 
          expense_type,
          COUNT(*) as count,
          SUM(amount) as total_amount,
          AVG(amount) as avg_amount
         FROM transactions
         WHERE date >= $1 AND date <= $2
         GROUP BY expense_type
         ORDER BY total_amount DESC`,
        [startDate, endDate]
      );
      
      return stats;
    } catch (error) {
      console.error('Error getting classification stats:', error);
      throw error;
    }
  }
}

module.exports = new TransactionClassifier();