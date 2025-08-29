/**
 * Test Setup and Configuration
 * Provides common test utilities, mocks, and database setup
 */

const { MongoMemoryServer } = require('mongodb-memory-server');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');

let mongoServer;

// Test Database Setup
const setupTestDatabase = async () => {
  mongoServer = await MongoMemoryServer.create();
  const mongoUri = mongoServer.getUri();
  
  await mongoose.connect(mongoUri, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
};

const teardownTestDatabase = async () => {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
  if (mongoServer) {
    await mongoServer.stop();
  }
};

// Test Data Factories
const createTestUser = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439011',
  email: 'test@example.com',
  name: 'Test User',
  stripeCustomerId: 'cus_test123',
  paystackCustomerId: 'CUS_test123',
  ...overrides,
});

const createTestPayment = (overrides = {}) => ({
  _id: '507f1f77bcf86cd799439012',
  userId: '507f1f77bcf86cd799439011',
  amount: 5000, // $50.00 in cents
  currency: 'usd',
  status: 'pending',
  provider: 'stripe',
  paymentIntentId: 'pi_test123',
  metadata: {
    orderId: 'order_123',
    description: 'Test payment',
  },
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
});

const createTestWebhookEvent = (type, data, provider = 'stripe') => {
  const baseEvent = {
    id: `evt_test_${Date.now()}`,
    created: Math.floor(Date.now() / 1000),
    livemode: false,
    pending_webhooks: 1,
    request: {
      id: 'req_test123',
      idempotency_key: null,
    },
  };

  if (provider === 'stripe') {
    return {
      ...baseEvent,
      object: 'event',
      api_version: '2022-11-15',
      type,
      data: { object: data },
    };
  } else if (provider === 'paystack') {
    return {
      event: type,
      data,
    };
  }
};

// JWT Token Generation for Tests
const generateTestToken = (payload = {}) => {
  const defaultPayload = {
    userId: '507f1f77bcf86cd799439011',
    email: 'test@example.com',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
  };
  
  return jwt.sign(
    { ...defaultPayload, ...payload },
    process.env.JWT_SECRET || 'test-secret'
  );
};

// Mock Functions
const createStripeMocks = () => ({
  paymentIntents: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    confirm: jest.fn(),
    cancel: jest.fn(),
  },
  customers: {
    create: jest.fn(),
    retrieve: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  charges: {
    retrieve: jest.fn(),
  },
});

const createPaystackMocks = () => ({
  transaction: {
    initialize: jest.fn(),
    verify: jest.fn(),
    charge_authorization: jest.fn(),
    list: jest.fn(),
  },
  customer: {
    create: jest.fn(),
    get: jest.fn(),
    update: jest.fn(),
  },
  subaccount: {
    create: jest.fn(),
    list: jest.fn(),
  },
});

// Error Generators
const createStripeError = (type, message, statusCode = 400) => {
  const error = new Error(message);
  error.type = type;
  error.statusCode = statusCode;
  error.code = type;
  return error;
};

const createPaystackError = (message, statusCode = 400) => {
  const error = new Error(message);
  error.statusCode = statusCode;
  error.status = false;
  return error;
};

// Test Helpers
const mockRequest = (overrides = {}) => ({
  body: {},
  params: {},
  query: {},
  headers: {},
  user: createTestUser(),
  ...overrides,
});

const mockResponse = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  return res;
};

const mockNext = () => jest.fn();

// Performance Test Helpers
const measureExecutionTime = async (fn) => {
  const start = process.hrtime.bigint();
  const result = await fn();
  const end = process.hrtime.bigint();
  return {
    result,
    executionTime: Number(end - start) / 1000000, // Convert to milliseconds
  };
};

const generateLoadTestData = (count, generator) => {
  return Array.from({ length: count }, (_, index) => generator(index));
};

module.exports = {
  // Database
  setupTestDatabase,
  teardownTestDatabase,
  
  // Factories
  createTestUser,
  createTestPayment,
  createTestWebhookEvent,
  generateTestToken,
  
  // Mocks
  createStripeMocks,
  createPaystackMocks,
  mockRequest,
  mockResponse,
  mockNext,
  
  // Errors
  createStripeError,
  createPaystackError,
  
  // Performance
  measureExecutionTime,
  generateLoadTestData,
};