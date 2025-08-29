import { jest } from '@jest/globals';
import Payment from '../../src/models/Payment.js';
import StripeService from '../../src/services/stripeService.js';
import PaystackService from '../../src/services/paystackService.js';

// Mock database
jest.mock('../../src/database/database.js', () => ({
  run: jest.fn(),
  get: jest.fn(),
  all: jest.fn()
}));

// Mock logger
jest.mock('../../src/utils/logger.js', () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn()
}));

describe('Payment Model', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Payment.create', () => {
    it('should create a new payment with valid data', async () => {
      const paymentData = {
        user_id: 'user-123',
        consultation_id: 'consultation-123',
        provider: 'stripe',
        amount: 5000,
        currency: 'USD',
        customer_email: 'test@example.com'
      };

      // Mock database run method
      const mockDb = require('../../src/database/database.js');
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ lastID: 1 }, null);
      });

      const payment = await Payment.create(paymentData);

      expect(payment).toBeInstanceOf(Payment);
      expect(payment.user_id).toBe(paymentData.user_id);
      expect(payment.amount).toBe(paymentData.amount);
      expect(payment.status).toBe('pending');
    });

    it('should handle database errors gracefully', async () => {
      const paymentData = {
        user_id: 'user-123',
        consultation_id: 'consultation-123',
        provider: 'stripe',
        amount: 5000
      };

      const mockDb = require('../../src/database/database.js');
      mockDb.run.mockImplementation((query, params, callback) => {
        callback(new Error('Database error'));
      });

      await expect(Payment.create(paymentData)).rejects.toThrow('Database error');
    });
  });

  describe('Payment.findById', () => {
    it('should find payment by ID', async () => {
      const paymentId = 'payment-123';
      const mockPaymentData = {
        id: paymentId,
        user_id: 'user-123',
        amount: 5000,
        status: 'succeeded'
      };

      const mockDb = require('../../src/database/database.js');
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, mockPaymentData);
      });

      const payment = await Payment.findById(paymentId);

      expect(payment).toBeInstanceOf(Payment);
      expect(payment.id).toBe(paymentId);
      expect(payment.status).toBe('succeeded');
    });

    it('should return null for non-existent payment', async () => {
      const mockDb = require('../../src/database/database.js');
      mockDb.get.mockImplementation((query, params, callback) => {
        callback(null, null);
      });

      const payment = await Payment.findById('non-existent');
      expect(payment).toBeNull();
    });
  });

  describe('updateStatus', () => {
    it('should update payment status', async () => {
      const payment = new Payment({
        id: 'payment-123',
        user_id: 'user-123',
        amount: 5000,
        status: 'pending'
      });

      const mockDb = require('../../src/database/database.js');
      mockDb.run.mockImplementation((query, params, callback) => {
        callback.call({ changes: 1 }, null);
      });

      await payment.updateStatus('succeeded');

      expect(mockDb.run).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE payments SET status = ?'),
        expect.arrayContaining(['succeeded', 'payment-123']),
        expect.any(Function)
      );
    });
  });
});

describe('StripeService', () => {
  // Mock Stripe
  const mockStripe = {
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
  };

  beforeEach(() => {
    // Mock Stripe constructor
    jest.doMock('stripe', () => {
      return jest.fn(() => mockStripe);
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    jest.restoreAllMocks();
  });

  describe('createPaymentIntent', () => {
    it('should create payment intent with valid data', async () => {
      const paymentData = {
        amount: 5000,
        currency: 'USD',
        user_id: 'user-123',
        consultation_id: 'consultation-123',
        customer_email: 'test@example.com'
      };

      const mockPaymentIntent = {
        id: 'pi_test123',
        client_secret: 'pi_test123_secret_test',
        status: 'requires_payment_method'
      };

      mockStripe.paymentIntents.create.mockResolvedValue(mockPaymentIntent);

      // Mock Payment.create
      jest.spyOn(Payment, 'create').mockResolvedValue(new Payment({
        id: 'payment-123',
        provider_payment_id: 'pi_test123',
        status: 'pending'
      }));

      const result = await StripeService.createPaymentIntent(paymentData);

      expect(result.client_secret).toBe(mockPaymentIntent.client_secret);
      expect(result.payment_intent_id).toBe(mockPaymentIntent.id);
      expect(mockStripe.paymentIntents.create).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 5000,
          currency: 'usd',
          metadata: expect.objectContaining({
            user_id: 'user-123'
          })
        })
      );
    });

    it('should handle Stripe errors', async () => {
      const paymentData = {
        amount: 5000,
        currency: 'USD',
        user_id: 'user-123',
        consultation_id: 'consultation-123',
        customer_email: 'test@example.com'
      };

      mockStripe.paymentIntents.create.mockRejectedValue(
        new Error('Your card was declined.')
      );

      await expect(StripeService.createPaymentIntent(paymentData))
        .rejects.toThrow('Payment creation failed');
    });
  });
});

describe('PaystackService', () => {
  // Mock axios
  const mockAxios = {
    post: jest.fn(),
    get: jest.fn()
  };

  beforeEach(() => {
    jest.doMock('axios', () => mockAxios);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initializePayment', () => {
    it('should initialize payment with valid data', async () => {
      const paymentData = {
        amount: 500000, // 5000 NGN in kobo
        currency: 'NGN',
        user_id: 'user-123',
        consultation_id: 'consultation-123',
        customer_email: 'test@example.com'
      };

      const mockResponse = {
        data: {
          status: true,
          data: {
            authorization_url: 'https://checkout.paystack.com/test123',
            access_code: 'test_access_code',
            reference: 'test_reference_123'
          }
        }
      };

      mockAxios.post.mockResolvedValue(mockResponse);

      // Mock Payment.create
      jest.spyOn(Payment, 'create').mockResolvedValue(new Payment({
        id: 'payment-123',
        provider_payment_id: 'test_reference_123',
        status: 'pending'
      }));

      const result = await PaystackService.initializePayment(paymentData);

      expect(result.authorization_url).toBe(mockResponse.data.data.authorization_url);
      expect(result.reference).toBe(mockResponse.data.data.reference);
      expect(mockAxios.post).toHaveBeenCalledWith(
        expect.stringContaining('/transaction/initialize'),
        expect.objectContaining({
          email: 'test@example.com',
          amount: 500000
        }),
        expect.any(Object)
      );
    });

    it('should handle Paystack errors', async () => {
      const paymentData = {
        amount: 500000,
        currency: 'NGN',
        user_id: 'user-123',
        consultation_id: 'consultation-123',
        customer_email: 'invalid-email'
      };

      mockAxios.post.mockRejectedValue({
        response: {
          data: {
            status: false,
            message: 'Invalid email address'
          }
        }
      });

      await expect(PaystackService.initializePayment(paymentData))
        .rejects.toThrow('Payment initialization failed');
    });
  });

  describe('verifyPayment', () => {
    it('should verify successful payment', async () => {
      const reference = 'test_reference_123';
      
      const mockResponse = {
        data: {
          status: true,
          data: {
            id: 123456789,
            status: 'success',
            reference: reference,
            amount: 500000,
            gateway_response: 'Successful',
            paid_at: '2023-01-01T10:00:00.000Z',
            customer: {
              id: 123,
              email: 'test@example.com'
            }
          }
        }
      };

      mockAxios.get.mockResolvedValue(mockResponse);

      // Mock Payment.findByProviderPaymentId
      const mockPayment = new Payment({
        id: 'payment-123',
        provider_payment_id: reference,
        status: 'pending'
      });

      jest.spyOn(Payment, 'findByProviderPaymentId').mockResolvedValue(mockPayment);
      jest.spyOn(mockPayment, 'updateStatus').mockResolvedValue(mockPayment);

      const result = await PaystackService.verifyPayment(reference);

      expect(result.transaction_data.status).toBe('success');
      expect(mockAxios.get).toHaveBeenCalledWith(
        expect.stringContaining(`/transaction/verify/${reference}`),
        expect.any(Object)
      );
    });
  });
});