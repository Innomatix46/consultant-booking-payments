// Payment validation and utility functions

export interface CardValidation {
  isValid: boolean;
  errors: string[];
}

export interface PaymentValidationResult {
  isValid: boolean;
  errors: Record<string, string>;
}

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validateCardNumber = (cardNumber: string): boolean => {
  // Remove spaces and non-digits
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  // Check length (13-19 digits for most cards)
  if (cleanNumber.length < 13 || cleanNumber.length > 19) {
    return false;
  }
  
  // Luhn algorithm
  let sum = 0;
  let isEven = false;
  
  for (let i = cleanNumber.length - 1; i >= 0; i--) {
    let digit = parseInt(cleanNumber.charAt(i), 10);
    
    if (isEven) {
      digit *= 2;
      if (digit > 9) {
        digit -= 9;
      }
    }
    
    sum += digit;
    isEven = !isEven;
  }
  
  return sum % 10 === 0;
};

export const validateExpiryDate = (month: string, year: string): boolean => {
  const currentDate = new Date();
  const currentMonth = currentDate.getMonth() + 1;
  const currentYear = currentDate.getFullYear();
  
  const expMonth = parseInt(month, 10);
  const expYear = parseInt(year, 10);
  
  // Add 2000 if year is 2 digits
  const fullYear = expYear < 100 ? expYear + 2000 : expYear;
  
  if (expMonth < 1 || expMonth > 12) {
    return false;
  }
  
  if (fullYear < currentYear) {
    return false;
  }
  
  if (fullYear === currentYear && expMonth < currentMonth) {
    return false;
  }
  
  return true;
};

export const validateCVV = (cvv: string, cardNumber?: string): boolean => {
  const cleanCvv = cvv.replace(/\D/g, '');
  
  // American Express cards have 4-digit CVV
  if (cardNumber && isAmericanExpress(cardNumber)) {
    return cleanCvv.length === 4;
  }
  
  // Most other cards have 3-digit CVV
  return cleanCvv.length === 3;
};

export const isAmericanExpress = (cardNumber: string): boolean => {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  return /^3[47]/.test(cleanNumber);
};

export const getCardType = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  
  if (/^4/.test(cleanNumber)) {
    return 'visa';
  } else if (/^5[1-5]|^2[2-7]/.test(cleanNumber)) {
    return 'mastercard';
  } else if (/^3[47]/.test(cleanNumber)) {
    return 'amex';
  } else if (/^6(?:011|5)/.test(cleanNumber)) {
    return 'discover';
  } else if (/^35/.test(cleanNumber)) {
    return 'jcb';
  }
  
  return 'unknown';
};

export const formatCardNumber = (cardNumber: string): string => {
  const cleanNumber = cardNumber.replace(/\D/g, '');
  const cardType = getCardType(cleanNumber);
  
  if (cardType === 'amex') {
    // American Express: XXXX XXXXXX XXXXX
    return cleanNumber.replace(/(\d{4})(\d{6})(\d{5})/, '$1 $2 $3');
  } else {
    // Most cards: XXXX XXXX XXXX XXXX
    return cleanNumber.replace(/(\d{4})(?=\d)/g, '$1 ');
  }
};

export const formatExpiryDate = (value: string): string => {
  const cleanValue = value.replace(/\D/g, '');
  if (cleanValue.length >= 2) {
    return cleanValue.substring(0, 2) + '/' + cleanValue.substring(2, 4);
  }
  return cleanValue;
};

export const validatePaymentForm = (formData: {
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  name?: string;
  email?: string;
}): PaymentValidationResult => {
  const errors: Record<string, string> = {};
  
  if (formData.cardNumber && !validateCardNumber(formData.cardNumber)) {
    errors.cardNumber = 'Please enter a valid card number';
  }
  
  if (formData.expiryMonth && formData.expiryYear && 
      !validateExpiryDate(formData.expiryMonth, formData.expiryYear)) {
    errors.expiry = 'Please enter a valid expiry date';
  }
  
  if (formData.cvv && !validateCVV(formData.cvv, formData.cardNumber)) {
    errors.cvv = 'Please enter a valid CVV';
  }
  
  if (formData.name && formData.name.trim().length < 2) {
    errors.name = 'Please enter your full name';
  }
  
  if (formData.email && !validateEmail(formData.email)) {
    errors.email = 'Please enter a valid email address';
  }
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

export const formatAmount = (amount: number, currency: string): string => {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(amount);
};

export const generateTransactionId = (): string => {
  const timestamp = Date.now().toString();
  const random = Math.random().toString(36).substr(2, 9);
  return `TXN_${timestamp}_${random}`.toUpperCase();
};

export const sanitizePaymentData = (data: any) => {
  // Remove sensitive data before logging or storing
  const sanitized = { ...data };
  
  if (sanitized.cardNumber) {
    sanitized.cardNumber = `****${sanitized.cardNumber.slice(-4)}`;
  }
  
  if (sanitized.cvv) {
    sanitized.cvv = '***';
  }
  
  return sanitized;
};

export const isPaymentMethodAvailable = (method: 'stripe' | 'paystack', country?: string): boolean => {
  if (method === 'stripe') {
    // Stripe is available globally
    return true;
  }
  
  if (method === 'paystack') {
    // Paystack is primarily for African countries
    const africanCountries = [
      'NG', 'GH', 'ZA', 'KE', 'UG', 'TZ', 'RW', 'SN', 'CI', 'BF', 'ML', 'NE', 
      'TD', 'CM', 'CF', 'CG', 'GA', 'GQ', 'ST', 'AO', 'MZ', 'MW', 'ZM', 'ZW',
      'BW', 'SZ', 'LS', 'NA', 'MG', 'MU', 'SC', 'KM', 'DJ', 'SO', 'ER', 'ET',
      'SS', 'SD', 'EG', 'LY', 'TN', 'DZ', 'MA', 'EH'
    ];
    
    return country ? africanCountries.includes(country.toUpperCase()) : true;
  }
  
  return false;
};

export const getCurrencyForCountry = (country: string): string => {
  const currencyMap: Record<string, string> = {
    'US': 'USD',
    'DE': 'EUR',
    'GB': 'GBP',
    'NG': 'NGN',
    'GH': 'GHS',
    'ZA': 'ZAR',
    'KE': 'KES',
    'UG': 'UGX',
    // Add more as needed
  };
  
  return currencyMap[country.toUpperCase()] || 'EUR';
};

export const calculateProcessingFee = (
  amount: number, 
  paymentMethod: 'stripe' | 'paystack'
): number => {
  // These are example rates - use actual provider rates
  if (paymentMethod === 'stripe') {
    // Stripe: 2.9% + 30¢
    return Math.round((amount * 0.029 + 0.30) * 100) / 100;
  }
  
  if (paymentMethod === 'paystack') {
    // Paystack: 1.5% (capped at ₦2,000 for Nigerian cards)
    return Math.round(amount * 0.015 * 100) / 100;
  }
  
  return 0;
};