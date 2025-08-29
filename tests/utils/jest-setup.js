/**
 * Jest Setup Configuration
 * Global setup for all test suites
 */

// Increase timeout for longer running tests
jest.setTimeout(30000);

// Mock external services by default
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-jwt-secret-key';
process.env.STRIPE_SECRET_KEY = 'sk_test_mock_key';
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_mock_key';
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_secret';
process.env.PAYSTACK_SECRET_KEY = 'sk_test_paystack_mock';
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_paystack_mock';

// Global mocks
global.console = {
  ...console,
  // Suppress logs during tests unless debugging
  log: process.env.DEBUG ? console.log : jest.fn(),
  debug: process.env.DEBUG ? console.debug : jest.fn(),
  info: process.env.DEBUG ? console.info : jest.fn(),
  warn: process.env.DEBUG ? console.warn : jest.fn(),
  error: console.error, // Always show errors
};

// Mock fetch globally
global.fetch = jest.fn();

// Mock crypto for consistent test results
jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomBytes: jest.fn(() => Buffer.from('mockedRandomBytes')),
  randomUUID: jest.fn(() => 'mocked-uuid-1234-5678-9012'),
}));

// Global test helpers
global.waitFor = (ms) => new Promise(resolve => setTimeout(resolve, ms));

global.mockStripeResponse = (method, response) => {
  if (global.mockStripe && global.mockStripe[method]) {
    global.mockStripe[method].mockResolvedValue(response);
  }
};

global.mockPaystackResponse = (method, response) => {
  if (global.mockPaystack && global.mockPaystack[method]) {
    global.mockPaystack[method].mockResolvedValue(response);
  }
};

// Enhanced error logging for tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
});

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
  
  // Reset fetch mock
  if (global.fetch && global.fetch.mockReset) {
    global.fetch.mockReset();
  }
});

// Global test data cleanup
afterAll(() => {
  // Force garbage collection if available
  if (global.gc) {
    global.gc();
  }
});