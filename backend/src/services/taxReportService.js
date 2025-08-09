/**
 * Tax Report Service
 * Generates professional tax reports following IRS Schedule E format
 */

const db = require('../db/connection');
const ExcelJS = require('exceljs');
const fs = require('fs').promises;
const path = require('path');

class TaxReportService {
  /**
   * Generate annual tax report following Schedule E format
   */
  async generateAnnualTaxReport(year) {
    try {
      console.log(`📊 Generating tax report for ${year}...`);

      // Fetch all data needed for the report
      const [income, expenses, summary] = await Promise.all([
        this.getIncomeData(year),
        this.getExpenseData(year),
        this.getAnnualSummary(year)
      ]);

      // Create Excel workbook
      const workbook = new ExcelJS.Workbook();
      
      // Add Summary Sheet
      await this.createSummarySheet(workbook, year, summary);
      
      // Add Detailed Income Sheet
      await this.createIncomeSheet(workbook, year, income);
      
      // Add Detailed Expenses Sheet
      await this.createExpensesSheet(workbook, year, expenses);
      
      // Add Monthly Breakdown Sheet
      await this.createMonthlyBreakdownSheet(workbook, year);
      
      // Add Schedule E Format Sheet
      await this.createScheduleESheet(workbook, year, summary);

      // Save the workbook
      const fileName = `Tax_Report_${year}_${Date.now()}.xlsx`;
      const filePath = path.join(__dirname, '../../reports', fileName);
      
      // Ensure reports directory exists
      await fs.mkdir(path.dirname(filePath), { recursive: true });
      
      await workbook.xlsx.writeFile(filePath);
      
      console.log(`✅ Tax report saved to: ${filePath}`);
      
      return {
        success: true,
        fileName,
        filePath,
        summary
      };
    } catch (error) {
      console.error('Error generating tax report:', error);
      throw error;
    }
  }

  /**
   * Get income data for the year
   */
  async getIncomeData(year) {
    const result = await db.query(`
      SELECT 
        date,
        amount,
        income_type,
        description,
        payer_name,
        payment_request_id
      FROM income
      WHERE EXTRACT(YEAR FROM date) = $1
      ORDER BY date, income_type
    `, [year]);
    
    return result.rows;
  }

  /**
   * Get expense data for the year
   */
  async getExpenseData(year) {
    const result = await db.query(`
      SELECT 
        date,
        amount,
        expense_type,
        name as description,
        merchant_name
      FROM expenses
      WHERE EXTRACT(YEAR FROM date) = $1
        AND expense_type NOT IN ('other', 'rent', 'utility_reimbursement')
        AND expense_type IS NOT NULL
      ORDER BY date, expense_type
    `, [year]);
    
    return result.rows;
  }

  /**
   * Get annual summary
   */
  async getAnnualSummary(year) {
    // Get income summary
    const incomeResult = await db.getOne(`
      SELECT 
        SUM(CASE WHEN income_type = 'rent' THEN amount ELSE 0 END) as rent_income,
        SUM(CASE WHEN income_type = 'utility_reimbursement' THEN amount ELSE 0 END) as utility_reimbursements,
        SUM(CASE WHEN income_type NOT IN ('rent', 'utility_reimbursement') THEN amount ELSE 0 END) as other_income,
        SUM(amount) as total_income
      FROM income
      WHERE EXTRACT(YEAR FROM date) = $1
    `, [year]);

    // Get expense summary by actual expense type
    const expenseResult = await db.query(`
      SELECT 
        expense_type as category,
        SUM(amount) as total,
        COUNT(*) as count
      FROM expenses
      WHERE EXTRACT(YEAR FROM date) = $1
        AND expense_type NOT IN ('other', 'rent', 'utility_reimbursement')
        AND expense_type IS NOT NULL
      GROUP BY expense_type
      ORDER BY total DESC
    `, [year]);

    const expenses = {};
    let totalExpenses = 0;
    
    expenseResult.rows.forEach(row => {
      expenses[row.category] = parseFloat(row.total);
      totalExpenses += parseFloat(row.total);
    });

    return {
      income: {
        rent: parseFloat(incomeResult.rent_income || 0),
        utilityReimbursements: parseFloat(incomeResult.utility_reimbursements || 0),
        other: parseFloat(incomeResult.other_income || 0),
        total: parseFloat(incomeResult.total_income || 0)
      },
      expenses: {
        ...expenses,
        total: totalExpenses
      },
      netIncome: parseFloat(incomeResult.total_income || 0) - totalExpenses
    };
  }

  /**
   * Create Summary Sheet
   */
  async createSummarySheet(workbook, year, summary) {
    const sheet = workbook.addWorksheet('Summary');
    
    // Set column widths
    sheet.columns = [
      { width: 35 },
      { width: 20 },
      { width: 20 }
    ];

    // Title
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `RENTAL PROPERTY TAX REPORT - ${year}`;
    titleCell.font = { bold: true, size: 16 };
    titleCell.alignment = { horizontal: 'center' };

    // Property Information
    sheet.getCell('A3').value = 'PROPERTY INFORMATION';
    sheet.getCell('A3').font = { bold: true, size: 12 };
    sheet.getCell('A4').value = 'Property Address:';
    sheet.getCell('B4').value = '1234 Rental Property Lane'; // Update with actual address
    sheet.getCell('A5').value = 'Property Type:';
    sheet.getCell('B5').value = 'Single Family Residence';
    sheet.getCell('A6').value = 'Tax Year:';
    sheet.getCell('B6').value = year;

    // Income Section
    sheet.getCell('A8').value = 'INCOME';
    sheet.getCell('A8').font = { bold: true, size: 12, color: { argb: 'FF006600' } };
    
    sheet.getCell('A9').value = 'Rental Income';
    sheet.getCell('C9').value = summary.income.rent;
    sheet.getCell('C9').numFmt = '$#,##0.00';
    
    sheet.getCell('A10').value = 'Utility Reimbursements';
    sheet.getCell('C10').value = summary.income.utilityReimbursements;
    sheet.getCell('C10').numFmt = '$#,##0.00';
    
    sheet.getCell('A11').value = 'Other Income';
    sheet.getCell('C11').value = summary.income.other;
    sheet.getCell('C11').numFmt = '$#,##0.00';
    
    sheet.getCell('A12').value = 'TOTAL INCOME';
    sheet.getCell('A12').font = { bold: true };
    sheet.getCell('C12').value = summary.income.total;
    sheet.getCell('C12').numFmt = '$#,##0.00';
    sheet.getCell('C12').font = { bold: true };

    // Expenses Section
    let row = 14;
    sheet.getCell(`A${row}`).value = 'EXPENSES';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12, color: { argb: 'FFCC0000' } };
    row++;

    // List each expense category
    const expenseCategories = {
      'electricity': 'Utilities - Electric (PG&E)',
      'water': 'Utilities - Water',
      'internet': 'Utilities - Internet',
      'cleaning_maintenance': 'Cleaning and Maintenance',
      'repairs': 'Repairs',
      'supplies': 'Supplies',
      'property_tax': 'Property Taxes',
      'insurance': 'Insurance'
    };

    Object.keys(expenseCategories).forEach(category => {
      if (summary.expenses[category]) {
        sheet.getCell(`A${row}`).value = expenseCategories[category];
        sheet.getCell(`C${row}`).value = summary.expenses[category];
        sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
        row++;
      }
    });

    sheet.getCell(`A${row}`).value = 'TOTAL EXPENSES';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = summary.expenses.total;
    sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true };

    // Net Income
    row += 2;
    sheet.getCell(`A${row}`).value = 'NET RENTAL INCOME (LOSS)';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    sheet.getCell(`C${row}`).value = summary.netIncome;
    sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
    sheet.getCell(`C${row}`).font = { 
      bold: true, 
      color: { argb: summary.netIncome >= 0 ? 'FF006600' : 'FFCC0000' }
    };

    // Add borders
    const lastRow = row;
    for (let i = 9; i <= lastRow; i++) {
      if (sheet.getCell(`C${i}`).value) {
        sheet.getCell(`C${i}`).border = {
          top: { style: 'thin' },
          bottom: { style: 'thin' },
          left: { style: 'thin' },
          right: { style: 'thin' }
        };
      }
    }
  }

  /**
   * Create Income Details Sheet
   */
  async createIncomeSheet(workbook, year, incomeData) {
    const sheet = workbook.addWorksheet('Income Details');
    
    // Headers
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Type', key: 'type', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Payer', key: 'payer', width: 20 },
      { header: 'Amount', key: 'amount', width: 15 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE6F3E6' }
    };

    // Add data
    incomeData.forEach(record => {
      sheet.addRow({
        date: record.date,
        type: this.formatIncomeType(record.income_type),
        description: record.description,
        payer: record.payer_name || 'N/A',
        amount: parseFloat(record.amount)
      });
    });

    // Format amount column
    sheet.getColumn('amount').numFmt = '$#,##0.00';

    // Add total row
    const totalRow = sheet.addRow({
      date: '',
      type: '',
      description: '',
      payer: 'TOTAL',
      amount: incomeData.reduce((sum, r) => sum + parseFloat(r.amount), 0)
    });
    totalRow.font = { bold: true };
  }

  /**
   * Create Expenses Details Sheet
   */
  async createExpensesSheet(workbook, year, expenseData) {
    const sheet = workbook.addWorksheet('Expense Details');
    
    // Headers
    sheet.columns = [
      { header: 'Date', key: 'date', width: 12 },
      { header: 'Category', key: 'category', width: 20 },
      { header: 'Description', key: 'description', width: 40 },
      { header: 'Vendor', key: 'vendor', width: 25 },
      { header: 'Amount', key: 'amount', width: 15 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE6E6' }
    };

    // Add data
    expenseData.forEach(record => {
      sheet.addRow({
        date: record.date,
        category: this.formatExpenseCategory(record.expense_type),
        description: record.description,
        vendor: record.merchant_name || 'N/A',
        amount: parseFloat(record.amount)
      });
    });

    // Format amount column
    sheet.getColumn('amount').numFmt = '$#,##0.00';

    // Add total row
    const totalRow = sheet.addRow({
      date: '',
      category: '',
      description: '',
      vendor: 'TOTAL',
      amount: expenseData.reduce((sum, r) => sum + parseFloat(r.amount), 0)
    });
    totalRow.font = { bold: true };
  }

  /**
   * Create Monthly Breakdown Sheet
   */
  async createMonthlyBreakdownSheet(workbook, year) {
    const sheet = workbook.addWorksheet('Monthly Breakdown');
    
    // Get monthly data
    const monthlyData = await db.query(`
      WITH monthly_income AS (
        SELECT 
          EXTRACT(MONTH FROM date) as month,
          SUM(CASE WHEN income_type = 'rent' THEN amount ELSE 0 END) as rent,
          SUM(CASE WHEN income_type = 'utility_reimbursement' THEN amount ELSE 0 END) as utilities,
          SUM(amount) as total_income
        FROM income
        WHERE EXTRACT(YEAR FROM date) = $1
        GROUP BY EXTRACT(MONTH FROM date)
      ),
      monthly_expenses AS (
        SELECT 
          EXTRACT(MONTH FROM date) as month,
          SUM(CASE WHEN expense_type = 'electricity' THEN amount ELSE 0 END) as electricity,
          SUM(CASE WHEN expense_type = 'water' THEN amount ELSE 0 END) as water,
          SUM(CASE WHEN expense_type IN ('cleaning_maintenance', 'repairs') THEN amount ELSE 0 END) as maintenance,
          SUM(CASE WHEN expense_type = 'supplies' THEN amount ELSE 0 END) as supplies,
          SUM(CASE WHEN expense_type = 'property_tax' THEN amount ELSE 0 END) as property_tax,
          SUM(CASE WHEN expense_type = 'insurance' THEN amount ELSE 0 END) as insurance,
          SUM(amount) as total_expenses
        FROM expenses
        WHERE EXTRACT(YEAR FROM date) = $1
          AND expense_type NOT IN ('other')
        GROUP BY EXTRACT(MONTH FROM date)
      )
      SELECT 
        COALESCE(i.month, e.month) as month,
        COALESCE(i.rent, 0) as rent,
        COALESCE(i.utilities, 0) as utility_reimb,
        COALESCE(i.total_income, 0) as total_income,
        COALESCE(e.electricity, 0) as electricity,
        COALESCE(e.water, 0) as water,
        COALESCE(e.maintenance, 0) as maintenance,
        COALESCE(e.supplies, 0) as supplies,
        COALESCE(e.property_tax, 0) as property_tax,
        COALESCE(e.insurance, 0) as insurance,
        COALESCE(e.total_expenses, 0) as total_expenses,
        COALESCE(i.total_income, 0) - COALESCE(e.total_expenses, 0) as net_income
      FROM monthly_income i
      FULL OUTER JOIN monthly_expenses e ON i.month = e.month
      ORDER BY month
    `, [year]);

    // Set up columns
    sheet.columns = [
      { header: 'Month', key: 'month', width: 12 },
      { header: 'Rent Income', key: 'rent', width: 15 },
      { header: 'Utility Reimb', key: 'utility_reimb', width: 15 },
      { header: 'Total Income', key: 'total_income', width: 15 },
      { header: 'Electric', key: 'electricity', width: 12 },
      { header: 'Water', key: 'water', width: 12 },
      { header: 'Maintenance', key: 'maintenance', width: 15 },
      { header: 'Supplies', key: 'supplies', width: 12 },
      { header: 'Property Tax', key: 'property_tax', width: 15 },
      { header: 'Insurance', key: 'insurance', width: 12 },
      { header: 'Total Expenses', key: 'total_expenses', width: 15 },
      { header: 'Net Income', key: 'net_income', width: 15 }
    ];

    // Style headers
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFCCCCCC' }
    };

    // Add monthly data
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    monthlyData.rows.forEach(row => {
      sheet.addRow({
        month: monthNames[row.month - 1],
        rent: parseFloat(row.rent),
        utility_reimb: parseFloat(row.utility_reimb),
        total_income: parseFloat(row.total_income),
        electricity: parseFloat(row.electricity),
        water: parseFloat(row.water),
        maintenance: parseFloat(row.maintenance),
        supplies: parseFloat(row.supplies),
        property_tax: parseFloat(row.property_tax),
        insurance: parseFloat(row.insurance),
        total_expenses: parseFloat(row.total_expenses),
        net_income: parseFloat(row.net_income)
      });
    });

    // Format number columns
    ['rent', 'utility_reimb', 'total_income', 'electricity', 'water', 'maintenance', 
     'supplies', 'property_tax', 'insurance', 'total_expenses', 'net_income'].forEach(col => {
      sheet.getColumn(col).numFmt = '$#,##0.00';
    });

    // Add totals row
    const totals = monthlyData.rows.reduce((acc, row) => {
      Object.keys(row).forEach(key => {
        if (key !== 'month') {
          acc[key] = (acc[key] || 0) + parseFloat(row[key]);
        }
      });
      return acc;
    }, {});

    const totalRow = sheet.addRow({
      month: 'TOTAL',
      rent: totals.rent,
      utility_reimb: totals.utility_reimb,
      total_income: totals.total_income,
      electricity: totals.electricity,
      water: totals.water,
      maintenance: totals.maintenance,
      supplies: totals.supplies,
      property_tax: totals.property_tax,
      insurance: totals.insurance,
      total_expenses: totals.total_expenses,
      net_income: totals.net_income
    });
    totalRow.font = { bold: true };

    // Color code net income column
    sheet.getColumn('net_income').eachCell((cell, rowNumber) => {
      if (rowNumber > 1 && cell.value) {
        cell.font = {
          color: { argb: cell.value >= 0 ? 'FF006600' : 'FFCC0000' }
        };
      }
    });
  }

  /**
   * Create Schedule E Format Sheet
   */
  async createScheduleESheet(workbook, year, summary) {
    const sheet = workbook.addWorksheet('Schedule E Format');
    
    // Set column widths
    sheet.columns = [
      { width: 50 },
      { width: 20 },
      { width: 20 }
    ];

    // Title
    sheet.mergeCells('A1:C1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = `SCHEDULE E (Form 1040) - ${year}`;
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };

    sheet.getCell('A2').value = 'Supplemental Income and Loss';
    sheet.getCell('A2').font = { italic: true };
    sheet.getCell('A2').alignment = { horizontal: 'center' };

    // Part I - Income or Loss From Rental Real Estate
    sheet.getCell('A4').value = 'Part I - Income or Loss From Rental Real Estate';
    sheet.getCell('A4').font = { bold: true, size: 12 };

    // Income Section
    let row = 6;
    sheet.getCell(`A${row}`).value = 'Income:';
    sheet.getCell(`A${row}`).font = { bold: true };
    row++;

    sheet.getCell(`A${row}`).value = '3. Rents received';
    sheet.getCell(`C${row}`).value = summary.income.rent + summary.income.utilityReimbursements;
    sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
    row++;

    sheet.getCell(`A${row}`).value = '4. Royalties received';
    sheet.getCell(`C${row}`).value = 0;
    sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
    row += 2;

    // Expenses Section
    sheet.getCell(`A${row}`).value = 'Expenses:';
    sheet.getCell(`A${row}`).font = { bold: true };
    row++;

    const scheduleELines = [
      { line: '5', description: 'Advertising', amount: summary.expenses.advertising || 0 },
      { line: '6', description: 'Auto and travel', amount: summary.expenses.auto_travel || 0 },
      { line: '7', description: 'Cleaning and maintenance', amount: summary.expenses.cleaning_maintenance || 0 },
      { line: '8', description: 'Commissions', amount: summary.expenses.commissions || 0 },
      { line: '9', description: 'Insurance', amount: summary.expenses.insurance || 0 },
      { line: '10', description: 'Legal and other professional fees', amount: summary.expenses.legal_professional || 0 },
      { line: '11', description: 'Management fees', amount: summary.expenses.management_fees || 0 },
      { line: '12', description: 'Mortgage interest paid to banks, etc.', amount: summary.expenses.mortgage_interest || 0 },
      { line: '13', description: 'Other interest', amount: summary.expenses.other_interest || 0 },
      { line: '14', description: 'Repairs', amount: summary.expenses.repairs || 0 },
      { line: '15', description: 'Supplies', amount: summary.expenses.supplies || 0 },
      { line: '16', description: 'Taxes', amount: summary.expenses.property_tax || 0 },
      { line: '17', description: 'Utilities', amount: (summary.expenses.electricity || 0) + (summary.expenses.water || 0) + (summary.expenses.internet || 0) },
      { line: '18', description: 'Depreciation expense or depletion', amount: summary.expenses.depreciation || 0 },
      { line: '19', description: 'Other', amount: 0 }
    ];

    scheduleELines.forEach(item => {
      sheet.getCell(`A${row}`).value = `${item.line}. ${item.description}`;
      sheet.getCell(`C${row}`).value = item.amount;
      sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
      row++;
    });

    row++;
    sheet.getCell(`A${row}`).value = '20. Total expenses';
    sheet.getCell(`A${row}`).font = { bold: true };
    sheet.getCell(`C${row}`).value = summary.expenses.total;
    sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
    sheet.getCell(`C${row}`).font = { bold: true };

    row += 2;
    sheet.getCell(`A${row}`).value = '21. Net rental real estate income or (loss)';
    sheet.getCell(`A${row}`).font = { bold: true, size: 12 };
    sheet.getCell(`C${row}`).value = summary.netIncome;
    sheet.getCell(`C${row}`).numFmt = '$#,##0.00';
    sheet.getCell(`C${row}`).font = { 
      bold: true, 
      size: 12,
      color: { argb: summary.netIncome >= 0 ? 'FF006600' : 'FFCC0000' }
    };

    // Add note
    row += 2;
    sheet.getCell(`A${row}`).value = 'Note: This is a summary for tax preparation purposes. Please consult with your tax professional.';
    sheet.getCell(`A${row}`).font = { italic: true, size: 10 };
  }

  /**
   * Format income type for display
   */
  formatIncomeType(type) {
    const types = {
      'rent': 'Rental Income',
      'utility_reimbursement': 'Utility Reimbursement',
      'other': 'Other Income'
    };
    return types[type] || type;
  }

  /**
   * Format expense category for display
   */
  formatExpenseCategory(category) {
    const categories = {
      'electricity': 'Utilities - Electric',
      'water': 'Utilities - Water',
      'internet': 'Utilities - Internet',
      'cleaning_maintenance': 'Cleaning & Maintenance',
      'repairs': 'Repairs',
      'supplies': 'Supplies',
      'property_tax': 'Property Tax',
      'insurance': 'Insurance',
      'advertising': 'Advertising',
      'auto_travel': 'Auto & Travel',
      'commissions': 'Commissions',
      'legal_professional': 'Legal & Professional',
      'management_fees': 'Management Fees',
      'mortgage_interest': 'Mortgage Interest',
      'other_interest': 'Other Interest',
      'depreciation': 'Depreciation'
    };
    return categories[category] || category;
  }
}

module.exports = new TaxReportService();