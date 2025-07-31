const fs = require('fs').promises;
const pdfParse = require('pdf-parse');
const moment = require('moment');
const db = require('../db/connection');

class PDFParserService {
  async parseStatement(pdfPath) {
    try {
      const dataBuffer = await fs.readFile(pdfPath);
      const data = await pdfParse(dataBuffer);
      
      // Extract transactions from text
      const transactions = this.extractTransactions(data.text);
      
      return transactions;
    } catch (error) {
      console.error('PDF parsing error:', error);
      throw error;
    }
  }

  extractTransactions(text) {
    const transactions = [];
    const lines = text.split('\n');
    
    // Bank of America transaction patterns
    // Format: MM/DD Description Amount Balance
    const transactionPattern = /^(\d{2}\/\d{2})\s+(.+?)\s+(-?\d{1,3}(?:,\d{3})*\.\d{2})\s+(\d{1,3}(?:,\d{3})*\.\d{2})$/;
    
    for (const line of lines) {
      const match = line.match(transactionPattern);
      if (match) {
        const [_, date, description, amount, balance] = match;
        
        // Parse date (add current year)
        const transDate = moment(`${date}/${new Date().getFullYear()}`, 'MM/DD/YYYY');
        
        // Parse amount (remove commas)
        const amountNum = parseFloat(amount.replace(/,/g, ''));
        
        transactions.push({
          date: transDate.toDate(),
          description: description.trim(),
          amount: Math.abs(amountNum),
          type: amountNum < 0 ? 'debit' : 'credit',
          balance: parseFloat(balance.replace(/,/g, ''))
        });
      }
    }
    
    return transactions;
  }

  async saveTransactions(transactions) {
    let savedCount = 0;
    
    for (const transaction of transactions) {
      try {
        // Check if transaction already exists
        const existing = await db.getOne(
          `SELECT id FROM transactions 
           WHERE date = $1 AND name = $2 AND amount = $3`,
          [transaction.date, transaction.description, transaction.amount]
        );
        
        if (!existing) {
          const expenseType = this.classifyTransaction(transaction);
          
          await db.insert('transactions', {
            plaid_transaction_id: `pdf_${Date.now()}_${savedCount}`,
            plaid_account_id: 'bofa_checking',
            amount: transaction.amount,
            date: transaction.date,
            name: transaction.description,
            merchant_name: this.extractMerchant(transaction.description),
            expense_type: expenseType,
            category: 'Bank Transfer',
            subcategory: null
          });
          
          savedCount++;
        }
      } catch (error) {
        console.error('Error saving transaction:', error);
      }
    }
    
    return savedCount;
  }

  classifyTransaction(transaction) {
    const description = transaction.description.toLowerCase();
    
    if (description.includes('pg&e') || description.includes('pacific gas')) {
      return 'electricity';
    } else if (description.includes('great oaks') || description.includes('water')) {
      return 'water';
    } else if (description.includes('home depot') || description.includes('repair')) {
      return 'maintenance';
    } else if (transaction.type === 'credit' && transaction.amount > 1500) {
      return 'rent';
    } else {
      return 'other';
    }
  }

  extractMerchant(description) {
    const parts = description.split(' ');
    return parts.slice(0, 3).join(' ');
  }
}

module.exports = new PDFParserService();