/**
 * Integration Tests for Paystack API
 * Tests actual API interactions with mocked responses
 */

const request = require('supertest');
const app = require('../../src/app');
const {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  generateTestToken,
} = require('../utils/test-setup');

// Mock Paystack SDK
const mockPaystack = {
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
  refund: {
    create: jest.fn(),
  },
  subaccount: {
    create: jest.fn(),
  },
};

jest.mock('paystack-node', () => jest.fn(() => mockPaystack));

describe('Paystack Integration', () => {
  let server;
  let testUser;
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    server = app.listen(0);
  });

  afterAll(async () => {
    await teardownTestDatabase();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    testUser = createTestUser({
      email: 'test@example.ng',
      country: 'NG',
    });
    authToken = generateTestToken({ userId: testUser._id });
    jest.clearAllMocks();
  });

  describe('Payment Initialization', () => {
    it('should initialize payment transaction', async () => {
      const mockInitResponse = {
        status: true,
        message: 'Authorization URL created',
        data: {
          authorization_url: 'https://checkout.paystack.com/0peioxfhpn',
          access_code: 'rKodHxIipgxBMiF2hJx5',
          reference: 'test_reference_123',
        },
      };

      mockPaystack.transaction.initialize.mockResolvedValue(mockInitResponse);

      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50000, // ₦500.00 in kobo
          currency: 'NGN',
          email: testUser.email,
          description: 'Test payment',
          metadata: {
            orderId: 'order_123',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        data: {
          authorizationUrl: 'https://checkout.paystack.com/0peioxfhpn',
          reference: 'test_reference_123',
          accessCode: 'rKodHxIipgxBMiF2hJx5',
        },
      });

      expect(mockPaystack.transaction.initialize).toHaveBeenCalledWith({
        email: testUser.email,
        amount: 50000,
        currency: 'NGN',
        reference: expect.any(String),
        callback_url: expect.any(String),
        metadata: expect.objectContaining({
          orderId: 'order_123',
          userId: testUser._id,
        }),
      });
    });

    it('should handle currency conversion for non-NGN currencies', async () => {
      const mockInitResponse = {
        status: true,
        data: {
          authorization_url: 'https://checkout.paystack.com/test',
          reference: 'test_ref_usd',
        },
      };

      mockPaystack.transaction.initialize.mockResolvedValue(mockInitResponse);

      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000, // $50.00 in cents
          currency: 'USD',
          email: testUser.email,
        });

      expect(response.status).toBe(200);
      
      // Paystack should receive amount in kobo for NGN or pesewas for GHS
      expect(mockPaystack.transaction.initialize).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000, // USD amount stays the same
          currency: 'USD',
        })
      );
    });

    it('should validate required fields for Paystack', async () => {
      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50000,
          // Missing email and currency
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('email');
    });

    it('should handle Paystack API errors', async () => {
      const paystackError = {
        status: false,
        message: 'Invalid email address',
        type: 'validation_error',
      };

      mockPaystack.transaction.initialize.mockRejectedValue(paystackError);

      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50000,
          currency: 'NGN',
          email: 'invalid-email',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Invalid email address',
          type: 'validation_error',
        },
      });
    });
  });

  describe('Payment Verification', () => {
    it('should verify successful payment', async () => {
      const mockVerifyResponse = {
        status: true,
        message: 'Verification successful',
        data: {
          id: 302961,
          domain: 'live',
          status: 'success',
          reference: 'test_reference_123',
          amount: 50000,
          message: null,
          gateway_response: 'Successful',
          paid_at: '2023-01-01T10:00:00Z',
          created_at: '2023-01-01T09:00:00Z',
          currency: 'NGN',
          ip_address: '192.168.1.1',
          metadata: {
            orderId: 'order_123',
            userId: testUser._id,
          },
          log: null,
          fees: 750,
          fees_split: null,
          authorization: {
            authorization_code: 'AUTH_test123',
            bin: '408408',
            last4: '4081',
            exp_month: '12',
            exp_year: '2025',
            channel: 'card',
            card_type: 'visa',
            bank: 'TEST BANK',
            country_code: 'NG',
            brand: 'visa',
            reusable: true,
            signature: 'SIG_test123',
          },
          customer: {
            id: 84312,
            first_name: 'Test',
            last_name: 'User',
            email: testUser.email,
            customer_code: 'CUS_test123',
            phone: null,
            metadata: null,
            risk_action: 'default',
          },
        },
      };

      mockPaystack.transaction.verify.mockResolvedValue(mockVerifyResponse);

      const response = await request(app)
        .post('/api/payments/paystack/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reference: 'test_reference_123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        payment: {
          reference: 'test_reference_123',
          status: 'success',
          amount: 500, // Converted back to base currency
          currency: 'ngn',
          fees: 7.5, // Converted back to base currency
          provider: 'paystack',
        },
      });

      expect(mockPaystack.transaction.verify).toHaveBeenCalledWith('test_reference_123');
    });

    it('should handle failed payment verification', async () => {
      const mockVerifyResponse = {
        status: true,
        data: {
          status: 'failed',
          reference: 'test_reference_failed',
          amount: 50000,
          currency: 'NGN',
          gateway_response: 'Declined by financial institution',
        },
      };

      mockPaystack.transaction.verify.mockResolvedValue(mockVerifyResponse);

      const response = await request(app)
        .post('/api/payments/paystack/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reference: 'test_reference_failed',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Payment failed',
          details: 'Declined by financial institution',
        },
      });
    });

    it('should handle invalid reference', async () => {
      const mockVerifyResponse = {
        status: false,
        message: 'Transaction reference not found',
      };

      mockPaystack.transaction.verify.mockResolvedValue(mockVerifyResponse);

      const response = await request(app)
        .post('/api/payments/paystack/verify')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          reference: 'invalid_reference',
        });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Transaction not found',
        },
      });
    });
  });

  describe('Customer Management', () => {
    it('should create Paystack customer', async () => {
      const mockCustomerResponse = {
        status: true,
        message: 'Customer created',
        data: {
          email: testUser.email,
          integration: 100032,
          domain: 'live',
          customer_code: 'CUS_test123456',
          id: 84312,
          identified: false,
          identifications: null,
          createdAt: '2023-01-01T10:00:00Z',
          updatedAt: '2023-01-01T10:00:00Z',
        },
      };

      mockPaystack.customer.create.mockResolvedValue(mockCustomerResponse);

      const response = await request(app)
        .post('/api/customers/paystack')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: testUser.email,
          first_name: 'Test',
          last_name: 'User',
          phone: '+2348000000000',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        customer: {
          customerCode: 'CUS_test123456',
          email: testUser.email,
          id: 84312,
        },
      });

      expect(mockPaystack.customer.create).toHaveBeenCalledWith({
        email: testUser.email,
        first_name: 'Test',
        last_name: 'User',
        phone: '+2348000000000',
        metadata: {
          userId: testUser._id,
        },
      });
    });

    it('should retrieve existing customer', async () => {
      const mockCustomerResponse = {
        status: true,
        data: {
          id: 84312,
          customer_code: 'CUS_test123456',
          email: testUser.email,
          first_name: 'Test',
          last_name: 'User',
          phone: '+2348000000000',
        },
      };

      mockPaystack.customer.get.mockResolvedValue(mockCustomerResponse);

      const response = await request(app)
        .get('/api/customers/paystack/CUS_test123456')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        customer: mockCustomerResponse.data,
      });
    });

    it('should handle customer not found', async () => {
      const mockErrorResponse = {
        status: false,
        message: 'Customer not found',
      };

      mockPaystack.customer.get.mockResolvedValue(mockErrorResponse);

      const response = await request(app)
        .get('/api/customers/paystack/CUS_nonexistent')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Customer not found',
        },
      });
    });
  });

  describe('Recurring Payments', () => {
    it('should charge authorization for recurring payment', async () => {
      const mockChargeResponse = {
        status: true,
        message: 'Charge attempted',
        data: {
          id: 302962,
          domain: 'live',
          status: 'success',
          reference: 'recurring_payment_123',
          amount: 25000,
          message: null,
          gateway_response: 'Successful',
          paid_at: '2023-01-01T10:00:00Z',
          created_at: '2023-01-01T10:00:00Z',
          currency: 'NGN',
          ip_address: '192.168.1.1',
          fees: 375,
        },
      };

      mockPaystack.transaction.charge_authorization.mockResolvedValue(mockChargeResponse);

      const response = await request(app)
        .post('/api/payments/paystack/charge-authorization')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          authorization_code: 'AUTH_test123',
          email: testUser.email,
          amount: 25000,
          currency: 'NGN',
          metadata: {
            subscription_id: 'sub_123',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        payment: {
          status: 'success',
          reference: 'recurring_payment_123',
          amount: 250, // Converted back
          fees: 3.75, // Converted back
        },
      });

      expect(mockPaystack.transaction.charge_authorization).toHaveBeenCalledWith({
        authorization_code: 'AUTH_test123',
        email: testUser.email,
        amount: 25000,
        currency: 'NGN',
        reference: expect.any(String),
        metadata: expect.objectContaining({
          subscription_id: 'sub_123',
          userId: testUser._id,
        }),
      });
    });

    it('should handle failed authorization charge', async () => {
      const mockChargeResponse = {
        status: true,
        data: {
          status: 'failed',
          reference: 'failed_charge_123',
          gateway_response: 'Insufficient funds',
        },
      };

      mockPaystack.transaction.charge_authorization.mockResolvedValue(mockChargeResponse);

      const response = await request(app)
        .post('/api/payments/paystack/charge-authorization')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          authorization_code: 'AUTH_test123',
          email: testUser.email,
          amount: 25000,
          currency: 'NGN',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Charge failed',
          details: 'Insufficient funds',
        },
      });
    });
  });

  describe('Refunds', () => {
    it('should process refund', async () => {
      const mockRefundResponse = {
        status: true,
        message: 'Refund has been queued for processing',
        data: {
          transaction: {
            id: 302961,
            reference: 'test_reference_123',
          },
          integration: 100032,
          deducted_amount: 0,
          channel: 'card',
          merchant_note: 'Refund requested by customer',
          customer_note: 'Product was defective',
          status: 'pending',
          refunded_by: 'test@merchant.com',
          expected_at: '2023-01-08T10:00:00Z',
          currency: 'NGN',
          domain: 'live',
          amount: 50000,
          fully_deducted: false,
          id: 1234,
          createdAt: '2023-01-01T10:00:00Z',
          updatedAt: '2023-01-01T10:00:00Z',
        },
      };

      mockPaystack.refund.create.mockResolvedValue(mockRefundResponse);

      const response = await request(app)
        .post('/api/payments/paystack/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transaction_reference: 'test_reference_123',
          amount: 50000,
          merchant_note: 'Refund requested by customer',
          customer_note: 'Product was defective',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        refund: {
          id: 1234,
          status: 'pending',
          amount: 500, // Converted back
          reference: 'test_reference_123',
        },
      });
    });

    it('should handle refund errors', async () => {
      const mockRefundResponse = {
        status: false,
        message: 'Transaction has already been fully refunded',
      };

      mockPaystack.refund.create.mockResolvedValue(mockRefundResponse);

      const response = await request(app)
        .post('/api/payments/paystack/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          transaction_reference: 'already_refunded_123',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Transaction has already been fully refunded',
        },
      });
    });
  });

  describe('Transaction Listing', () => {
    it('should list transactions with pagination', async () => {
      const mockTransactionsResponse = {
        status: true,
        message: 'Transactions retrieved',
        data: [
          {
            id: 302961,
            reference: 'test_ref_1',
            amount: 50000,
            status: 'success',
            currency: 'NGN',
            created_at: '2023-01-01T10:00:00Z',
          },
          {
            id: 302962,
            reference: 'test_ref_2',
            amount: 25000,
            status: 'success',
            currency: 'NGN',
            created_at: '2023-01-02T10:00:00Z',
          },
        ],
        meta: {
          total: 50,
          skipped: 0,
          perPage: 50,
          page: 1,
          pageCount: 1,
        },
      };

      mockPaystack.transaction.list.mockResolvedValue(mockTransactionsResponse);

      const response = await request(app)
        .get('/api/payments/paystack/transactions')
        .set('Authorization', `Bearer ${authToken}`)
        .query({
          page: 1,
          perPage: 10,
          status: 'success',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        transactions: expect.any(Array),
        meta: mockTransactionsResponse.meta,
      });

      expect(mockPaystack.transaction.list).toHaveBeenCalledWith({
        page: 1,
        perPage: 10,
        status: 'success',
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle network connectivity issues', async () => {
      const networkError = new Error('Network Error');
      networkError.code = 'ENOTFOUND';

      mockPaystack.transaction.initialize.mockRejectedValue(networkError);

      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50000,
          currency: 'NGN',
          email: testUser.email,
        });

      expect(response.status).toBe(503);
      expect(response.body.error.message).toContain('service unavailable');
    });

    it('should handle authentication errors', async () => {
      const authError = {
        status: false,
        message: 'Invalid key',
      };

      mockPaystack.transaction.initialize.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50000,
          currency: 'NGN',
          email: testUser.email,
        });

      expect(response.status).toBe(500);
      expect(response.body.error.message).toBe('Payment processing unavailable');
    });

    it('should handle rate limiting', async () => {
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.status = 429;

      mockPaystack.transaction.initialize.mockRejectedValue(rateLimitError);

      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50000,
          currency: 'NGN',
          email: testUser.email,
        });

      expect(response.status).toBe(429);
      expect(response.body.error.message).toContain('rate limit');
    });
  });

  describe('Currency Support', () => {
    it('should support multiple currencies', async () => {
      const currencies = ['NGN', 'USD', 'GHS'];
      
      for (const currency of currencies) {
        const mockResponse = {
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/test',
            reference: `test_${currency}_123`,
          },
        };

        mockPaystack.transaction.initialize.mockResolvedValue(mockResponse);

        const response = await request(app)
          .post('/api/payments/paystack/initialize')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 50000,
            currency,
            email: testUser.email,
          });

        expect(response.status).toBe(200);
        expect(mockPaystack.transaction.initialize).toHaveBeenCalledWith(
          expect.objectContaining({
            currency,
          })
        );
      }
    });

    it('should reject unsupported currencies', async () => {
      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 50000,
          currency: 'JPY', // Not supported by Paystack
          email: testUser.email,
        });

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('not supported');
    });
  });
});