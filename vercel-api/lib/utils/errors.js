export class ApiError extends Error {
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

export class ValidationError extends ApiError {
  constructor(message, errors = []) {
    super(400, message);
    this.errors = errors;
    this.name = 'ValidationError';
  }
}

export class PaymentError extends ApiError {
  constructor(message, provider, providerError = null) {
    super(422, message);
    this.provider = provider;
    this.providerError = providerError;
    this.name = 'PaymentError';
  }
}

export class WebhookError extends ApiError {
  constructor(message, provider, event = null) {
    super(400, message);
    this.provider = provider;
    this.event = event;
    this.name = 'WebhookError';
  }
}

export const errorHandler = (error, req, res) => {
  let { statusCode = 500, message } = error;
  
  // Log error for debugging
  console.error('API Error:', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Don't leak error details in production
  if (process.env.NODE_ENV === 'production' && !error.isOperational) {
    statusCode = 500;
    message = 'Something went wrong!';
  }

  const response = {
    success: false,
    message,
    ...(error.errors && { errors: error.errors }),
    ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
  };

  res.status(statusCode).json(response);
};

export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((error) => {
      errorHandler(error, req, res);
    });
  };
};

export const withErrorHandling = (handler) => {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (error) {
      errorHandler(error, req, res);
    }
  };
};