// Payment API types and interfaces

export interface CreateCheckoutSessionRequest {
  amount: number;
  currency: string;
  description: string;
  customerEmail: string;
  customerName?: string;
  metadata?: Record<string, any>;
  paymentMethod: 'stripe' | 'paystack';
  successUrl: string;
  cancelUrl: string;
}

export interface CreateCheckoutSessionResponse {
  sessionId: string;
  publicKey: string;
  clientSecret?: string;
  redirectUrl?: string;
}

export interface PaymentWebhookData {
  id: string;
  type: 'payment.succeeded' | 'payment.failed' | 'payment.canceled';
  data: {
    id: string;
    amount: number;
    currency: string;
    status: string;
    customer: {
      email: string;
      name?: string;
    };
    metadata: Record<string, any>;
  };
  created: number;
  livemode: boolean;
}

export interface PaymentStatusRequest {
  sessionId: string;
  paymentMethod: 'stripe' | 'paystack';
}

export interface PaymentStatusResponse {
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  amount: number;
  currency: string;
  transactionId: string;
  paymentMethod: string;
  customerEmail: string;
  createdAt: string;
  updatedAt: string;
  metadata?: Record<string, any>;
}

export interface RefundRequest {
  transactionId: string;
  amount?: number; // Partial refund if specified
  reason?: string;
}

export interface RefundResponse {
  refundId: string;
  amount: number;
  status: 'pending' | 'succeeded' | 'failed';
  transactionId: string;
  createdAt: string;
}

export interface PaymentMethodsResponse {
  stripe: {
    available: boolean;
    publicKey: string;
    supportedCurrencies: string[];
    features: string[];
  };
  paystack: {
    available: boolean;
    publicKey: string;
    supportedCurrencies: string[];
    features: string[];
  };
}

export interface PaymentConfigResponse {
  environment: 'development' | 'production';
  supportedMethods: ('stripe' | 'paystack')[];
  defaultCurrency: string;
  minimumAmount: number;
  maximumAmount: number;
  fees: {
    stripe: {
      percentage: number;
      fixed: number;
    };
    paystack: {
      percentage: number;
      fixed: number;
    };
  };
}

// API Error types
export interface PaymentAPIError {
  error: {
    type: string;
    code: string;
    message: string;
    details?: Record<string, any>;
  };
  timestamp: string;
  path: string;
}

// Frontend-specific types
export interface PaymentFormData {
  // Stripe specific
  cardNumber?: string;
  expiryMonth?: string;
  expiryYear?: string;
  cvv?: string;
  
  // Common fields
  customerName: string;
  customerEmail: string;
  billingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  
  // Paystack specific
  phoneNumber?: string;
}

export interface PaymentEnvironment {
  stripePublicKey: string;
  paystackPublicKey: string;
  apiBaseUrl: string;
  environment: 'development' | 'staging' | 'production';
}

// Payment analytics types
export interface PaymentAnalytics {
  sessionId: string;
  paymentMethod: string;
  amount: number;
  currency: string;
  status: string;
  timeToComplete?: number; // in seconds
  errors?: string[];
  userAgent: string;
  timestamp: string;
}

// Webhook verification types
export interface WebhookSignature {
  signature: string;
  timestamp: number;
  payload: string;
}

export interface VerifyWebhookResponse {
  valid: boolean;
  event?: PaymentWebhookData;
  error?: string;
}

// Export commonly used type unions
export type PaymentProvider = 'stripe' | 'paystack';
export type PaymentStatus = 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';
export type PaymentCurrency = 'USD' | 'EUR' | 'GBP' | 'NGN' | 'GHS' | 'KES' | 'UGX' | 'ZAR';

// Configuration for different environments
export const PAYMENT_CONFIG = {
  development: {
    stripePublicKey: 'pk_test_...',
    paystackPublicKey: 'pk_test_...',
    apiBaseUrl: 'http://localhost:3001/api',
  },
  production: {
    stripePublicKey: 'pk_live_...',
    paystackPublicKey: 'pk_live_...',
    apiBaseUrl: 'https://api.yourdomain.com',
  },
};

// API endpoints
export const PAYMENT_ENDPOINTS = {
  createSession: '/payments/create-session',
  getStatus: '/payments/status',
  getMethods: '/payments/methods',
  getConfig: '/payments/config',
  refund: '/payments/refund',
  webhook: '/payments/webhook',
  analytics: '/payments/analytics',
} as const;