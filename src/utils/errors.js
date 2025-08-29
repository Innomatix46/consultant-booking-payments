// Custom error classes for the payment system

export class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.name = 'ApiError';

    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

export class PaymentError extends ApiError {
  constructor(message, statusCode = 400, provider = null, errorCode = null) {
    super(statusCode, message);
    this.name = 'PaymentError';
    this.provider = provider;
    this.errorCode = errorCode;
  }
}

export class ValidationError extends ApiError {
  constructor(message, field = null) {
    super(400, message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

export class WebhookError extends ApiError {
  constructor(message, provider = null, statusCode = 400) {
    super(statusCode, message);
    this.name = 'WebhookError';
    this.provider = provider;
  }
}

export class DatabaseError extends ApiError {
  constructor(message, operation = null) {
    super(500, message);
    this.name = 'DatabaseError';
    this.operation = operation;
  }
}

export class AuthenticationError extends ApiError {
  constructor(message = 'Authentication failed') {
    super(401, message);
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends ApiError {
  constructor(message = 'Insufficient permissions') {
    super(403, message);
    this.name = 'AuthorizationError';
  }
}

export class RateLimitError extends ApiError {
  constructor(message = 'Rate limit exceeded') {
    super(429, message);
    this.name = 'RateLimitError';
  }
}

// Error factory functions
export const createStripeError = (stripeError) => {
  const { type, code, message } = stripeError;
  
  switch (type) {
    case 'card_error':
      return new PaymentError(
        message || 'Your card was declined.',
        400,
        'stripe',
        code
      );
    case 'rate_limit_error':
      return new RateLimitError('Too many requests to Stripe.');
    case 'invalid_request_error':
      return new ValidationError(message || 'Invalid request to Stripe.');
    case 'api_error':
      return new PaymentError(
        'Payment service temporarily unavailable.',
        503,
        'stripe',
        code
      );
    case 'authentication_error':
      return new PaymentError(
        'Payment service configuration error.',
        500,
        'stripe',
        code
      );
    default:
      return new PaymentError(
        message || 'Payment processing failed.',
        500,
        'stripe',
        code
      );
  }
};

export const createPaystackError = (paystackResponse) => {
  const { status, message, errors } = paystackResponse;
  
  if (!status && errors) {
    const errorMessages = Array.isArray(errors) ? errors.join(', ') : errors;
    return new PaymentError(
      errorMessages,
      400,
      'paystack'
    );
  }
  
  return new PaymentError(
    message || 'Payment processing failed.',
    400,
    'paystack'
  );
};

export const createDatabaseError = (sqliteError, operation = null) => {
  const { code, message } = sqliteError;
  
  switch (code) {
    case 'SQLITE_CONSTRAINT_UNIQUE':
      return new ValidationError('Duplicate value for unique field.');
    case 'SQLITE_CONSTRAINT_FOREIGNKEY':
      return new ValidationError('Referenced resource does not exist.');
    case 'SQLITE_CONSTRAINT_NOTNULL':
      return new ValidationError('Required field is missing.');
    case 'SQLITE_BUSY':
      return new DatabaseError('Database is busy. Please try again.', operation);
    case 'SQLITE_LOCKED':
      return new DatabaseError('Database is locked. Please try again.', operation);
    default:
      return new DatabaseError(
        message || 'Database operation failed.',
        operation
      );
  }
};

// Error response formatters
export const formatErrorResponse = (error) => {
  const response = {
    success: false,
    message: error.message
  };

  // Add additional fields based on error type
  if (error.name === 'PaymentError') {
    response.provider = error.provider;
    response.errorCode = error.errorCode;
  }

  if (error.name === 'ValidationError') {
    response.field = error.field;
  }

  if (error.name === 'WebhookError') {
    response.provider = error.provider;
  }

  if (error.name === 'DatabaseError') {
    response.operation = error.operation;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = error.stack;
  }

  return response;
};

export const isOperationalError = (error) => {
  if (error instanceof ApiError) {
    return error.isOperational;
  }
  return false;
};