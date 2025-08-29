import { jest } from '@jest/globals';

// Set test environment variables
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test_jwt_secret_key';
process.env.STRIPE_SECRET_KEY = 'sk_test_test_key_123';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_webhook_secret';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack_key_123';
process.env.DATABASE_URL = ':memory:';
process.env.LOG_LEVEL = 'error';

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Global test timeout
jest.setTimeout(10000);

// Mock external services
jest.mock('stripe', () => {
  return jest.fn(() => ({
    paymentIntents: {
      create: jest.fn(),
      retrieve: jest.fn()
    },
    checkout: {
      sessions: {
        create: jest.fn(),
        retrieve: jest.fn()
      }
    },
    webhooks: {
      constructEvent: jest.fn()
    },
    refunds: {
      create: jest.fn()
    }
  }));
});

jest.mock('axios', () => ({
  post: jest.fn(),
  get: jest.fn()
}));

// Setup and teardown
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.clearAllTimers();
});

// Global error handler for unhandled promises
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Export common test utilities
export const createMockPayment = (overrides = {}) => ({
  id: 'payment-123',
  user_id: 'user-123',
  consultation_id: 'consultation-123',
  provider: 'stripe',
  amount: 5000,
  currency: 'USD',
  status: 'pending',
  customer_email: 'test@example.com',
  created_at: new Date().toISOString(),
  ...overrides
});

export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  name: 'Test User',
  role: 'user',
  ...overrides
});

export const createMockWebhookEvent = (provider, eventType, overrides = {}) => ({
  id: `evt_test_123`,
  type: eventType,
  created: Math.floor(Date.now() / 1000),
  data: {
    object: {
      id: 'payment_test_123',
      ...overrides
    }
  }
});