// Load environment variables
require('dotenv').config();

module.exports = {
  // Roommate configurations (excluding yourself as landlord)
  roommates: [
    {
      name: 'Ushi Lo',
      venmoUsername: '@UshiLo', 
      phoneNumber: process.env.USHI_PHONE || '+1234567890',
      splitRatio: 1/3, // Each roommate pays 1/3 of bills
    },
    {
      name: 'Eileen',
      venmoUsername: process.env.EILEEN_VENMO || '@eileen-venmo', // Update with real username
      phoneNumber: process.env.EILEEN_PHONE || '+1234567890', // Update with real phone
      splitRatio: 1/3, // Each roommate pays 1/3 of bills
    }
  ],
  
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