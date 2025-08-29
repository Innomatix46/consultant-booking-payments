// Environment Configuration for Vercel Deployment
export const environments = {
  development: {
    DATABASE_URL: process.env.DATABASE_URL || 'file:./dev.db',
    FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || 'http://localhost:3000,http://localhost:5173',
    LOG_LEVEL: 'debug',
    ENABLE_CORS: true,
    RATE_LIMIT_MAX: 1000,
    WEBHOOK_TIMEOUT: 10000
  },
  
  preview: {
    DATABASE_URL: process.env.DATABASE_URL,
    FRONTEND_URL: process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : process.env.FRONTEND_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS || process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : '*',
    LOG_LEVEL: 'info',
    ENABLE_CORS: true,
    RATE_LIMIT_MAX: 500,
    WEBHOOK_TIMEOUT: 15000
  },
  
  production: {
    DATABASE_URL: process.env.DATABASE_URL,
    FRONTEND_URL: process.env.FRONTEND_URL,
    ALLOWED_ORIGINS: process.env.ALLOWED_ORIGINS,
    LOG_LEVEL: 'error',
    ENABLE_CORS: true,
    RATE_LIMIT_MAX: 100,
    WEBHOOK_TIMEOUT: 30000
  }
};

export function getEnvironmentConfig() {
  const env = process.env.NODE_ENV || 'development';
  const vercelEnv = process.env.VERCEL_ENV;
  
  // Map Vercel environments to our environments
  let environmentKey = env;
  if (vercelEnv === 'preview') {
    environmentKey = 'preview';
  } else if (vercelEnv === 'production') {
    environmentKey = 'production';
  }
  
  return environments[environmentKey] || environments.development;
}

export function validateRequiredEnvironmentVariables() {
  const required = [
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'PAYSTACK_SECRET_KEY',
    'PAYSTACK_WEBHOOK_SECRET',
    'DATABASE_URL',
    'JWT_SECRET'
  ];
  
  const production = [
    'FRONTEND_URL',
    'ALLOWED_ORIGINS',
    'SENTRY_DSN' // For error tracking
  ];
  
  const missing = [];
  
  // Check required variables
  required.forEach(key => {
    if (!process.env[key]) {
      missing.push(key);
    }
  });
  
  // Check production-specific variables
  if (process.env.NODE_ENV === 'production' || process.env.VERCEL_ENV === 'production') {
    production.forEach(key => {
      if (!process.env[key]) {
        missing.push(key);
      }
    });
  }
  
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
  
  return true;
}

// Database configuration for different environments
export function getDatabaseConfig() {
  const config = getEnvironmentConfig();
  
  if (config.DATABASE_URL.startsWith('file:')) {
    // SQLite configuration
    return {
      type: 'sqlite',
      url: config.DATABASE_URL,
      options: {
        timeout: 10000,
        verbose: config.LOG_LEVEL === 'debug' ? console.log : undefined
      }
    };
  } else if (config.DATABASE_URL.startsWith('postgresql:')) {
    // PostgreSQL configuration (recommended for production)
    return {
      type: 'postgresql',
      url: config.DATABASE_URL,
      options: {
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 2000,
      }
    };
  } else {
    throw new Error('Unsupported database URL format');
  }
}