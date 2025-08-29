// Monitoring and Error Tracking Configuration for Vercel

import * as Sentry from '@sentry/node';
import { getEnvironmentConfig } from './environment.js';

// Initialize error tracking
export function initializeMonitoring() {
  if (process.env.SENTRY_DSN) {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
      debug: process.env.NODE_ENV === 'development',
      
      // Performance monitoring
      integrations: [
        new Sentry.Integrations.Http({ tracing: true }),
        new Sentry.Integrations.Console(),
      ],
      
      // Release tracking
      release: process.env.VERCEL_GIT_COMMIT_SHA || process.env.npm_package_version,
      
      // Filter out noise
      beforeSend(event) {
        // Don't send 404 errors
        if (event.exception?.values?.[0]?.type === 'NotFoundError') {
          return null;
        }
        
        // Filter out rate limit errors (they're handled gracefully)
        if (event.tags?.errorType === 'RATE_LIMIT') {
          return null;
        }
        
        return event;
      }
    });
    
    console.log('✅ Sentry monitoring initialized');
  }
}

// Health check endpoint
export function healthCheck() {
  return {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    version: process.env.npm_package_version || 'unknown',
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.substring(0, 7) || 'unknown',
    uptime: process.uptime(),
    memory: process.memoryUsage()
  };
}

// Performance monitoring
export class PerformanceMonitor {
  constructor() {
    this.metrics = new Map();
  }
  
  startTimer(name) {
    this.metrics.set(name, {
      startTime: process.hrtime.bigint(),
      startMemory: process.memoryUsage()
    });
  }
  
  endTimer(name) {
    const metric = this.metrics.get(name);
    if (!metric) return null;
    
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    
    const duration = Number(endTime - metric.startTime) / 1000000; // Convert to ms
    const memoryDelta = endMemory.heapUsed - metric.startMemory.heapUsed;
    
    const result = {
      duration,
      memoryDelta,
      finalMemory: endMemory.heapUsed
    };
    
    this.metrics.delete(name);
    
    // Log performance metrics
    console.log(JSON.stringify({
      type: 'PERFORMANCE_METRIC',
      operation: name,
      durationMs: duration,
      memoryDeltaBytes: memoryDelta,
      timestamp: new Date().toISOString()
    }));
    
    // Track in Sentry
    if (Sentry.getCurrentHub().getClient()) {
      Sentry.addBreadcrumb({
        message: 'Performance metric',
        data: { operation: name, ...result },
        level: 'info'
      });
    }
    
    return result;
  }
}

// Error tracking helper
export function trackError(error, context = {}) {
  console.error('Error tracked:', error);
  
  // Add context to Sentry
  if (Sentry.getCurrentHub().getClient()) {
    Sentry.withScope((scope) => {
      Object.keys(context).forEach(key => {
        scope.setTag(key, context[key]);
      });
      
      scope.setLevel('error');
      Sentry.captureException(error);
    });
  }
  
  // Also log structured error for other monitoring tools
  console.error(JSON.stringify({
    type: 'ERROR',
    message: error.message,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  }));
}

// Track custom events
export function trackEvent(eventName, properties = {}) {
  // Log event for analytics
  console.log(JSON.stringify({
    type: 'EVENT',
    event: eventName,
    properties,
    timestamp: new Date().toISOString()
  }));
  
  // Track in Sentry as breadcrumb
  if (Sentry.getCurrentHub().getClient()) {
    Sentry.addBreadcrumb({
      message: eventName,
      data: properties,
      level: 'info'
    });
  }
}

// Payment-specific monitoring
export function trackPaymentEvent(event, paymentData) {
  const eventData = {
    type: 'PAYMENT_EVENT',
    event,
    paymentId: paymentData.id,
    provider: paymentData.provider,
    amount: paymentData.amount,
    currency: paymentData.currency,
    status: paymentData.status,
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(eventData));
  
  // Track critical payment events in Sentry
  if (['payment_failed', 'payment_error', 'webhook_verification_failed'].includes(event)) {
    Sentry.withScope((scope) => {
      scope.setTag('eventType', 'payment');
      scope.setTag('paymentProvider', paymentData.provider);
      scope.setLevel('warning');
      
      Sentry.captureMessage(`Payment event: ${event}`, 'warning');
    });
  }
}

// Webhook monitoring
export function trackWebhookEvent(provider, eventType, success, error = null) {
  const eventData = {
    type: 'WEBHOOK_EVENT',
    provider,
    eventType,
    success,
    error: error?.message,
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(eventData));
  
  if (!success && error) {
    trackError(error, {
      webhookProvider: provider,
      webhookEventType: eventType,
      errorType: 'WEBHOOK_ERROR'
    });
  }
}

// Rate limiting monitoring
export function trackRateLimitEvent(clientId, endpoint, blocked) {
  const eventData = {
    type: 'RATE_LIMIT_EVENT',
    clientId: clientId.substring(0, 8), // Only log partial ID for privacy
    endpoint,
    blocked,
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(eventData));
  
  if (blocked) {
    Sentry.addBreadcrumb({
      message: 'Rate limit triggered',
      data: { endpoint, blocked },
      level: 'warning'
    });
  }
}

// Database operation monitoring
export function trackDatabaseOperation(operation, tableName, duration, error = null) {
  const eventData = {
    type: 'DATABASE_OPERATION',
    operation,
    table: tableName,
    durationMs: duration,
    success: !error,
    error: error?.message,
    timestamp: new Date().toISOString()
  };
  
  console.log(JSON.stringify(eventData));
  
  if (error) {
    trackError(error, {
      databaseOperation: operation,
      tableName,
      errorType: 'DATABASE_ERROR'
    });
  }
  
  // Alert on slow queries
  if (duration > 1000) { // More than 1 second
    console.warn(`Slow database query detected: ${operation} on ${tableName} took ${duration}ms`);
  }
}

// Uptime monitoring helper
export function createUptimeCheck() {
  const config = getEnvironmentConfig();
  
  return {
    url: `${config.FRONTEND_URL}/api/health`,
    interval: 60, // seconds
    timeout: 10,  // seconds
    expectedStatus: 200,
    expectedContent: 'healthy'
  };
}

// Export monitoring middleware for Express/Vercel functions
export function monitoringMiddleware(req, res, next) {
  const startTime = process.hrtime.bigint();
  const startMemory = process.memoryUsage();
  
  // Add request ID for tracing
  const requestId = req.headers['x-request-id'] || Math.random().toString(36).substring(7);
  req.requestId = requestId;
  res.setHeader('X-Request-ID', requestId);
  
  // Log request start
  console.log(JSON.stringify({
    type: 'REQUEST_START',
    requestId,
    method: req.method,
    url: req.url,
    userAgent: req.headers['user-agent'],
    timestamp: new Date().toISOString()
  }));
  
  // Override res.end to capture response metrics
  const originalEnd = res.end;
  res.end = function(...args) {
    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();
    const duration = Number(endTime - startTime) / 1000000; // Convert to ms
    const memoryDelta = endMemory.heapUsed - startMemory.heapUsed;
    
    // Log request completion
    console.log(JSON.stringify({
      type: 'REQUEST_END',
      requestId,
      method: req.method,
      url: req.url,
      statusCode: res.statusCode,
      durationMs: duration,
      memoryDeltaBytes: memoryDelta,
      timestamp: new Date().toISOString()
    }));
    
    // Track errors
    if (res.statusCode >= 400) {
      trackEvent('request_error', {
        requestId,
        method: req.method,
        url: req.url,
        statusCode: res.statusCode,
        duration
      });
    }
    
    // Track slow requests
    if (duration > 5000) { // More than 5 seconds
      trackEvent('slow_request', {
        requestId,
        method: req.method,
        url: req.url,
        duration
      });
    }
    
    originalEnd.apply(this, args);
  };
  
  if (next) next();
}

// Initialize monitoring on import
initializeMonitoring();