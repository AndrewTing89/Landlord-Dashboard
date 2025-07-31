// Custom error class for operational errors
class AppError extends Error {
  constructor(message, statusCode = 500, context = {}) {
    super(message);
    this.statusCode = statusCode;
    this.context = context;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Async route handler wrapper
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

// Central error handling middleware
const errorHandler = (err, req, res, next) => {
  // Default to 500 server error
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';
  
  // Log error with context
  console.error('API Error:', {
    message: err.message,
    statusCode,
    context: err.context || {},
    path: req.path,
    method: req.method,
    query: req.query,
    body: req.body,
    timestamp: new Date().toISOString(),
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
  
  // Handle specific error types
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
  } else if (err.name === 'CastError') {
    statusCode = 400;
    message = 'Invalid ID format';
  } else if (err.code === '23505') { // PostgreSQL unique violation
    statusCode = 409;
    message = 'Duplicate entry';
  } else if (err.code === '23503') { // PostgreSQL foreign key violation
    statusCode = 400;
    message = 'Invalid reference';
  }
  
  // Send error response
  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      context: err.context,
      stack: err.stack
    })
  });
};

// Not found handler
const notFoundHandler = (req, res, next) => {
  const error = new AppError(`Cannot ${req.method} ${req.originalUrl}`, 404);
  next(error);
};

// Response helper functions
const sendSuccess = (res, data, message, statusCode = 200) => {
  res.status(statusCode).json({
    success: true,
    data,
    message,
    timestamp: new Date().toISOString()
  });
};

const sendError = (res, error, statusCode = 500) => {
  res.status(statusCode).json({
    success: false,
    error: error.message || error,
    timestamp: new Date().toISOString()
  });
};

module.exports = {
  AppError,
  asyncHandler,
  errorHandler,
  notFoundHandler,
  sendSuccess,
  sendError
};