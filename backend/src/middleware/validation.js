const { AppError } = require('./errorHandler');

// Validate required environment variables
const validateEnv = () => {
  // Check for database configuration - either DATABASE_URL or individual components
  const hasDatabase = process.env.DATABASE_URL || 
    (process.env.DB_HOST && process.env.DB_PORT && process.env.DB_NAME && process.env.DB_USER);
  
  if (!hasDatabase) {
    throw new Error('Missing database configuration: Provide either DATABASE_URL or DB_HOST, DB_PORT, DB_NAME, and DB_USER');
  }
  
  // Check other required variables
  const required = [
    'PORT',
    'SIMPLEFIN_TOKEN',
    'DISCORD_WEBHOOK_PAYMENT_REQUESTS'
  ];
  
  // Optional but recommended
  const optional = [
    'GMAIL_CLIENT_ID',
    'GMAIL_CLIENT_SECRET'
  ];
  
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  console.log('✅ Environment variables validated');
  
  // Check optional variables
  const missingOptional = optional.filter(key => !process.env[key]);
  if (missingOptional.length > 0) {
    console.log(`⚠️  Optional variables not configured: ${missingOptional.join(', ')}`);
    console.log('   Gmail integration will not be available');
  }
};

// Validate request parameters
const validateRequest = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    if (error) {
      return next(new AppError(error.details[0].message, 400));
    }
    next();
  };
};

// Validate date range
const validateDateRange = (req, res, next) => {
  const { start_date, end_date } = req.query;
  
  if (start_date && end_date) {
    const start = new Date(start_date);
    const end = new Date(end_date);
    
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return next(new AppError('Invalid date format', 400));
    }
    
    if (start > end) {
      return next(new AppError('Start date must be before end date', 400));
    }
    
    // Limit date range to 1 year
    const oneYear = 365 * 24 * 60 * 60 * 1000;
    if (end - start > oneYear) {
      return next(new AppError('Date range cannot exceed 1 year', 400));
    }
  }
  
  next();
};

// Validate pagination
const validatePagination = (req, res, next) => {
  const { page = 1, limit = 25 } = req.query;
  
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  if (isNaN(pageNum) || pageNum < 1) {
    return next(new AppError('Invalid page number', 400));
  }
  
  if (isNaN(limitNum) || limitNum < 1 || limitNum > 100) {
    return next(new AppError('Limit must be between 1 and 100', 400));
  }
  
  req.pagination = {
    page: pageNum,
    limit: limitNum,
    offset: (pageNum - 1) * limitNum
  };
  
  next();
};

module.exports = {
  validateEnv,
  validateRequest,
  validateDateRange,
  validatePagination
};