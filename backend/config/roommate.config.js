// Load environment variables
require('dotenv').config();

module.exports = {
  // Roommate configuration
  roommate: {
    name: process.env.ROOMMATE_NAME || 'Andrew (Test)',
    venmoUsername: process.env.ROOMMATE_VENMO_USERNAME || 'andrewhting',
    phoneNumber: process.env.ROOMMATE_PHONE || '+1234567890',
    splitRatio: 1/3, // Roommate pays 1/3 of bills
  },
  
  // Your configuration for notifications
  landlord: {
    phoneNumber: '+19298884132', // Your phone number
    venmoUsername: 'your-venmo', // Your Venmo username
  },
  
  // Bill types that should generate payment requests
  billTypesForSplit: ['electricity', 'water'],
  
  // Message templates
  messageTemplates: {
    electricity: (billAmount, splitAmount, paidDate) => 
      `PG&E bill for ${paidDate}: Total $${billAmount.toFixed(2)}, your share is $${splitAmount.toFixed(2)} (1/3). I've already paid the full amount.`,
    
    water: (billAmount, splitAmount, paidDate) => 
      `Water bill for ${paidDate}: Total $${billAmount.toFixed(2)}, your share is $${splitAmount.toFixed(2)} (1/3). I've already paid the full amount.`,
    
    sms: (billType, venmoLink) => 
      `${billType === 'electricity' ? 'PG&E' : 'Water'} bill payment request: ${venmoLink}`
  }
};