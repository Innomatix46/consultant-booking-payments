import winston from 'winston';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create logs directory if it doesn't exist
const logDir = join(__dirname, '../../logs');
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Define log format
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Define console format for development
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}]: ${message}`;
    if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  defaultMeta: { service: 'payment-api' },
  transports: [
    // File transport for errors
    new winston.transports.File({
      filename: join(logDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    }),
    
    // File transport for all logs
    new winston.transports.File({
      filename: join(logDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    }),

    // File transport for payment-specific logs
    new winston.transports.File({
      filename: join(logDir, 'payments.log'),
      level: 'info',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true,
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.json(),
        winston.format((info) => {
          // Only log payment-related messages
          if (info.message.includes('payment') || 
              info.message.includes('stripe') || 
              info.message.includes('paystack') ||
              info.message.includes('webhook')) {
            return info;
          }
          return false;
        })()
      )
    })
  ]
});

// Add console transport in development
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: consoleFormat,
    level: 'debug'
  }));
}

// Add console transport in production for errors only
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console({
    format: logFormat,
    level: 'error'
  }));
}

// Create a stream for Morgan HTTP logger
logger.stream = {
  write: (message) => {
    logger.info(message.trim());
  }
};

// Export logger with additional convenience methods
export default {
  ...logger,
  
  // Payment-specific logging methods
  paymentSuccess: (message, meta = {}) => {
    logger.info(`PAYMENT SUCCESS: ${message}`, { type: 'payment_success', ...meta });
  },
  
  paymentFailed: (message, meta = {}) => {
    logger.error(`PAYMENT FAILED: ${message}`, { type: 'payment_failure', ...meta });
  },
  
  webhookReceived: (provider, eventType, meta = {}) => {
    logger.info(`WEBHOOK: ${provider} - ${eventType}`, { type: 'webhook', provider, eventType, ...meta });
  },
  
  securityAlert: (message, meta = {}) => {
    logger.warn(`SECURITY ALERT: ${message}`, { type: 'security', ...meta });
  },
  
  auditLog: (action, userId, meta = {}) => {
    logger.info(`AUDIT: ${action}`, { type: 'audit', userId, action, ...meta });
  }
};