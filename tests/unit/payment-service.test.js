/**
 * Unit Tests for Payment Service Core Logic
 * Tests business logic, validation, and internal methods
 */

const PaymentService = require('../../src/services/paymentService');
const {
  createTestUser,
  createTestPayment,
  createStripeMocks,
  createPaystackMocks,
  createStripeError,
  createPaystackError,
  setupTestDatabase,
  teardownTestDatabase,
} = require('../utils/test-setup');

// Mock external dependencies
jest.mock('stripe');
jest.mock('paystack-node');

describe('PaymentService', () => {
  let paymentService;
  let stripeMocks;
  let paystackMocks;

  beforeAll(async () => {
    await setupTestDatabase();
  });

  afterAll(async () => {
    await teardownTestDatabase();
  });

  beforeEach(() => {
    stripeMocks = createStripeMocks();
    paystackMocks = createPaystackMocks();
    
    // Mock the Stripe constructor
    require('stripe').mockImplementation(() => stripeMocks);
    
    // Mock the Paystack constructor
    require('paystack-node').mockImplementation(() => paystackMocks);
    
    paymentService = new PaymentService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment Intent Creation', () => {
    it('should create a payment intent with Stripe', async () => {
      const paymentData = {
        amount: 5000,
        currency: 'usd',
        userId: '507f1f77bcf86cd799439011',
        description: 'Test payment',
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
      };

      stripeMocks.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.createPaymentIntent(paymentData, 'stripe');

      expect(stripeMocks.paymentIntents.create).toHaveBeenCalledWith({
        amount: 5000,
        currency: 'usd',
        description: 'Test payment',
        metadata: expect.objectContaining({
          userId: '507f1f77bcf86cd799439011',
        }),
        automatic_payment_methods: { enabled: true },
      });

      expect(result).toMatchObject({
        paymentIntentId: 'pi_test123',
        clientSecret: 'pi_test123_secret',
        status: 'requires_payment_method',
        provider: 'stripe',
      });
    });

    it('should create a payment with Paystack', async () => {
      const paymentData = {
        amount: 5000,
        currency: 'ngn',
        userId: '507f1f77bcf86cd799439011',
        email: 'test@example.com',
        description: 'Test payment',
      };

      const mockPaystackResponse = {
        status: true,
        data: {
          reference: 'ref_test123',
          authorization_url: 'https://checkout.paystack.com/test123',
          access_code: 'access_test123',
        },
      };

      paystackMocks.transaction.initialize.mockResolvedValue(mockPaystackResponse);

      const result = await paymentService.createPaymentIntent(paymentData, 'paystack');

      expect(paystackMocks.transaction.initialize).toHaveBeenCalledWith({
        email: 'test@example.com',
        amount: 500000, // Paystack uses kobo (NGN cents)
        currency: 'NGN',
        reference: expect.any(String),
        callback_url: expect.any(String),
        metadata: expect.objectContaining({
          userId: '507f1f77bcf86cd799439011',
        }),
      });

      expect(result).toMatchObject({
        reference: 'ref_test123',
        authorizationUrl: 'https://checkout.paystack.com/test123',
        provider: 'paystack',
      });
    });

    it('should validate payment amount is positive', async () => {
      const paymentData = {
        amount: -100,
        currency: 'usd',
        userId: '507f1f77bcf86cd799439011',
      };

      await expect(paymentService.createPaymentIntent(paymentData, 'stripe'))
        .rejects.toThrow('Payment amount must be positive');
    });

    it('should validate currency is supported', async () => {
      const paymentData = {
        amount: 5000,
        currency: 'xyz',
        userId: '507f1f77bcf86cd799439011',
      };

      await expect(paymentService.createPaymentIntent(paymentData, 'stripe'))
        .rejects.toThrow('Unsupported currency: xyz');
    });

    it('should validate minimum payment amounts', async () => {
      const paymentData = {
        amount: 10, // Below $0.50 minimum for Stripe
        currency: 'usd',
        userId: '507f1f77bcf86cd799439011',
      };

      await expect(paymentService.createPaymentIntent(paymentData, 'stripe'))
        .rejects.toThrow('Payment amount below minimum');
    });
  });

  describe('Payment Confirmation', () => {
    it('should confirm Stripe payment intent', async () => {
      const paymentIntentId = 'pi_test123';
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
        charges: {
          data: [
            {
              id: 'ch_test123',
              billing_details: { email: 'test@example.com' },
              payment_method_details: { card: { brand: 'visa', last4: '4242' } },
            },
          ],
        },
      };

      stripeMocks.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.confirmPayment(paymentIntentId, 'stripe');

      expect(stripeMocks.paymentIntents.retrieve).toHaveBeenCalledWith(paymentIntentId);
      expect(result).toMatchObject({
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
        provider: 'stripe',
      });
    });

    it('should verify Paystack transaction', async () => {
      const reference = 'ref_test123';
      const mockVerifyResponse = {
        status: true,
        data: {
          id: 12345,
          reference: 'ref_test123',
          amount: 500000,
          currency: 'NGN',
          status: 'success',
          customer: { email: 'test@example.com' },
        },
      };

      paystackMocks.transaction.verify.mockResolvedValue(mockVerifyResponse);

      const result = await paymentService.confirmPayment(reference, 'paystack');

      expect(paystackMocks.transaction.verify).toHaveBeenCalledWith(reference);
      expect(result).toMatchObject({
        status: 'success',
        amount: 5000,
        currency: 'ngn',
        provider: 'paystack',
      });
    });

    it('should handle failed payment confirmation', async () => {
      const paymentIntentId = 'pi_test123';
      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'payment_failed',
        last_payment_error: { message: 'Your card was declined.' },
      };

      stripeMocks.paymentIntents.retrieve.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.confirmPayment(paymentIntentId, 'stripe');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Your card was declined.');
    });
  });

  describe('Payment Processing', () => {
    it('should process payment end-to-end', async () => {
      const paymentData = {
        amount: 5000,
        currency: 'usd',
        userId: '507f1f77bcf86cd799439011',
        paymentMethod: 'pm_test123',
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        status: 'succeeded',
        amount: 5000,
        currency: 'usd',
      };

      stripeMocks.paymentIntents.create.mockResolvedValue(mockPaymentIntent);
      stripeMocks.paymentIntents.confirm.mockResolvedValue(mockPaymentIntent);

      const result = await paymentService.processPayment(paymentData, 'stripe');

      expect(stripeMocks.paymentIntents.create).toHaveBeenCalled();
      expect(stripeMocks.paymentIntents.confirm).toHaveBeenCalledWith(
        'pi_test123',
        { payment_method: 'pm_test123' }
      );
      expect(result.status).toBe('succeeded');
    });

    it('should handle processing errors gracefully', async () => {
      const paymentData = {
        amount: 5000,
        currency: 'usd',
        userId: '507f1f77bcf86cd799439011',
      };

      const stripeError = createStripeError(
        'card_declined',
        'Your card was declined.',
        402
      );

      stripeMocks.paymentIntents.create.mockRejectedValue(stripeError);

      await expect(paymentService.processPayment(paymentData, 'stripe'))
        .rejects.toThrow('Your card was declined.');
    });
  });

  describe('Refund Processing', () => {
    it('should process full refund with Stripe', async () => {
      const paymentIntentId = 'pi_test123';
      const mockRefund = {
        id: 'ref_test123',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        payment_intent: 'pi_test123',
      };

      stripeMocks.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_test123',
        charges: { data: [{ id: 'ch_test123' }] },
      });

      // Mock refunds.create method
      stripeMocks.refunds = { create: jest.fn().mockResolvedValue(mockRefund) };

      const result = await paymentService.processRefund(paymentIntentId, 'stripe');

      expect(result).toMatchObject({
        refundId: 'ref_test123',
        amount: 5000,
        status: 'succeeded',
        provider: 'stripe',
      });
    });

    it('should process partial refund', async () => {
      const paymentIntentId = 'pi_test123';
      const refundAmount = 2500;
      
      stripeMocks.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_test123',
        amount: 5000,
        charges: { data: [{ id: 'ch_test123' }] },
      });

      stripeMocks.refunds = {
        create: jest.fn().mockResolvedValue({
          id: 'ref_test123',
          amount: 2500,
          status: 'succeeded',
        }),
      };

      const result = await paymentService.processRefund(
        paymentIntentId,
        'stripe',
        refundAmount
      );

      expect(stripeMocks.refunds.create).toHaveBeenCalledWith({
        charge: 'ch_test123',
        amount: 2500,
        reason: 'requested_by_customer',
      });

      expect(result.amount).toBe(2500);
    });

    it('should validate refund amount does not exceed original payment', async () => {
      const paymentIntentId = 'pi_test123';
      const refundAmount = 10000; // More than original $50

      stripeMocks.paymentIntents.retrieve.mockResolvedValue({
        id: 'pi_test123',
        amount: 5000,
      });

      await expect(
        paymentService.processRefund(paymentIntentId, 'stripe', refundAmount)
      ).rejects.toThrow('Refund amount exceeds original payment');
    });
  });

  describe('Currency Conversion', () => {
    it('should convert amounts for Paystack (kobo)', () => {
      expect(paymentService.convertToProviderAmount(5000, 'ngn', 'paystack')).toBe(500000);
      expect(paymentService.convertToProviderAmount(1000, 'ghs', 'paystack')).toBe(1000);
    });

    it('should keep amounts for Stripe (cents)', () => {
      expect(paymentService.convertToProviderAmount(5000, 'usd', 'stripe')).toBe(5000);
      expect(paymentService.convertToProviderAmount(3000, 'eur', 'stripe')).toBe(3000);
    });

    it('should convert back from provider amounts', () => {
      expect(paymentService.convertFromProviderAmount(500000, 'ngn', 'paystack')).toBe(5000);
      expect(paymentService.convertFromProviderAmount(5000, 'usd', 'stripe')).toBe(5000);
    });
  });

  describe('Payment Validation', () => {
    it('should validate required payment fields', () => {
      const invalidPayment = { amount: 5000 }; // Missing currency and userId

      expect(() => paymentService.validatePaymentData(invalidPayment))
        .toThrow('Missing required fields');
    });

    it('should validate email for Paystack payments', () => {
      const paymentData = {
        amount: 5000,
        currency: 'ngn',
        userId: '507f1f77bcf86cd799439011',
        // Missing email for Paystack
      };

      expect(() => paymentService.validatePaymentData(paymentData, 'paystack'))
        .toThrow('Email is required for Paystack payments');
    });

    it('should validate supported currencies per provider', () => {
      const paymentData = {
        amount: 5000,
        currency: 'jpy',
        userId: '507f1f77bcf86cd799439011',
      };

      expect(() => paymentService.validatePaymentData(paymentData, 'paystack'))
        .toThrow('Currency jpy not supported by paystack');
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      const paymentData = createTestPayment();
      const networkError = new Error('Network error');
      networkError.code = 'ECONNREFUSED';

      stripeMocks.paymentIntents.create.mockRejectedValue(networkError);

      await expect(paymentService.createPaymentIntent(paymentData, 'stripe'))
        .rejects.toThrow('Payment service temporarily unavailable');
    });

    it('should handle rate limiting', async () => {
      const paymentData = createTestPayment();
      const rateLimitError = createStripeError('rate_limit', 'Too many requests', 429);

      stripeMocks.paymentIntents.create.mockRejectedValue(rateLimitError);

      await expect(paymentService.createPaymentIntent(paymentData, 'stripe'))
        .rejects.toThrow('Too many requests. Please try again later.');
    });

    it('should sanitize error messages for security', async () => {
      const paymentData = createTestPayment();
      const sensitiveError = new Error('Database connection failed: password123');

      stripeMocks.paymentIntents.create.mockRejectedValue(sensitiveError);

      try {
        await paymentService.createPaymentIntent(paymentData, 'stripe');
      } catch (error) {
        expect(error.message).not.toContain('password123');
        expect(error.message).toBe('Payment processing failed');
      }
    });
  });

  describe('Webhook Signature Validation', () => {
    it('should validate Stripe webhook signatures', () => {
      const payload = '{"id":"evt_test123","type":"payment_intent.succeeded"}';
      const signature = 'sha256=test_signature';
      const secret = 'whsec_test123';

      stripeMocks.webhooks.constructEvent.mockReturnValue({
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
      });

      const event = paymentService.validateStripeWebhook(payload, signature, secret);

      expect(stripeMocks.webhooks.constructEvent).toHaveBeenCalledWith(
        payload,
        signature,
        secret
      );
      expect(event.type).toBe('payment_intent.succeeded');
    });

    it('should validate Paystack webhook signatures', () => {
      const payload = '{"event":"charge.success","data":{}}';
      const signature = 'sha512=test_signature';
      const secret = 'sk_test123';

      const isValid = paymentService.validatePaystackWebhook(payload, signature, secret);

      expect(typeof isValid).toBe('boolean');
    });

    it('should reject invalid webhook signatures', () => {
      const payload = '{"id":"evt_test123"}';
      const invalidSignature = 'invalid_signature';
      const secret = 'whsec_test123';

      stripeMocks.webhooks.constructEvent.mockImplementation(() => {
        const error = new Error('Invalid signature');
        error.type = 'StripeSignatureVerificationError';
        throw error;
      });

      expect(() => 
        paymentService.validateStripeWebhook(payload, invalidSignature, secret)
      ).toThrow('Invalid webhook signature');
    });
  });
});