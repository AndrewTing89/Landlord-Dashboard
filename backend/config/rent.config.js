module.exports = {
  // Monthly rent amount
  MONTHLY_RENT: 1685,
  
  // Day of month to insert rent (1-31)
  RENT_DAY: 1,
  
  // Description for the rent transaction
  RENT_DESCRIPTION: 'Monthly Rent Payment',
  
  // Merchant name
  MERCHANT_NAME: 'Tenant',
  
  // Enable/disable email notifications
  SEND_NOTIFICATIONS: false,
  
  // Email to notify when rent is inserted (if enabled)
  NOTIFICATION_EMAIL: process.env.NOTIFICATION_EMAIL || ''
};