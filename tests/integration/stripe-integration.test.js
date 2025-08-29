/**
 * Integration Tests for Stripe API
 * Tests actual API interactions with mocked responses
 */

const request = require('supertest');
const app = require('../../src/app');
const {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  generateTestToken,
  mockRequest,
  mockResponse,
} = require('../utils/test-setup');

// Mock Stripe SDK but test real API interactions
const mockStripe = {
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
  },
  webhooks: {
    constructEvent: jest.fn(),
  },
  refunds: {
    create: jest.fn(),
  },
  paymentMethods: {
    attach: jest.fn(),
    detach: jest.fn(),
    list: jest.fn(),
  },
};

jest.mock('stripe', () => jest.fn(() => mockStripe));

describe('Stripe Integration', () => {
  let server;
  let testUser;
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    server = app.listen(0); // Use random available port
  });

  afterAll(async () => {
    await teardownTestDatabase();
    if (server) {
      server.close();
    }
  });

  beforeEach(async () => {
    testUser = createTestUser();
    authToken = generateTestToken({ userId: testUser._id });
    jest.clearAllMocks();
  });

  describe('Payment Intent Creation', () => {
    it('should create payment intent via API', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_payment_intent',
        client_secret: 'pi_test_payment_intent_secret_test',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
        metadata: {
          userId: testUser._id,
          orderId: 'order_123',
        },
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'usd',
          description: 'Test payment',
          metadata: {
            orderId: 'order_123',
          },
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        paymentIntent: {
          id: 'pi_test_payment_intent',
          clientSecret: 'pi_test_payment_intent_secret_test',
          status: 'requires_payment_method',
        },
      });

      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        description: 'Test payment',
        metadata: expect.objectContaining({
          userId: testUser._id,
          orderId: 'order_123',
        }),
        automatic_payment_methods: { enabled: true },
      });
    });

    it('should handle Stripe API errors gracefully', async () => {
      const stripeError = new Error('Your card was declined.');
      stripeError.type = 'StripeCardError';
      stripeError.code = 'card_declined';
      stripeError.statusCode = 402;

      mockStripe.paymentIntents.create.mockRejectedValue(stripeError);

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response.status).toBe(402);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          type: 'card_error',
          message: 'Your card was declined.',
          code: 'card_declined',
        },
      });
    });

    it('should validate minimum amounts for different currencies', async () => {
      const testCases = [
        { currency: 'usd', amount: 25, shouldFail: true }, // Below $0.50 minimum
        { currency: 'usd', amount: 50, shouldFail: false },
        { currency: 'eur', amount: 25, shouldFail: true }, // Below €0.50 minimum
        { currency: 'gbp', amount: 25, shouldFail: true }, // Below £0.30 minimum
        { currency: 'jpy', amount: 25, shouldFail: true }, // Below ¥50 minimum
      ];

      for (const testCase of testCases) {
        const response = await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: testCase.amount,
            currency: testCase.currency,
          });

        if (testCase.shouldFail) {
          expect(response.status).toBe(400);
          expect(response.body.error.message).toContain('minimum amount');
        } else {
          expect(response.status).toBe(200);
        }
      }
    });
  });

  describe('Payment Confirmation', () => {
    it('should confirm payment intent', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_payment_intent',
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
        charges: {
          data: [{
            id: 'ch_test_charge',
            receipt_url: 'https://pay.stripe.com/receipts/test',
            billing_details: {
              email: testUser.email,
            },
            payment_method_details: {
              card: {
                brand: 'visa',
                last4: '4242',
              },
            },
          }],
        },
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/api/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test_payment_intent',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        payment: {
          id: 'pi_test_payment_intent',
          status: 'succeeded',
          amount: 5000,
          currency: 'usd',
        },
      });

      expect(mockStripe.paymentIntents.retrieve).toHaveBeenCalledWith(
        'pi_test_payment_intent'
      );
    });

    it('should handle failed payment confirmations', async () => {
      const mockPaymentIntent = {
        id: 'pi_test_payment_intent',
        status: 'requires_payment_method',
        last_payment_error: {
          message: 'Your card was declined.',
          code: 'card_declined',
        },
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const response = await request(app)
        .post('/api/payments/confirm')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test_payment_intent',
        });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        error: {
          message: 'Your card was declined.',
          code: 'card_declined',
        },
      });
    });
  });

  describe('Customer Management', () => {
    it('should create Stripe customer', async () => {
      const mockCustomer = {
        id: 'cus_test_customer',
        email: testUser.email,
        name: testUser.name,
        created: Math.floor(Date.now() / 1000),
      };

      mockStripe.customers.create.mockResolvedValue(mockCustomer);

      const response = await request(app)
        .post('/api/customers/stripe')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: testUser.email,
          name: testUser.name,
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        customer: {
          id: 'cus_test_customer',
          email: testUser.email,
        },
      });

      expect(mockStripe.customers.create).toHaveBeenCalledWith({
        email: testUser.email,
        name: testUser.name,
        metadata: {
          userId: testUser._id,
        },
      });
    });

    it('should retrieve existing customer', async () => {
      const mockCustomer = {
        id: 'cus_test_customer',
        email: testUser.email,
        name: testUser.name,
      };

      mockStripe.customers.retrieve.mockResolvedValue(mockCustomer);

      const response = await request(app)
        .get('/api/customers/stripe/cus_test_customer')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        customer: mockCustomer,
      });
    });

    it('should handle customer not found', async () => {
      const stripeError = new Error('No such customer');
      stripeError.type = 'StripeInvalidRequestError';
      stripeError.statusCode = 404;

      mockStripe.customers.retrieve.mockRejectedValue(stripeError);

      const response = await request(app)
        .get('/api/customers/stripe/cus_nonexistent')
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

  describe('Refunds', () => {
    it('should process full refund', async () => {
      const mockRefund = {
        id: 'ref_test_refund',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        charge: 'ch_test_charge',
      };

      const mockPaymentIntent = {
        id: 'pi_test_payment_intent',
        amount: 5000,
        charges: {
          data: [{ id: 'ch_test_charge' }],
        },
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);
      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const response = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test_payment_intent',
          reason: 'requested_by_customer',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        refund: {
          id: 'ref_test_refund',
          amount: 5000,
          status: 'succeeded',
        },
      });

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        charge: 'ch_test_charge',
        reason: 'requested_by_customer',
      });
    });

    it('should process partial refund', async () => {
      const refundAmount = 2500;
      const mockRefund = {
        id: 'ref_test_partial',
        amount: refundAmount,
        currency: 'usd',
        status: 'succeeded',
      };

      mockStripe.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_test_payment_intent',
        amount: 5000,
        charges: { data: [{ id: 'ch_test_charge' }] },
      });
      mockStripe.refunds.create.mockResolvedValue(mockRefund);

      const response = await request(app)
        .post('/api/payments/refund')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentIntentId: 'pi_test_payment_intent',
          amount: refundAmount,
          reason: 'requested_by_customer',
        });

      expect(response.status).toBe(200);
      expect(response.body.refund.amount).toBe(refundAmount);

      expect(mockStripe.refunds.create).toHaveBeenCalledWith({
        charge: 'ch_test_charge',
        amount: refundAmount,
        reason: 'requested_by_customer',
      });
    });
  });

  describe('Payment Methods', () => {
    it('should attach payment method to customer', async () => {
      const mockPaymentMethod = {
        id: 'pm_test_payment_method',
        type: 'card',
        card: {
          brand: 'visa',
          last4: '4242',
        },
        customer: 'cus_test_customer',
      };

      mockStripe.paymentMethods.attach.mockResolvedValue(mockPaymentMethod);

      const response = await request(app)
        .post('/api/payment-methods/attach')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          paymentMethodId: 'pm_test_payment_method',
          customerId: 'cus_test_customer',
        });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        success: true,
        paymentMethod: mockPaymentMethod,
      });
    });

    it('should list customer payment methods', async () => {
      const mockPaymentMethods = {
        data: [
          {
            id: 'pm_test_1',
            type: 'card',
            card: { brand: 'visa', last4: '4242' },
          },
          {
            id: 'pm_test_2',
            type: 'card',
            card: { brand: 'mastercard', last4: '4444' },
          },
        ],
      };

      mockStripe.paymentMethods.list.mockResolvedValue(mockPaymentMethods);

      const response = await request(app)
        .get('/api/payment-methods')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ customerId: 'cus_test_customer' });

      expect(response.status).toBe(200);
      expect(response.body.paymentMethods).toHaveLength(2);
    });
  });

  describe('Error Scenarios', () => {
    it('should handle API rate limiting', async () => {
      const rateLimitError = new Error('Too Many Requests');
      rateLimitError.type = 'StripeRateLimitError';
      rateLimitError.statusCode = 429;

      mockStripe.paymentIntents.create.mockRejectedValue(rateLimitError);

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response.status).toBe(429);
      expect(response.body.error.message).toContain('rate limit');
    });

    it('should handle API connection errors', async () => {
      const connectionError = new Error('Connection timeout');
      connectionError.code = 'ECONNREFUSED';

      mockStripe.paymentIntents.create.mockRejectedValue(connectionError);

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response.status).toBe(503);
      expect(response.body.error.message).toContain('service unavailable');
    });

    it('should handle invalid API key errors', async () => {
      const authError = new Error('Invalid API Key');
      authError.type = 'StripeAuthenticationError';
      authError.statusCode = 401;

      mockStripe.paymentIntents.create.mockRejectedValue(authError);

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response.status).toBe(500); // Should be handled as internal error
      expect(response.body.error.message).toBe('Payment processing unavailable');
    });
  });

  describe('Idempotency', () => {
    it('should handle duplicate payment creation requests', async () => {
      const idempotencyKey = 'idem_test_key_123';
      const mockPaymentIntent = {
        id: 'pi_test_payment_intent',
        client_secret: 'pi_test_payment_intent_secret',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // First request
      const response1 = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          amount: 5000,
          currency: 'usd',
        });

      // Second request with same idempotency key
      const response2 = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .set('Idempotency-Key', idempotencyKey)
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response1.body.paymentIntent.id).toBe(response2.body.paymentIntent.id);

      // Stripe should only be called once due to idempotency
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledTimes(2);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
        }),
        { idempotencyKey }
      );
    });
  });
});