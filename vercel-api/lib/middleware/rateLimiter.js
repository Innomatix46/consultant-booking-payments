// Simple in-memory rate limiter for serverless
const rateLimitMap = new Map();

const cleanupOldEntries = () => {
  const now = Date.now();
  const cutoff = now - (15 * 60 * 1000); // 15 minutes ago
  
  for (const [key, data] of rateLimitMap.entries()) {
    if (data.resetTime < cutoff) {
      rateLimitMap.delete(key);
    }
  }
};

export const rateLimit = (options = {}) => {
  const {
    windowMs = 15 * 60 * 1000, // 15 minutes
    max = 100, // limit each IP to 100 requests per windowMs
    message = 'Too many requests from this IP, please try again later.',
    keyGenerator = (req) => req.ip || req.connection.remoteAddress
  } = options;

  return (req, res, next) => {
    // Clean up old entries periodically
    if (Math.random() < 0.01) { // 1% chance to cleanup
      cleanupOldEntries();
    }

    const key = keyGenerator(req);
    const now = Date.now();
    const resetTime = now + windowMs;

    let rateLimitInfo = rateLimitMap.get(key);

    if (!rateLimitInfo || now > rateLimitInfo.resetTime) {
      rateLimitInfo = {
        count: 1,
        resetTime: resetTime
      };
    } else {
      rateLimitInfo.count++;
    }

    rateLimitMap.set(key, rateLimitInfo);

    const remaining = Math.max(0, max - rateLimitInfo.count);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', remaining);
    res.setHeader('X-RateLimit-Reset', new Date(rateLimitInfo.resetTime));

    if (rateLimitInfo.count > max) {
      res.status(429).json({
        success: false,
        message: message,
        retryAfter: Math.ceil((rateLimitInfo.resetTime - now) / 1000)
      });
      return;
    }

    next();
  };
};

export const paymentRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // limit each IP to 10 payment requests per windowMs
  message: 'Too many payment requests from this IP, please try again later.'
});

export const withRateLimit = (handler, rateLimitOptions) => {
  const rateLimitMiddleware = rateLimit(rateLimitOptions);
  
  return async (req, res) => {
    return new Promise((resolve, reject) => {
      rateLimitMiddleware(req, res, (err) => {
        if (err) {
          reject(err);
        } else if (res.headersSent) {
          // Rate limit was hit
          resolve();
        } else {
          handler(req, res).then(resolve).catch(reject);
        }
      });
    });
  };
};