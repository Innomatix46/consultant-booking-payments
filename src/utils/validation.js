// Validation utilities for payment data

export const validatePaymentAmount = (amount) => {
  return typeof amount === 'number' && amount > 0 && amount <= 999999999; // Max ~$10M
};

export const validateCurrency = (currency) => {
  const validCurrencies = [
    'USD', 'EUR', 'GBP', 'NGN', 'GHS', 'ZAR', 'KES', 'CAD', 'AUD', 'JPY'
  ];
  return validCurrencies.includes(currency?.toUpperCase());
};

export const validateEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateUUID = (uuid) => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(uuid);
};

export const validatePhoneNumber = (phone) => {
  // Basic international phone number validation
  const phoneRegex = /^\+?[1-9]\d{1,14}$/;
  return phoneRegex.test(phone?.replace(/\s|-/g, ''));
};

export const validateURL = (url) => {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
};

export const sanitizeString = (str) => {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/[<>]/g, '') // Remove potential HTML tags
    .replace(/['"]/g, '') // Remove quotes
    .replace(/[&]/g, '&amp;') // Escape ampersands
    .trim()
    .substring(0, 255); // Limit length
};

export const validateStripeKey = (key, type = 'secret') => {
  const patterns = {
    secret: /^sk_(test_|live_)[a-zA-Z0-9]{24,}$/,
    public: /^pk_(test_|live_)[a-zA-Z0-9]{24,}$/,
    webhook: /^whsec_[a-zA-Z0-9]{32,}$/
  };
  
  return patterns[type]?.test(key) || false;
};

export const validatePaystackKey = (key, type = 'secret') => {
  const patterns = {
    secret: /^sk_(test_|live_)[a-zA-Z0-9]{32,}$/,
    public: /^pk_(test_|live_)[a-zA-Z0-9]{32,}$/
  };
  
  return patterns[type]?.test(key) || false;
};

export const validateWebhookSignature = (signature, provider) => {
  if (!signature || typeof signature !== 'string') return false;
  
  const patterns = {
    stripe: /^v1=[a-f0-9]{64}$/,
    paystack: /^[a-f0-9]{128}$/
  };
  
  return patterns[provider]?.test(signature) || false;
};

export const validatePaymentStatus = (status) => {
  const validStatuses = [
    'pending', 'processing', 'succeeded', 'failed', 'cancelled', 'refunded'
  ];
  return validStatuses.includes(status);
};

export const validateRefundAmount = (refundAmount, originalAmount) => {
  return (
    typeof refundAmount === 'number' &&
    refundAmount > 0 &&
    refundAmount <= originalAmount
  );
};

export const validateMetadata = (metadata) => {
  if (!metadata) return true;
  
  try {
    const parsed = typeof metadata === 'string' ? JSON.parse(metadata) : metadata;
    const serialized = JSON.stringify(parsed);
    return serialized.length <= 10000; // Limit to 10KB
  } catch {
    return false;
  }
};

export const validateDateRange = (startDate, endDate) => {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  return (
    start instanceof Date && !isNaN(start) &&
    end instanceof Date && !isNaN(end) &&
    start <= end &&
    (end - start) <= (365 * 24 * 60 * 60 * 1000) // Max 1 year range
  );
};

export const sanitizeMetadata = (metadata) => {
  if (!metadata) return {};
  
  const sanitized = {};
  for (const [key, value] of Object.entries(metadata)) {
    const cleanKey = sanitizeString(key);
    if (cleanKey && cleanKey.length <= 50) {
      if (typeof value === 'string') {
        sanitized[cleanKey] = sanitizeString(value);
      } else if (typeof value === 'number' && !isNaN(value)) {
        sanitized[cleanKey] = value;
      } else if (typeof value === 'boolean') {
        sanitized[cleanKey] = value;
      }
    }
  }
  
  return sanitized;
};