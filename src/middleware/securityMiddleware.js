import { ApiError } from './errorHandler.js';
import logger from '../utils/logger.js';

const securityMiddleware = (req, res, next) => {
  // Check for common malicious patterns
  const suspiciousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /onload=/gi,
    /onerror=/gi,
    /eval\(/gi,
    /exec\(/gi,
    /(union|select|insert|update|delete|drop|create|alter)\s/gi,
    /\.\.\//g,
    /\/etc\/passwd/g,
    /\/bin\/bash/g
  ];

  const requestString = JSON.stringify({
    url: req.originalUrl,
    params: req.params,
    query: req.query,
    body: req.body
  });

  // Check for suspicious patterns
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(requestString)) {
      logger.warn('Suspicious request blocked', {
        ip: req.ip,
        url: req.originalUrl,
        userAgent: req.get('User-Agent'),
        pattern: pattern.toString()
      });

      return next(new ApiError(400, 'Request blocked due to security concerns'));
    }
  }

  // Rate limiting check (basic implementation)
  const rateLimitKey = `rate_limit_${req.ip}`;
  const now = Date.now();
  
  if (!req.rateLimit) {
    req.rateLimit = new Map();
  }

  const requests = req.rateLimit.get(rateLimitKey) || [];
  const recentRequests = requests.filter(timestamp => now - timestamp < 60000); // 1 minute window

  if (recentRequests.length > 100) { // Max 100 requests per minute per IP
    logger.warn('Rate limit exceeded', {
      ip: req.ip,
      url: req.originalUrl,
      requestCount: recentRequests.length
    });

    return next(new ApiError(429, 'Too many requests. Please try again later.'));
  }

  recentRequests.push(now);
  req.rateLimit.set(rateLimitKey, recentRequests);

  // Content length check
  const maxContentLength = 10 * 1024 * 1024; // 10MB
  const contentLength = parseInt(req.get('content-length') || '0');

  if (contentLength > maxContentLength) {
    logger.warn('Request blocked - content too large', {
      ip: req.ip,
      url: req.originalUrl,
      contentLength: contentLength
    });

    return next(new ApiError(413, 'Request entity too large'));
  }

  // Check for valid JSON in POST/PUT requests
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.is('application/json')) {
    if (req.body === undefined) {
      return next(new ApiError(400, 'Invalid JSON in request body'));
    }
  }

  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Remove sensitive headers
  res.removeHeader('X-Powered-By');

  next();
};

export default securityMiddleware;