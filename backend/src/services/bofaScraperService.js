const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');
const csv = require('csv-parse/sync');
const db = require('../db/connection');
const moment = require('moment');

class BofAScraperService {
  constructor() {
    this.downloadPath = path.join(__dirname, '../../downloads');
  }

  async initialize() {
    // Create download directory if it doesn't exist
    await fs.mkdir(this.downloadPath, { recursive: true });
  }

  async scrapeTransactions(username, password) {
    const browser = await puppeteer.launch({
      headless: false, // Set to true in production
      defaultViewport: null,
      args: ['--start-maximized']
    });

    try {
      const page = await browser.newPage();
      
      // Set download behavior
      const client = await page.target().createCDPSession();
      await client.send('Page.setDownloadBehavior', {
        behavior: 'allow',
        downloadPath: this.downloadPath,
      });

      // Navigate to BofA login
      await page.goto('https://www.bankofamerica.com/');
      
      // Click Sign In
      await page.waitForSelector('#navChecking');
      await page.click('#enroll_cta');
      
      // Enter credentials
      await page.waitForSelector('#enterID-input');
      await page.type('#enterID-input', username);
      await page.click('#continueButton');
      
      await page.waitForSelector('#tlpvt-passcode-input');
      await page.type('#tlpvt-passcode-input', password);
      
      // Remember device (optional)
      const rememberCheckbox = await page.$('#rememberID');
      if (rememberCheckbox) {
        await page.click('#rememberID');
      }
      
      // Sign in
      await page.click('#signin-button');
      
      // Wait for dashboard
      await page.waitForNavigation({ waitUntil: 'networkidle2' });
      
      // Navigate to checking account
      await page.waitForSelector('a[name="DDA_details"]', { timeout: 30000 });
      await page.click('a[name="DDA_details"]');
      
      // Wait for transactions page
      await page.waitForSelector('a[name="lnkDownloadActivity"]', { timeout: 30000 });
      
      // Click download
      await page.click('a[name="lnkDownloadActivity"]');
      
      // Select date range (last 3 months)
      await page.waitForSelector('#select_filetype');
      await page.select('#select_filetype', 'csv');
      
      // Download transactions
      await page.click('a[name="submit_download"]');
      
      // Wait for download to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Parse the downloaded CSV
      const transactions = await this.parseDownloadedCSV();
      
      return transactions;
      
    } catch (error) {
      console.error('Scraping error:', error);
      throw error;
    } finally {
      await browser.close();
    }
  }

  async parseDownloadedCSV() {
    // Find the most recent CSV file
    const files = await fs.readdir(this.downloadPath);
    const csvFiles = files.filter(f => f.endsWith('.csv'));
    
    if (csvFiles.length === 0) {
      throw new Error('No CSV file found');
    }
    
    // Sort by modification time to get the newest
    const sortedFiles = await Promise.all(
      csvFiles.map(async (file) => {
        const stats = await fs.stat(path.join(this.downloadPath, file));
        return { file, mtime: stats.mtime };
      })
    );
    
    sortedFiles.sort((a, b) => b.mtime - a.mtime);
    const newestFile = sortedFiles[0].file;
    
    // Read and parse CSV
    const csvContent = await fs.readFile(
      path.join(this.downloadPath, newestFile), 
      'utf-8'
    );
    
    // BofA CSV format: Date,Description,Amount,Running Balance
    const records = csv.parse(csvContent, {
      columns: true,
      skip_empty_lines: true
    });
    
    const transactions = [];
    
    for (const record of records) {
      const date = moment(record.Date, 'MM/DD/YYYY');
      const amount = parseFloat(record.Amount);
      const description = record.Description;
      
      // Determine if it's a credit or debit
      const isCredit = amount > 0;
      
      // Create transaction object
      transactions.push({
        date: date.toDate(),
        description: description,
        amount: Math.abs(amount),
        type: isCredit ? 'credit' : 'debit',
        balance: parseFloat(record['Running Balance']),
        raw: record
      });
    }
    
    // Clean up downloaded file
    await fs.unlink(path.join(this.downloadPath, newestFile));
    
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
          // Classify transaction
          const expenseType = this.classifyTransaction(transaction);
          
          // Save to database
          await db.insert('transactions', {
            plaid_transaction_id: `bofa_${Date.now()}_${savedCount}`,
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
    // Extract merchant name from description
    const parts = description.split(' ');
    if (parts.length > 0) {
      return parts.slice(0, 3).join(' ');
    }
    return description;
  }
}

module.exports = new BofAScraperService();