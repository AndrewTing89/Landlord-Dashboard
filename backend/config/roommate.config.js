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
  
  // Message templates - Use key:value format with line breaks for cleaner URLs
  messageTemplates: {
    electricity: (billAmount, splitAmount, paidDate) => 
      `PG&E\nTotal:$${billAmount.toFixed(2)}\nYour_share(1/3):$${splitAmount.toFixed(2)}\nPaid:${paidDate.replace(/\s+/g, '_')}`,
    
    water: (billAmount, splitAmount, paidDate) => 
      `Great_Oaks_Water\nTotal:$${billAmount.toFixed(2)}\nYour_share(1/3):$${splitAmount.toFixed(2)}\nPaid:${paidDate.replace(/\s+/g, '_')}`,
    
    sms: (billType, venmoLink) => 
      `${billType === 'electricity' ? 'PG&E' : 'Water'} bill payment request: ${venmoLink}`
  }
};