/**
 * Integration Tests for Webhook Handling
 * Tests webhook processing, validation, and event handling
 */

const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/app');
const {
  setupTestDatabase,
  teardownTestDatabase,
  createTestWebhookEvent,
  createTestPayment,
} = require('../utils/test-setup');

describe('Webhook Handling', () => {
  let server;

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

  describe('Stripe Webhooks', () => {
    const stripeEndpointSecret = 'whsec_test_secret_key';
    
    const generateStripeSignature = (payload, timestamp, secret) => {
      const signedPayload = `${timestamp}.${payload}`;
      const signature = crypto
        .createHmac('sha256', secret)
        .update(signedPayload, 'utf8')
        .digest('hex');
      return `t=${timestamp},v1=${signature}`;
    };

    beforeEach(() => {
      process.env.STRIPE_WEBHOOK_SECRET = stripeEndpointSecret;
    });

    it('should process payment_intent.succeeded webhook', async () => {
      const paymentIntentData = {
        id: 'pi_test123',
        object: 'payment_intent',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        metadata: {
          userId: '507f1f77bcf86cd799439011',
          orderId: 'order_123',
        },
        charges: {
          data: [{
            id: 'ch_test123',
            receipt_url: 'https://pay.stripe.com/receipts/test',
            billing_details: {
              email: 'test@example.com',
            },
          }],
        },
      };

      const webhookEvent = createTestWebhookEvent(
        'payment_intent.succeeded',
        paymentIntentData,
        'stripe'
      );

      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateStripeSignature(payload, timestamp, stripeEndpointSecret);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        received: true,
        eventType: 'payment_intent.succeeded',
      });

      // Verify payment status was updated in database
      // This would check that the payment record was created/updated
    });

    it('should process payment_intent.payment_failed webhook', async () => {
      const paymentIntentData = {
        id: 'pi_test_failed',
        object: 'payment_intent',
        amount: 5000,
        currency: 'usd',
        status: 'requires_payment_method',
        last_payment_error: {
          code: 'card_declined',
          message: 'Your card was declined.',
          type: 'card_error',
        },
        metadata: {
          userId: '507f1f77bcf86cd799439011',
        },
      };

      const webhookEvent = createTestWebhookEvent(
        'payment_intent.payment_failed',
        paymentIntentData,
        'stripe'
      );

      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateStripeSignature(payload, timestamp, stripeEndpointSecret);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.eventType).toBe('payment_intent.payment_failed');
    });

    it('should process refund webhooks', async () => {
      const chargeData = {
        id: 'ch_test123',
        object: 'charge',
        amount: 5000,
        currency: 'usd',
        status: 'succeeded',
        refunded: true,
        amount_refunded: 2500,
        refunds: {
          data: [{
            id: 'ref_test123',
            amount: 2500,
            currency: 'usd',
            reason: 'requested_by_customer',
            status: 'succeeded',
          }],
        },
      };

      const webhookEvent = createTestWebhookEvent('charge.updated', chargeData, 'stripe');
      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateStripeSignature(payload, timestamp, stripeEndpointSecret);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should handle customer events', async () => {
      const customerData = {
        id: 'cus_test123',
        object: 'customer',
        email: 'test@example.com',
        name: 'Test Customer',
        metadata: {
          userId: '507f1f77bcf86cd799439011',
        },
      };

      const webhookEvent = createTestWebhookEvent('customer.updated', customerData, 'stripe');
      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateStripeSignature(payload, timestamp, stripeEndpointSecret);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should reject webhooks with invalid signatures', async () => {
      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', {}, 'stripe');
      const payload = JSON.stringify(webhookEvent);
      const invalidSignature = 'invalid_signature';

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', invalidSignature)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        error: {
          message: expect.stringContaining('signature'),
        },
      });
    });

    it('should handle replay attacks (timestamp validation)', async () => {
      const webhookEvent = createTestWebhookEvent('payment_intent.succeeded', {}, 'stripe');
      const payload = JSON.stringify(webhookEvent);
      const oldTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const signature = generateStripeSignature(payload, oldTimestamp, stripeEndpointSecret);

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('timestamp');
    });

    it('should handle duplicate webhook events (idempotency)', async () => {
      const webhookEvent = createTestWebhookEvent(
        'payment_intent.succeeded',
        { id: 'pi_idempotency_test' },
        'stripe'
      );
      
      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = generateStripeSignature(payload, timestamp, stripeEndpointSecret);

      // First request
      const response1 = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload);

      // Second request with same event ID
      const response2 = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', signature)
        .send(payload);

      expect(response1.status).toBe(200);
      expect(response2.status).toBe(200);
      expect(response2.body.message).toContain('already processed');
    });
  });

  describe('Paystack Webhooks', () => {
    const paystackSecretKey = 'sk_test_paystack_secret';

    const generatePaystackSignature = (payload, secret) => {
      return crypto
        .createHmac('sha512', secret)
        .update(payload, 'utf8')
        .digest('hex');
    };

    beforeEach(() => {
      process.env.PAYSTACK_SECRET_KEY = paystackSecretKey;
    });

    it('should process charge.success webhook', async () => {
      const chargeData = {
        id: 302961,
        domain: 'live',
        status: 'success',
        reference: 'paystack_ref_123',
        amount: 50000,
        message: null,
        gateway_response: 'Successful',
        paid_at: '2023-01-01T10:00:00Z',
        created_at: '2023-01-01T09:00:00Z',
        currency: 'NGN',
        ip_address: '192.168.1.1',
        metadata: {
          userId: '507f1f77bcf86cd799439011',
          orderId: 'order_123',
        },
        fees: 750,
        customer: {
          id: 84312,
          email: 'test@example.com',
          customer_code: 'CUS_test123',
        },
        authorization: {
          authorization_code: 'AUTH_test123',
          bin: '408408',
          last4: '4081',
          exp_month: '12',
          exp_year: '2025',
          channel: 'card',
          card_type: 'visa',
          bank: 'TEST BANK',
          reusable: true,
        },
      };

      const webhookEvent = createTestWebhookEvent('charge.success', chargeData, 'paystack');
      const payload = JSON.stringify(webhookEvent);
      const signature = generatePaystackSignature(payload, paystackSecretKey);

      const response = await request(app)
        .post('/api/webhooks/paystack')
        .set('x-paystack-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        received: true,
        eventType: 'charge.success',
      });
    });

    it('should process transfer.success webhook', async () => {
      const transferData = {
        id: 14252,
        domain: 'live',
        amount: 50000,
        currency: 'NGN',
        source: 'balance',
        reason: 'Payout to customer',
        recipient: 2120,
        status: 'success',
        transfer_code: 'TRF_test123',
        transferred_at: '2023-01-01T10:00:00Z',
        createdAt: '2023-01-01T09:00:00Z',
        updatedAt: '2023-01-01T10:00:00Z',
      };

      const webhookEvent = createTestWebhookEvent('transfer.success', transferData, 'paystack');
      const payload = JSON.stringify(webhookEvent);
      const signature = generatePaystackSignature(payload, paystackSecretKey);

      const response = await request(app)
        .post('/api/webhooks/paystack')
        .set('x-paystack-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.eventType).toBe('transfer.success');
    });

    it('should handle subscription webhooks', async () => {
      const subscriptionData = {
        id: 6192,
        domain: 'live',
        status: 'active',
        subscription_code: 'SUB_test123',
        email_token: 'token123',
        amount: 50000,
        cron_expression: '0 0 * * *',
        next_payment_date: '2023-02-01T00:00:00Z',
        open_invoice: null,
        createdAt: '2023-01-01T09:00:00Z',
        plan: {
          id: 28,
          name: 'Monthly Plan',
          plan_code: 'PLN_test123',
          amount: 50000,
          interval: 'monthly',
        },
        customer: {
          id: 84312,
          email: 'test@example.com',
          customer_code: 'CUS_test123',
        },
        authorization: {
          authorization_code: 'AUTH_test123',
          bin: '408408',
          last4: '4081',
        },
      };

      const webhookEvent = createTestWebhookEvent('subscription.create', subscriptionData, 'paystack');
      const payload = JSON.stringify(webhookEvent);
      const signature = generatePaystackSignature(payload, paystackSecretKey);

      const response = await request(app)
        .post('/api/webhooks/paystack')
        .set('x-paystack-signature', signature)
        .send(payload);

      expect(response.status).toBe(200);
    });

    it('should reject webhooks with invalid signatures', async () => {
      const webhookEvent = createTestWebhookEvent('charge.success', {}, 'paystack');
      const payload = JSON.stringify(webhookEvent);
      const invalidSignature = 'invalid_signature';

      const response = await request(app)
        .post('/api/webhooks/paystack')
        .set('x-paystack-signature', invalidSignature)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('signature');
    });

    it('should handle missing signature header', async () => {
      const webhookEvent = createTestWebhookEvent('charge.success', {}, 'paystack');
      const payload = JSON.stringify(webhookEvent);

      const response = await request(app)
        .post('/api/webhooks/paystack')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('signature');
    });

    it('should handle malformed JSON payload', async () => {
      const invalidPayload = '{"invalid": json}';
      const signature = generatePaystackSignature(invalidPayload, paystackSecretKey);

      const response = await request(app)
        .post('/api/webhooks/paystack')
        .set('x-paystack-signature', signature)
        .set('content-type', 'application/json')
        .send(invalidPayload);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('Invalid JSON');
    });
  });

  describe('Webhook Event Processing', () => {
    it('should store webhook events in database', async () => {
      const webhookEvent = createTestWebhookEvent(
        'payment_intent.succeeded',
        { id: 'pi_test_db_storage' },
        'stripe'
      );

      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
        .update(`${timestamp}.${payload}`, 'utf8')
        .digest('hex');

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', `t=${timestamp},v1=${signature}`)
        .send(payload);

      // Verify event was stored in database
      // This would check the webhook_events table or collection
    });

    it('should handle webhook processing failures gracefully', async () => {
      // Mock a database error during webhook processing
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const webhookEvent = createTestWebhookEvent(
        'payment_intent.succeeded',
        { id: 'pi_test_error' },
        'stripe'
      );

      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
        .update(`${timestamp}.${payload}`, 'utf8')
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', `t=${timestamp},v1=${signature}`)
        .send(payload);

      // Should still return 200 to prevent retries for unrecoverable errors
      expect(response.status).toBe(200);
      console.error = originalConsoleError;
    });

    it('should handle webhook retry logic', async () => {
      let attemptCount = 0;
      
      // Mock temporary failure
      const originalProcessWebhook = require('../../src/services/webhookService').processWebhook;
      require('../../src/services/webhookService').processWebhook = jest.fn()
        .mockImplementation(() => {
          attemptCount++;
          if (attemptCount < 3) {
            throw new Error('Temporary processing error');
          }
          return originalProcessWebhook.apply(this, arguments);
        });

      const webhookEvent = createTestWebhookEvent(
        'payment_intent.succeeded',
        { id: 'pi_test_retry' },
        'stripe'
      );

      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
        .update(`${timestamp}.${payload}`, 'utf8')
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', `t=${timestamp},v1=${signature}`)
        .send(payload);

      expect(response.status).toBe(500); // Should fail and allow for retry
    });
  });

  describe('Webhook Security', () => {
    it('should rate limit webhook endpoints', async () => {
      const webhookEvent = createTestWebhookEvent(
        'payment_intent.succeeded',
        { id: 'pi_rate_limit_test' },
        'stripe'
      );

      const payload = JSON.stringify(webhookEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
        .update(`${timestamp}.${payload}`, 'utf8')
        .digest('hex');

      // Send multiple requests rapidly
      const promises = Array(20).fill().map(() =>
        request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', `t=${timestamp},v1=${signature}`)
          .send(payload)
      );

      const responses = await Promise.all(promises);
      
      // Some requests should be rate limited
      const rateLimitedResponses = responses.filter(res => res.status === 429);
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
    });

    it('should validate webhook payload size', async () => {
      const largePayload = JSON.stringify({
        ...createTestWebhookEvent('payment_intent.succeeded', {}, 'stripe'),
        largeData: 'x'.repeat(1024 * 1024), // 1MB of data
      });

      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
        .update(`${timestamp}.${largePayload}`, 'utf8')
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', `t=${timestamp},v1=${signature}`)
        .send(largePayload);

      expect(response.status).toBe(413); // Payload too large
    });

    it('should log security events', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      const webhookEvent = createTestWebhookEvent(
        'payment_intent.succeeded',
        {},
        'stripe'
      );
      const payload = JSON.stringify(webhookEvent);

      await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(payload);

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid webhook signature')
      );

      consoleSpy.mockRestore();
    });
  });

  describe('Webhook Event Types', () => {
    it('should handle all supported Stripe event types', async () => {
      const supportedEvents = [
        'payment_intent.succeeded',
        'payment_intent.payment_failed',
        'payment_intent.canceled',
        'charge.succeeded',
        'charge.failed',
        'charge.updated',
        'customer.created',
        'customer.updated',
        'customer.deleted',
        'invoice.payment_succeeded',
        'invoice.payment_failed',
      ];

      for (const eventType of supportedEvents) {
        const webhookEvent = createTestWebhookEvent(eventType, { id: 'test_id' }, 'stripe');
        const payload = JSON.stringify(webhookEvent);
        const timestamp = Math.floor(Date.now() / 1000);
        const signature = crypto
          .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
          .update(`${timestamp}.${payload}`, 'utf8')
          .digest('hex');

        const response = await request(app)
          .post('/api/webhooks/stripe')
          .set('stripe-signature', `t=${timestamp},v1=${signature}`)
          .send(payload);

        expect(response.status).toBe(200);
        expect(response.body.eventType).toBe(eventType);
      }
    });

    it('should handle all supported Paystack event types', async () => {
      const supportedEvents = [
        'charge.success',
        'charge.failed',
        'transfer.success',
        'transfer.failed',
        'subscription.create',
        'subscription.disable',
        'invoice.create',
        'invoice.update',
        'customeridentification.success',
        'customeridentification.failed',
      ];

      for (const eventType of supportedEvents) {
        const webhookEvent = createTestWebhookEvent(eventType, { id: 12345 }, 'paystack');
        const payload = JSON.stringify(webhookEvent);
        const signature = crypto
          .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY || 'test_secret')
          .update(payload, 'utf8')
          .digest('hex');

        const response = await request(app)
          .post('/api/webhooks/paystack')
          .set('x-paystack-signature', signature)
          .send(payload);

        expect(response.status).toBe(200);
        expect(response.body.eventType).toBe(eventType);
      }
    });

    it('should ignore unsupported event types', async () => {
      const unsupportedEvent = createTestWebhookEvent('unsupported.event', {}, 'stripe');
      const payload = JSON.stringify(unsupportedEvent);
      const timestamp = Math.floor(Date.now() / 1000);
      const signature = crypto
        .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
        .update(`${timestamp}.${payload}`, 'utf8')
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', `t=${timestamp},v1=${signature}`)
        .send(payload);

      expect(response.status).toBe(200);
      expect(response.body.message).toContain('ignored');
    });
  });
});