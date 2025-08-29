import { createLogger, format, transports } from 'winston';

const { combine, timestamp, errors, printf, json } = format;

// Custom format for development
const devFormat = printf(({ level, message, timestamp, stack, ...meta }) => {
  let msg = `${timestamp} [${level.toUpperCase()}]: ${message}`;
  
  if (Object.keys(meta).length > 0) {
    msg += ` ${JSON.stringify(meta)}`;
  }
  
  if (stack) {
    msg += `\n${stack}`;
  }
  
  return msg;
});

// Create logger based on environment
const createCustomLogger = () => {
  const isDev = process.env.NODE_ENV !== 'production';
  
  const logger = createLogger({
    level: isDev ? 'debug' : 'info',
    format: combine(
      timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
      errors({ stack: true }),
      isDev ? devFormat : json()
    ),
    defaultMeta: {
      service: 'payment-api'
    },
    transports: [
      new transports.Console({
        silent: process.env.NODE_ENV === 'test'
      })
    ]
  });

  // Add file transport in development
  if (isDev) {
    logger.add(new transports.File({ 
      filename: '/tmp/payment-api.log',
      maxsize: 5242880, // 5MB
      maxFiles: 3
    }));
  }

  return logger;
};

const logger = createCustomLogger();

// Vercel-specific logging helpers
export const logRequest = (req, additionalData = {}) => {
  logger.info('API Request', {
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    ip: req.ip || req.connection.remoteAddress,
    ...additionalData
  });
};

export const logError = (error, context = {}) => {
  logger.error('Error occurred', {
    message: error.message,
    stack: error.stack,
    ...context
  });
};

export const logPaymentEvent = (event, paymentData = {}) => {
  logger.info('Payment Event', {
    event,
    paymentId: paymentData.id,
    provider: paymentData.provider,
    amount: paymentData.amount,
    status: paymentData.status,
    timestamp: new Date().toISOString()
  });
};

export const logWebhookEvent = (provider, event, success = true, error = null) => {
  logger.info('Webhook Event', {
    provider,
    event: event.type || event.event,
    eventId: event.id || event.data?.id,
    success,
    error: error?.message,
    timestamp: new Date().toISOString()
  });
};

export default logger;