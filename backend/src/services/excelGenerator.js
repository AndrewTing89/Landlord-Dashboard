const ExcelJS = require('exceljs');
const path = require('path');
const fs = require('fs').promises;
const db = require('../db/connection');
const moment = require('moment');

class ExcelGenerator {
  constructor() {
    this.exportDir = path.join(__dirname, '../../../exports');
  }

  // Ensure export directory exists
  async ensureExportDir() {
    try {
      await fs.access(this.exportDir);
    } catch {
      await fs.mkdir(this.exportDir, { recursive: true });
    }
  }

  // Generate annual tax report
  async generateAnnualReport(year) {
    await this.ensureExportDir();
    
    const workbook = new ExcelJS.Workbook();
    
    // Add worksheets
    await this.addSummarySheet(workbook, year);
    await this.addTransactionsSheet(workbook, year);
    await this.addMonthlyBreakdownSheet(workbook, year);
    await this.addTaxDeductibleSheet(workbook, year);
    
    // Save the file
    const filename = `tax_report_${year}_${moment().format('YYYYMMDD_HHmmss')}.xlsx`;
    const filepath = path.join(this.exportDir, filename);
    
    await workbook.xlsx.writeFile(filepath);
    console.log(`Annual report generated: ${filepath}`);
    
    return filepath;
  }

  // Add summary sheet
  async addSummarySheet(workbook, year) {
    const sheet = workbook.addWorksheet('Summary');
    
    // Get yearly totals
    const summary = await db.getMany(
      `SELECT 
        expense_type,
        COUNT(*) as transaction_count,
        SUM(amount) as total_amount
       FROM transactions 
       WHERE EXTRACT(YEAR FROM date) = $1
       GROUP BY expense_type
       ORDER BY expense_type`,
      [year]
    );

    // Setup columns
    sheet.columns = [
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Transaction Count', key: 'count', width: 20 },
      { header: 'Total Amount', key: 'amount', width: 20 }
    ];

    // Style headers
    this.styleHeaders(sheet);

    // Add data
    let totalExpenses = 0;
    let totalRevenue = 0;
    
    summary.forEach(item => {
      const row = sheet.addRow({
        category: this.formatCategoryName(item.expense_type),
        count: parseInt(item.transaction_count),
        amount: parseFloat(item.total_amount)
      });
      
      if (item.expense_type === 'rent') {
        totalRevenue += parseFloat(item.total_amount);
        row.getCell('category').font = { color: { argb: 'FF008000' } }; // Green for income
      } else {
        totalExpenses += parseFloat(item.total_amount);
      }
    });

    // Add totals
    sheet.addRow({});
    const revenueRow = sheet.addRow({ category: 'Total Revenue', amount: totalRevenue });
    const expenseRow = sheet.addRow({ category: 'Total Expenses', amount: totalExpenses });
    const netRow = sheet.addRow({ category: 'Net Income', amount: totalRevenue - totalExpenses });
    
    // Style totals
    [revenueRow, expenseRow, netRow].forEach(row => {
      row.font = { bold: true };
      row.getCell('amount').font = { bold: true };
    });
    
    netRow.getCell('amount').font = { 
      bold: true, 
      color: { argb: totalRevenue - totalExpenses >= 0 ? 'FF008000' : 'FFFF0000' } 
    };

    // Format currency
    sheet.getColumn('amount').numFmt = '$#,##0.00';
  }

  // Add all transactions sheet
  async addTransactionsSheet(workbook, year) {
    const sheet = workbook.addWorksheet('All Transactions');
    
    const transactions = await db.getMany(
      `SELECT * FROM transactions 
       WHERE EXTRACT(YEAR FROM date) = $1
       ORDER BY date DESC, id DESC`,
      [year]
    );

    // Setup columns
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'name', width: 40 },
      { header: 'Merchant', key: 'merchant', width: 25 },
      { header: 'Category', key: 'expense_type', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Type', key: 'type', width: 10 }
    ];

    // Style headers
    this.styleHeaders(sheet);

    // Add data
    transactions.forEach(transaction => {
      const row = sheet.addRow({
        date: moment(transaction.date).format('MM/DD/YYYY'),
        name: transaction.name,
        merchant: transaction.merchant_name || '',
        expense_type: this.formatCategoryName(transaction.expense_type),
        amount: parseFloat(transaction.amount),
        type: transaction.expense_type === 'rent' ? 'Income' : 'Expense'
      });
      
      // Color code income vs expense
      if (transaction.expense_type === 'rent') {
        row.getCell('type').font = { color: { argb: 'FF008000' } };
      } else {
        row.getCell('type').font = { color: { argb: 'FFFF0000' } };
      }
    });

    // Format columns
    sheet.getColumn('amount').numFmt = '$#,##0.00';
    sheet.getColumn('date').alignment = { horizontal: 'center' };
  }

  // Add monthly breakdown sheet
  async addMonthlyBreakdownSheet(workbook, year) {
    const sheet = workbook.addWorksheet('Monthly Breakdown');
    
    const monthlyData = await db.getMany(
      `SELECT 
        EXTRACT(MONTH FROM date) as month,
        expense_type,
        SUM(amount) as total_amount
       FROM transactions 
       WHERE EXTRACT(YEAR FROM date) = $1
       GROUP BY EXTRACT(MONTH FROM date), expense_type
       ORDER BY month, expense_type`,
      [year]
    );

    // Prepare pivot data
    const pivotData = {};
    const categories = new Set();
    
    monthlyData.forEach(item => {
      const monthNum = parseInt(item.month);
      const monthName = moment(`${year}-${monthNum}-01`).format('MMM');
      
      if (!pivotData[monthName]) {
        pivotData[monthName] = { month: monthName, monthNum };
      }
      
      pivotData[monthName][item.expense_type] = parseFloat(item.total_amount);
      categories.add(item.expense_type);
    });

    // Create columns dynamically
    const columns = [{ header: 'Month', key: 'month', width: 15 }];
    
    // Sort categories to ensure consistent order
    const sortedCategories = Array.from(categories).sort();
    sortedCategories.forEach(cat => {
      columns.push({
        header: this.formatCategoryName(cat),
        key: cat,
        width: 15
      });
    });
    
    columns.push(
      { header: 'Total Expenses', key: 'totalExpenses', width: 15 },
      { header: 'Net Income', key: 'netIncome', width: 15 }
    );
    
    sheet.columns = columns;

    // Style headers
    this.styleHeaders(sheet);

    // Add data sorted by month
    Object.values(pivotData)
      .sort((a, b) => a.monthNum - b.monthNum)
      .forEach(monthData => {
        const row = { month: monthData.month };
        let totalExpenses = 0;
        let revenue = 0;
        
        sortedCategories.forEach(cat => {
          row[cat] = monthData[cat] || 0;
          if (cat === 'rent') {
            revenue += row[cat];
          } else {
            totalExpenses += row[cat];
          }
        });
        
        row.totalExpenses = totalExpenses;
        row.netIncome = revenue - totalExpenses;
        
        const addedRow = sheet.addRow(row);
        
        // Style net income cell
        if (row.netIncome < 0) {
          addedRow.getCell('netIncome').font = { color: { argb: 'FFFF0000' } };
        }
      });

    // Format currency columns
    sortedCategories.forEach(cat => {
      sheet.getColumn(cat).numFmt = '$#,##0.00';
    });
    sheet.getColumn('totalExpenses').numFmt = '$#,##0.00';
    sheet.getColumn('netIncome').numFmt = '$#,##0.00';
  }

  // Add tax deductible expenses sheet
  async addTaxDeductibleSheet(workbook, year) {
    const sheet = workbook.addWorksheet('Tax Deductible Expenses');
    
    // Get all expenses (excluding rent income)
    const expenses = await db.getMany(
      `SELECT * FROM transactions 
       WHERE EXTRACT(YEAR FROM date) = $1
       AND expense_type != 'rent'
       ORDER BY expense_type, date DESC`,
      [year]
    );

    // Setup columns
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Category', key: 'expense_type', width: 15 },
      { header: 'Description', key: 'name', width: 40 },
      { header: 'Amount', key: 'amount', width: 15 },
      { header: 'Tax Category', key: 'tax_category', width: 25 }
    ];

    // Style headers
    this.styleHeaders(sheet);

    // Add data grouped by tax category
    let currentCategory = null;
    let categoryTotal = 0;
    
    expenses.forEach((expense, index) => {
      // Add category subtotal when category changes
      if (currentCategory && currentCategory !== expense.expense_type) {
        const subtotalRow = sheet.addRow({
          name: `Subtotal - ${this.formatCategoryName(currentCategory)}`,
          amount: categoryTotal
        });
        subtotalRow.font = { bold: true, italic: true };
        sheet.addRow({}); // Empty row for spacing
        categoryTotal = 0;
      }
      
      currentCategory = expense.expense_type;
      categoryTotal += parseFloat(expense.amount);
      
      sheet.addRow({
        date: moment(expense.date).format('MM/DD/YYYY'),
        expense_type: this.formatCategoryName(expense.expense_type),
        name: expense.name,
        amount: parseFloat(expense.amount),
        tax_category: this.getTaxCategory(expense.expense_type)
      });
    });
    
    // Add final category subtotal
    if (currentCategory) {
      const subtotalRow = sheet.addRow({
        name: `Subtotal - ${this.formatCategoryName(currentCategory)}`,
        amount: categoryTotal
      });
      subtotalRow.font = { bold: true, italic: true };
    }

    // Add grand total
    sheet.addRow({});
    const totalRow = sheet.addRow({ 
      name: 'TOTAL DEDUCTIBLE EXPENSES', 
      amount: expenses.reduce((sum, e) => sum + parseFloat(e.amount), 0) 
    });
    totalRow.font = { bold: true, size: 12 };
    totalRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFCC00' }
    };

    // Format columns
    sheet.getColumn('amount').numFmt = '$#,##0.00';
    sheet.getColumn('date').alignment = { horizontal: 'center' };
  }

  // Generate monthly report
  async generateMonthlyReport(year, month) {
    await this.ensureExportDir();
    
    const workbook = new ExcelJS.Workbook();
    const monthName = moment(`${year}-${month}-01`).format('MMMM YYYY');
    const sheet = workbook.addWorksheet(monthName);
    
    // Get transactions for the month
    const transactions = await db.getMany(
      `SELECT * FROM transactions 
       WHERE EXTRACT(YEAR FROM date) = $1 
       AND EXTRACT(MONTH FROM date) = $2
       ORDER BY date DESC, id DESC`,
      [year, month]
    );

    // Setup columns
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Description', key: 'name', width: 40 },
      { header: 'Merchant', key: 'merchant', width: 25 },
      { header: 'Category', key: 'expense_type', width: 15 },
      { header: 'Amount', key: 'amount', width: 15 }
    ];

    // Style headers
    this.styleHeaders(sheet);

    // Add transactions
    let totalRevenue = 0;
    let totalExpenses = 0;
    
    transactions.forEach(transaction => {
      sheet.addRow({
        date: moment(transaction.date).format('MM/DD/YYYY'),
        name: transaction.name,
        merchant: transaction.merchant_name || '',
        expense_type: this.formatCategoryName(transaction.expense_type),
        amount: parseFloat(transaction.amount)
      });
      
      if (transaction.expense_type === 'rent') {
        totalRevenue += parseFloat(transaction.amount);
      } else {
        totalExpenses += parseFloat(transaction.amount);
      }
    });
    
    // Add summary
    sheet.addRow({});
    sheet.addRow({ name: 'Total Revenue', amount: totalRevenue });
    sheet.addRow({ name: 'Total Expenses', amount: totalExpenses });
    const netRow = sheet.addRow({ name: 'Net Income', amount: totalRevenue - totalExpenses });
    
    if (totalRevenue - totalExpenses < 0) {
      netRow.getCell('amount').font = { color: { argb: 'FFFF0000' } };
    }

    // Format
    sheet.getColumn('amount').numFmt = '$#,##0.00';
    
    // Save file
    const filename = `monthly_report_${year}_${month.toString().padStart(2, '0')}_${moment().format('YYYYMMDD_HHmmss')}.xlsx`;
    const filepath = path.join(this.exportDir, filename);
    
    await workbook.xlsx.writeFile(filepath);
    console.log(`Monthly report generated: ${filepath}`);
    
    return filepath;
  }

  // Helper methods
  styleHeaders(sheet) {
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true, size: 11 };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
    headerRow.height = 20;
  }

  formatCategoryName(category) {
    if (!category) return 'Unknown';
    return category.charAt(0).toUpperCase() + category.slice(1).toLowerCase();
  }

  getTaxCategory(expenseType) {
    const taxCategoryMap = {
      'electricity': 'Utilities',
      'water': 'Utilities',
      'maintenance': 'Repairs and Maintenance',
      'other': 'Other Business Expenses'
    };
    
    return taxCategoryMap[expenseType] || 'Other Business Expenses';
  }
}

module.exports = new ExcelGenerator();