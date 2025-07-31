module.exports = {
  sync: require('./sync'),
  payments: require('./payments'),
  review: require('./review'), // Already exists
  gmail: require('./gmail'),
  // We'll add more as we create them:
  // transactions: require('./transactions'),
  // reports: require('./reports'),
  // venmo: require('./venmo'),
};