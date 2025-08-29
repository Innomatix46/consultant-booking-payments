import logger from '../utils/logger.js';

class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;

  // Log error
  logger.error(`Error ${err.statusCode || 500}: ${err.message}`, {
    url: req.originalUrl,
    method: req.method,
    ip: req.ip,
    stack: err.stack
  });

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = new ApiError(404, message);
  }

  // Mongoose duplicate key
  if (err.code === 11000) {
    const message = 'Duplicate field value entered';
    error = new ApiError(400, message);
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values(err.errors).map(val => val.message);
    error = new ApiError(400, message);
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token. Please log in again';
    error = new ApiError(401, message);
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired. Please log in again';
    error = new ApiError(401, message);
  }

  // SQLite errors
  if (err.code === 'SQLITE_CONSTRAINT_UNIQUE') {
    const message = 'Duplicate value for unique field';
    error = new ApiError(400, message);
  }

  if (err.code === 'SQLITE_CONSTRAINT_FOREIGNKEY') {
    const message = 'Referenced resource does not exist';
    error = new ApiError(400, message);
  }

  // Stripe errors
  if (err.type === 'StripeCardError') {
    const message = 'Your card was declined. Please try again with a different payment method.';
    error = new ApiError(400, message);
  }

  if (err.type === 'StripeRateLimitError') {
    const message = 'Too many requests made to Stripe API. Please try again later.';
    error = new ApiError(429, message);
  }

  if (err.type === 'StripeInvalidRequestError') {
    const message = 'Invalid payment request. Please check your payment details.';
    error = new ApiError(400, message);
  }

  if (err.type === 'StripeAPIError') {
    const message = 'Payment service temporarily unavailable. Please try again later.';
    error = new ApiError(503, message);
  }

  if (err.type === 'StripeConnectionError') {
    const message = 'Network error with payment service. Please try again.';
    error = new ApiError(503, message);
  }

  if (err.type === 'StripeAuthenticationError') {
    const message = 'Payment service configuration error. Please contact support.';
    error = new ApiError(500, message);
  }

  // Paystack errors
  if (err.response && err.response.data && err.response.data.message) {
    const message = err.response.data.message;
    error = new ApiError(err.response.status || 400, message);
  }

  // Default to 500 server error
  const statusCode = error.statusCode || 500;
  const message = error.message || 'Server Error';

  res.status(statusCode).json({
    success: false,
    error: message,
    ...(process.env.NODE_ENV === 'development' && {
      stack: err.stack,
      details: err
    })
  });
};

export { ApiError };
export default errorHandler;