// Rate Limiting Middleware for Vercel Serverless Functions
import { createHash } from 'crypto';

// In-memory store for rate limiting (consider Redis for production)
const requestCounts = new Map();
const WINDOW_SIZE_MS = 15 * 60 * 1000; // 15 minutes
const MAX_REQUESTS = 100; // Maximum requests per window

function getClientId(req) {
  // Use IP address and User-Agent for client identification
  const forwarded = req.headers['x-forwarded-for'];
  const ip = forwarded ? forwarded.split(',')[0] : req.connection.remoteAddress;
  const userAgent = req.headers['user-agent'] || '';
  
  return createHash('md5').update(`${ip}:${userAgent}`).digest('hex');
}

function cleanupExpiredEntries() {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > WINDOW_SIZE_MS) {
      requestCounts.delete(key);
    }
  }
}

export function rateLimiter(req, res) {
  return new Promise((resolve) => {
    const clientId = getClientId(req);
    const now = Date.now();
    
    // Cleanup expired entries periodically
    if (Math.random() < 0.1) { // 10% chance to cleanup
      cleanupExpiredEntries();
    }

    let clientData = requestCounts.get(clientId);
    
    if (!clientData) {
      // First request from this client
      clientData = {
        count: 1,
        windowStart: now
      };
      requestCounts.set(clientId, clientData);
      return resolve({ blocked: false });
    }

    // Check if we're in a new window
    if (now - clientData.windowStart >= WINDOW_SIZE_MS) {
      // Reset the window
      clientData.count = 1;
      clientData.windowStart = now;
      requestCounts.set(clientId, clientData);
      return resolve({ blocked: false });
    }

    // We're within the current window
    clientData.count++;
    requestCounts.set(clientId, clientData);

    if (clientData.count > MAX_REQUESTS) {
      // Rate limit exceeded
      const retryAfter = Math.ceil((WINDOW_SIZE_MS - (now - clientData.windowStart)) / 1000);
      
      res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((clientData.windowStart + WINDOW_SIZE_MS) / 1000));
      res.setHeader('Retry-After', retryAfter);
      
      return resolve({ 
        blocked: true, 
        retryAfter: retryAfter 
      });
    }

    // Request is allowed
    res.setHeader('X-RateLimit-Limit', MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS - clientData.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil((clientData.windowStart + WINDOW_SIZE_MS) / 1000));
    
    resolve({ blocked: false });
  });
}

// Enhanced rate limiter for sensitive endpoints
export function strictRateLimiter(req, res) {
  return new Promise((resolve) => {
    const STRICT_MAX_REQUESTS = 10; // Lower limit for sensitive endpoints
    const clientId = getClientId(req);
    const now = Date.now();
    
    let clientData = requestCounts.get(`strict_${clientId}`);
    
    if (!clientData) {
      clientData = {
        count: 1,
        windowStart: now
      };
      requestCounts.set(`strict_${clientId}`, clientData);
      return resolve({ blocked: false });
    }

    if (now - clientData.windowStart >= WINDOW_SIZE_MS) {
      clientData.count = 1;
      clientData.windowStart = now;
      requestCounts.set(`strict_${clientId}`, clientData);
      return resolve({ blocked: false });
    }

    clientData.count++;
    requestCounts.set(`strict_${clientId}`, clientData);

    if (clientData.count > STRICT_MAX_REQUESTS) {
      const retryAfter = Math.ceil((WINDOW_SIZE_MS - (now - clientData.windowStart)) / 1000);
      
      res.setHeader('X-RateLimit-Limit', STRICT_MAX_REQUESTS);
      res.setHeader('X-RateLimit-Remaining', 0);
      res.setHeader('X-RateLimit-Reset', Math.ceil((clientData.windowStart + WINDOW_SIZE_MS) / 1000));
      res.setHeader('Retry-After', retryAfter);
      
      return resolve({ 
        blocked: true, 
        retryAfter: retryAfter 
      });
    }

    res.setHeader('X-RateLimit-Limit', STRICT_MAX_REQUESTS);
    res.setHeader('X-RateLimit-Remaining', STRICT_MAX_REQUESTS - clientData.count);
    res.setHeader('X-RateLimit-Reset', Math.ceil((clientData.windowStart + WINDOW_SIZE_MS) / 1000));
    
    resolve({ blocked: false });
  });
}