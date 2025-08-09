#!/usr/bin/env node

/**
 * Test tax report generation
 */

require('dotenv').config();
const taxReportService = require('./src/services/taxReportService');

async function testTaxReport() {
  try {
    console.log('Testing tax report generation for 2025...');
    
    const result = await taxReportService.generateAnnualTaxReport(2025);
    
    console.log('✅ Tax report generated successfully!');
    console.log('File:', result.fileName);
    console.log('Path:', result.filePath);
    console.log('\nSummary:');
    console.log('Income:', result.summary.income);
    console.log('Expenses:', result.summary.expenses);
    console.log('Net Income:', result.summary.netIncome);
    
  } catch (error) {
    console.error('❌ Error generating tax report:', error);
  } finally {
    process.exit(0);
  }
}

testTaxReport();