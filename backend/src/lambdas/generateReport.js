const db = require('../db/connection');
const excelGenerator = require('../services/excelGenerator');
const s3Service = require('../services/s3Service');
const moment = require('moment');

/**
 * Lambda handler for generating Excel reports
 * Can be triggered on-demand or monthly
 */
exports.handler = async (event, context) => {
  console.log('Starting report generation Lambda', { event });
  
  try {
    const { reportType, year, month } = event;
    
    let filePath;
    let s3Key;
    
    switch (reportType) {
      case 'annual':
        // Generate annual tax report
        console.log(`Generating annual report for ${year}`);
        filePath = await excelGenerator.generateAnnualReport(year);
        s3Key = `reports/annual/${year}_tax_report_${moment().format('YYYYMMDD')}.xlsx`;
        break;
        
      case 'monthly':
        // Generate monthly report
        console.log(`Generating monthly report for ${month}/${year}`);
        filePath = await excelGenerator.generateMonthlyReport(year, month);
        s3Key = `reports/monthly/${year}_${month.toString().padStart(2, '0')}_report_${moment().format('YYYYMMDD')}.xlsx`;
        break;
        
      default:
        throw new Error('Invalid report type. Must be "annual" or "monthly"');
    }
    
    // Upload to S3
    console.log('Uploading report to S3...');
    const uploadResult = await s3Service.uploadFile(filePath, s3Key);
    
    // Save report record
    if (reportType === 'monthly') {
      await db.query(
        `INSERT INTO monthly_reports (month, year, report_s3_key, generated_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT (month, year) 
         DO UPDATE SET report_s3_key = $3, generated_at = CURRENT_TIMESTAMP`,
        [month, year, s3Key]
      );
    }
    
    // Get presigned URL for download
    const downloadUrl = await s3Service.getPresignedUrl(s3Key);
    
    // Log job run
    await db.insert('job_runs', {
      job_name: 'generate_report',
      run_date: new Date(),
      status: 'success',
      details: {
        report_type: reportType,
        year: year,
        month: month,
        s3_key: s3Key
      }
    });
    
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        message: `${reportType} report generated successfully`,
        s3Key: s3Key,
        downloadUrl: downloadUrl
      })
    };
    
  } catch (error) {
    console.error('Report generation error:', error);
    
    await db.insert('job_runs', {
      job_name: 'generate_report',
      run_date: new Date(),
      status: 'failed',
      details: { error: error.message }
    });
    
    return {
      statusCode: 500,
      body: JSON.stringify({
        success: false,
        error: error.message
      })
    };
  }
};