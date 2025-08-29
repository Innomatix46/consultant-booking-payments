import { jest } from '@jest/globals';
import request from 'supertest';
import app from '../../src/server.js';

// Mock database and external services
jest.mock('../../src/database/database.js');
jest.mock('../../src/services/stripeService.js');
jest.mock('../../src/services/paystackService.js');

describe('Payment API Integration Tests', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check Endpoints', () => {
    it('should return health status for main endpoint', async () => {
      const response = await request(app)
        .get('/health')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'OK',
        timestamp: expect.any(String),
        uptime: expect.any(Number)
      });
    });

    it('should return health status for payment service', async () => {
      const response = await request(app)
        .get('/api/payments/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment service is healthy',
        services: {
          stripe: expect.any(Boolean),
          paystack: expect.any(Boolean)
        }
      });
    });

    it('should return health status for webhook service', async () => {
      const response = await request(app)
        .get('/webhooks/health')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Webhook service is healthy',
        endpoints: {
          stripe: '/webhooks/stripe',
          paystack: '/webhooks/paystack'
        }
      });
    });
  });

  describe('POST /api/payments/stripe/payment-intent', () => {
    it('should create Stripe payment intent with valid data', async () => {
      const StripeService = require('../../src/services/stripeService.js').default;
      StripeService.createPaymentIntent = jest.fn().mockResolvedValue({
        payment: {
          id: 'payment-123'
        },
        client_secret: 'pi_test123_secret_test',
        payment_intent_id: 'pi_test123'
      });

      const paymentData = {
        amount: 5000,
        currency: 'USD',
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        consultation_id: '123e4567-e89b-12d3-a456-426614174001',
        customer_email: 'test@example.com',
        customer_name: 'Test User'
      };

      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send(paymentData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment intent created successfully',
        data: {
          payment_id: 'payment-123',
          client_secret: 'pi_test123_secret_test',
          payment_intent_id: 'pi_test123'
        }
      });
    });

    it('should validate required fields', async () => {
      const invalidData = {
        amount: -100, // Invalid amount
        currency: 'INVALID', // Invalid currency
        user_id: 'invalid-uuid', // Invalid UUID
        customer_email: 'invalid-email' // Invalid email
      };

      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send(invalidData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Validation errors',
        errors: expect.any(Array)
      });
    });

    it('should handle service errors', async () => {
      const StripeService = require('../../src/services/stripeService.js').default;
      StripeService.createPaymentIntent = jest.fn().mockRejectedValue(
        new Error('Stripe service unavailable')
      );

      const paymentData = {
        amount: 5000,
        currency: 'USD',
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        consultation_id: '123e4567-e89b-12d3-a456-426614174001',
        customer_email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .send(paymentData)
        .expect(500);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.any(String)
      });
    });
  });

  describe('POST /api/payments/stripe/checkout-session', () => {
    it('should create Stripe checkout session with valid data', async () => {
      const StripeService = require('../../src/services/stripeService.js').default;
      StripeService.createCheckoutSession = jest.fn().mockResolvedValue({
        payment: {
          id: 'payment-123'
        },
        session_id: 'cs_test123',
        checkout_url: 'https://checkout.stripe.com/pay/cs_test123'
      });

      const paymentData = {
        price_id: 'price_test123',
        amount: 5000,
        currency: 'USD',
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        consultation_id: '123e4567-e89b-12d3-a456-426614174001',
        customer_email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/payments/stripe/checkout-session')
        .send(paymentData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Checkout session created successfully',
        data: {
          payment_id: 'payment-123',
          session_id: 'cs_test123',
          checkout_url: 'https://checkout.stripe.com/pay/cs_test123'
        }
      });
    });
  });

  describe('POST /api/payments/paystack/initialize', () => {
    it('should initialize Paystack payment with valid data', async () => {
      const PaystackService = require('../../src/services/paystackService.js').default;
      PaystackService.initializePayment = jest.fn().mockResolvedValue({
        payment: {
          id: 'payment-123'
        },
        authorization_url: 'https://checkout.paystack.com/test123',
        access_code: 'test_access_code',
        reference: 'test_reference_123'
      });

      const paymentData = {
        amount: 500000, // 5000 NGN in kobo
        currency: 'NGN',
        user_id: '123e4567-e89b-12d3-a456-426614174000',
        consultation_id: '123e4567-e89b-12d3-a456-426614174001',
        customer_email: 'test@example.com'
      };

      const response = await request(app)
        .post('/api/payments/paystack/initialize')
        .send(paymentData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment initialized successfully',
        data: {
          payment_id: 'payment-123',
          authorization_url: 'https://checkout.paystack.com/test123',
          reference: 'test_reference_123'
        }
      });
    });
  });

  describe('GET /api/payments/paystack/verify/:reference', () => {
    it('should verify Paystack payment with valid reference', async () => {
      const PaystackService = require('../../src/services/paystackService.js').default;
      PaystackService.verifyPayment = jest.fn().mockResolvedValue({
        payment: {
          id: 'payment-123',
          status: 'succeeded',
          toJSON: () => ({
            id: 'payment-123',
            status: 'succeeded'
          })
        },
        transaction_data: {
          status: 'success',
          amount: 500000
        }
      });

      const response = await request(app)
        .get('/api/payments/paystack/verify/test_reference_123')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment verified successfully',
        data: {
          payment: expect.objectContaining({
            id: 'payment-123',
            status: 'succeeded'
          }),
          transaction_data: expect.objectContaining({
            status: 'success'
          })
        }
      });
    });

    it('should handle non-existent payment reference', async () => {
      const PaystackService = require('../../src/services/paystackService.js').default;
      PaystackService.verifyPayment = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/payments/paystack/verify/non_existent_reference')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Payment not found'
      });
    });
  });

  describe('GET /api/payments/status/:paymentId', () => {
    it('should get payment status with valid ID', async () => {
      const Payment = require('../../src/models/Payment.js').default;
      Payment.findById = jest.fn().mockResolvedValue({
        id: 'payment-123',
        status: 'succeeded',
        toJSON: () => ({
          id: 'payment-123',
          status: 'succeeded',
          amount: 5000
        })
      });

      const response = await request(app)
        .get('/api/payments/status/payment-123')
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Payment status retrieved successfully',
        data: {
          payment: expect.objectContaining({
            id: 'payment-123',
            status: 'succeeded'
          })
        }
      });
    });

    it('should handle non-existent payment ID', async () => {
      const Payment = require('../../src/models/Payment.js').default;
      Payment.findById = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .get('/api/payments/status/non-existent-payment')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Payment not found'
      });
    });
  });

  describe('POST /webhooks/stripe', () => {
    it('should process Stripe webhook with valid signature', async () => {
      const StripeService = require('../../src/services/stripeService.js').default;
      StripeService.handleWebhookEvent = jest.fn().mockResolvedValue({
        received: true
      });

      const webhookPayload = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test123',
            status: 'succeeded'
          }
        }
      };

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'v1=test_signature')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        received: true
      });
    });

    it('should handle webhook signature verification failure', async () => {
      const StripeService = require('../../src/services/stripeService.js').default;
      StripeService.handleWebhookEvent = jest.fn().mockRejectedValue(
        new Error('Webhook signature verification failed')
      );

      const webhookPayload = {
        id: 'evt_test123',
        type: 'payment_intent.succeeded'
      };

      const response = await request(app)
        .post('/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(webhookPayload)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Webhook signature verification failed'
      });
    });
  });

  describe('POST /webhooks/paystack', () => {
    it('should process Paystack webhook with valid signature', async () => {
      const PaystackService = require('../../src/services/paystackService.js').default;
      PaystackService.handleWebhookEvent = jest.fn().mockResolvedValue({
        received: true
      });

      const webhookPayload = {
        event: 'charge.success',
        data: {
          id: 123456789,
          reference: 'test_reference_123',
          status: 'success'
        }
      };

      const response = await request(app)
        .post('/webhooks/paystack')
        .set('x-paystack-signature', 'valid_signature_hash')
        .send(webhookPayload)
        .expect(200);

      expect(response.body).toMatchObject({
        received: true
      });
    });
  });

  describe('Rate Limiting', () => {
    it('should enforce rate limiting on payment endpoints', async () => {
      // Mock multiple requests in quick succession
      const requests = Array.from({ length: 12 }, () => 
        request(app)
          .post('/api/payments/stripe/payment-intent')
          .send({
            amount: 5000,
            currency: 'USD',
            user_id: '123e4567-e89b-12d3-a456-426614174000',
            consultation_id: '123e4567-e89b-12d3-a456-426614174001',
            customer_email: 'test@example.com'
          })
      );

      const responses = await Promise.all(requests);

      // Should have some 429 (Too Many Requests) responses
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for non-existent routes', async () => {
      const response = await request(app)
        .get('/api/non-existent-endpoint')
        .expect(404);

      expect(response.body).toMatchObject({
        success: false,
        message: 'Route not found'
      });
    });

    it('should handle malformed JSON in request body', async () => {
      const response = await request(app)
        .post('/api/payments/stripe/payment-intent')
        .set('Content-Type', 'application/json')
        .send('{"invalid": json}')
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('JSON')
      });
    });
  });
});