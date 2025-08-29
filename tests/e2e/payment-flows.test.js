/**
 * End-to-End Payment Flow Tests
 * Tests complete payment journeys from initiation to completion
 */

const puppeteer = require('puppeteer');
const request = require('supertest');
const app = require('../../src/app');
const {
  setupTestDatabase,
  teardownTestDatabase,
  createTestUser,
  generateTestToken,
} = require('../utils/test-setup');

describe('Payment Flow E2E Tests', () => {
  let browser;
  let page;
  let server;
  let testUser;
  let authToken;

  beforeAll(async () => {
    await setupTestDatabase();
    server = app.listen(0);
    const port = server.address().port;
    process.env.TEST_SERVER_URL = `http://localhost:${port}`;

    browser = await puppeteer.launch({
      headless: process.env.NODE_ENV === 'test',
      slowMo: 50,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
  });

  afterAll(async () => {
    if (browser) {
      await browser.close();
    }
    if (server) {
      server.close();
    }
    await teardownTestDatabase();
  });

  beforeEach(async () => {
    testUser = createTestUser();
    authToken = generateTestToken({ userId: testUser._id });
    
    page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    
    // Mock payment provider responses for E2E tests
    await page.setRequestInterception(true);
    page.on('request', (request) => {
      if (request.url().includes('api.stripe.com')) {
        request.respond({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: 'pi_test_e2e',
            client_secret: 'pi_test_e2e_secret',
            status: 'requires_payment_method',
          }),
        });
      } else {
        request.continue();
      }
    });
  });

  afterEach(async () => {
    if (page) {
      await page.close();
    }
  });

  describe('Stripe Payment Flow', () => {
    it('should complete full Stripe payment journey', async () => {
      // Navigate to payment page
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);

      // Set authentication token
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      // Select payment amount
      await page.click('[data-testid="amount-5000"]'); // $50.00

      // Select Stripe payment method
      await page.click('[data-testid="payment-method-stripe"]');

      // Wait for payment form to load
      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      // Fill in payment details
      await page.type('[data-testid="card-number"]', '4242424242424242');
      await page.type('[data-testid="card-expiry"]', '1225');
      await page.type('[data-testid="card-cvc"]', '123');
      await page.type('[data-testid="card-holder-name"]', 'Test User');

      // Submit payment
      await page.click('[data-testid="submit-payment"]');

      // Wait for processing
      await page.waitForSelector('[data-testid="payment-processing"]');

      // Mock successful payment confirmation
      await page.evaluate(() => {
        window.mockStripeConfirmation = {
          paymentIntent: {
            id: 'pi_test_success',
            status: 'succeeded',
          },
        };
      });

      // Wait for success message
      await page.waitForSelector('[data-testid="payment-success"]', {
        timeout: 10000,
      });

      // Verify success elements
      const successMessage = await page.$eval(
        '[data-testid="payment-success-message"]',
        el => el.textContent
      );
      expect(successMessage).toContain('Payment successful');

      // Verify payment details are displayed
      const paymentId = await page.$eval(
        '[data-testid="payment-id"]',
        el => el.textContent
      );
      expect(paymentId).toContain('pi_test_success');

      // Check that receipt is available
      const receiptButton = await page.$('[data-testid="download-receipt"]');
      expect(receiptButton).toBeTruthy();
    });

    it('should handle payment failures gracefully', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      await page.click('[data-testid="amount-5000"]');
      await page.click('[data-testid="payment-method-stripe"]');
      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      // Use a declined test card
      await page.type('[data-testid="card-number"]', '4000000000000002');
      await page.type('[data-testid="card-expiry"]', '1225');
      await page.type('[data-testid="card-cvc"]', '123');
      await page.type('[data-testid="card-holder-name"]', 'Test User');

      await page.click('[data-testid="submit-payment"]');

      // Mock payment failure
      await page.evaluate(() => {
        window.mockStripeError = {
          type: 'card_error',
          code: 'card_declined',
          message: 'Your card was declined.',
        };
      });

      // Wait for error message
      await page.waitForSelector('[data-testid="payment-error"]', {
        timeout: 10000,
      });

      const errorMessage = await page.$eval(
        '[data-testid="payment-error-message"]',
        el => el.textContent
      );
      expect(errorMessage).toContain('card was declined');

      // Verify user can retry
      const retryButton = await page.$('[data-testid="retry-payment"]');
      expect(retryButton).toBeTruthy();
    });

    it('should validate form inputs', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      await page.click('[data-testid="amount-5000"]');
      await page.click('[data-testid="payment-method-stripe"]');
      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      // Try to submit without filling fields
      await page.click('[data-testid="submit-payment"]');

      // Check for validation errors
      await page.waitForSelector('[data-testid="validation-errors"]');

      const validationErrors = await page.$$eval(
        '[data-testid="field-error"]',
        errors => errors.map(error => error.textContent)
      );

      expect(validationErrors).toEqual(
        expect.arrayContaining([
          expect.stringContaining('card number'),
          expect.stringContaining('expiry'),
          expect.stringContaining('CVC'),
        ])
      );
    });

    it('should handle network errors', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      // Mock network failure
      await page.setOfflineMode(true);

      await page.click('[data-testid="amount-5000"]');
      await page.click('[data-testid="payment-method-stripe"]');
      
      await page.waitForSelector('[data-testid="network-error"]', {
        timeout: 5000,
      });

      const networkError = await page.$eval(
        '[data-testid="network-error-message"]',
        el => el.textContent
      );
      expect(networkError).toContain('network');

      // Restore network and verify recovery
      await page.setOfflineMode(false);
      await page.click('[data-testid="retry-connection"]');

      await page.waitForSelector('[data-testid="stripe-payment-form"]');
    });
  });

  describe('Paystack Payment Flow', () => {
    it('should complete full Paystack payment journey', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      // Select payment amount in NGN
      await page.click('[data-testid="currency-ngn"]');
      await page.click('[data-testid="amount-50000"]'); // ₦500.00

      // Select Paystack payment method
      await page.click('[data-testid="payment-method-paystack"]');

      // Fill in email (required for Paystack)
      await page.type('[data-testid="customer-email"]', testUser.email);

      // Submit to initialize payment
      await page.click('[data-testid="initialize-payment"]');

      // Wait for redirect to Paystack checkout
      await page.waitForSelector('[data-testid="paystack-redirect"]');

      // Mock Paystack popup completion
      await page.evaluate(() => {
        window.mockPaystackSuccess = {
          reference: 'paystack_ref_test_123',
          status: 'success',
          trans: '12345',
          transaction: '12345',
          trxref: 'paystack_ref_test_123',
        };
        
        // Trigger the callback
        if (window.paystackCallback) {
          window.paystackCallback(window.mockPaystackSuccess);
        }
      });

      // Wait for verification
      await page.waitForSelector('[data-testid="payment-verification"]');

      // Mock successful verification response
      await page.evaluate(() => {
        fetch = jest.fn().mockResolvedValue({
          ok: true,
          json: () => Promise.resolve({
            success: true,
            payment: {
              reference: 'paystack_ref_test_123',
              status: 'success',
              amount: 500,
              currency: 'ngn',
            },
          }),
        });
      });

      // Wait for success confirmation
      await page.waitForSelector('[data-testid="payment-success"]');

      const successMessage = await page.$eval(
        '[data-testid="payment-success-message"]',
        el => el.textContent
      );
      expect(successMessage).toContain('successful');

      // Verify payment reference is shown
      const paymentRef = await page.$eval(
        '[data-testid="payment-reference"]',
        el => el.textContent
      );
      expect(paymentRef).toContain('paystack_ref_test_123');
    });

    it('should handle Paystack popup cancellation', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      await page.click('[data-testid="currency-ngn"]');
      await page.click('[data-testid="amount-50000"]');
      await page.click('[data-testid="payment-method-paystack"]');
      await page.type('[data-testid="customer-email"]', testUser.email);
      await page.click('[data-testid="initialize-payment"]');

      await page.waitForSelector('[data-testid="paystack-redirect"]');

      // Mock popup cancellation
      await page.evaluate(() => {
        if (window.paystackCallback) {
          window.paystackCallback();  // Called without response = cancellation
        }
      });

      await page.waitForSelector('[data-testid="payment-cancelled"]');

      const cancelMessage = await page.$eval(
        '[data-testid="payment-cancel-message"]',
        el => el.textContent
      );
      expect(cancelMessage).toContain('cancelled');

      // Verify user can retry
      const retryButton = await page.$('[data-testid="retry-payment"]');
      expect(retryButton).toBeTruthy();
    });

    it('should handle currency conversion display', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      // Start with USD
      await page.click('[data-testid="currency-usd"]');
      await page.click('[data-testid="amount-5000"]'); // $50.00

      // Switch to Paystack (which supports multiple currencies)
      await page.click('[data-testid="payment-method-paystack"]');

      // Verify currency options are available
      const currencySelect = await page.$('[data-testid="currency-selector"]');
      expect(currencySelect).toBeTruthy();

      // Switch to NGN
      await page.click('[data-testid="currency-ngn"]');

      // Verify amount is converted and displayed
      const convertedAmount = await page.$eval(
        '[data-testid="converted-amount"]',
        el => el.textContent
      );
      expect(convertedAmount).toMatch(/₦\s*\d+/); // Should show NGN symbol and amount
    });
  });

  describe('Multi-Step Payment Flows', () => {
    it('should handle payment with user registration', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);

      // Don't set auth token to simulate new user
      
      await page.click('[data-testid="amount-5000"]');
      await page.click('[data-testid="payment-method-stripe"]');

      // Should prompt for user registration
      await page.waitForSelector('[data-testid="registration-form"]');

      // Fill registration form
      await page.type('[data-testid="register-email"]', 'newuser@example.com');
      await page.type('[data-testid="register-name"]', 'New User');
      await page.type('[data-testid="register-password"]', 'SecurePass123!');
      await page.type('[data-testid="register-confirm-password"]', 'SecurePass123!');

      await page.click('[data-testid="register-submit"]');

      // Should proceed to payment after registration
      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      // Complete payment
      await page.type('[data-testid="card-number"]', '4242424242424242');
      await page.type('[data-testid="card-expiry"]', '1225');
      await page.type('[data-testid="card-cvc"]', '123');
      await page.type('[data-testid="card-holder-name"]', 'New User');

      await page.click('[data-testid="submit-payment"]');

      await page.waitForSelector('[data-testid="payment-success"]');

      // Verify user is now logged in
      const userMenu = await page.$('[data-testid="user-menu"]');
      expect(userMenu).toBeTruthy();
    });

    it('should handle saved payment methods', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
        // Mock saved payment methods
        localStorage.setItem('savedPaymentMethods', JSON.stringify([
          {
            id: 'pm_test_saved',
            type: 'card',
            card: { brand: 'visa', last4: '4242' },
          },
        ]));
      }, authToken);

      await page.click('[data-testid="amount-5000"]');
      await page.click('[data-testid="payment-method-stripe"]');

      await page.waitForSelector('[data-testid="saved-payment-methods"]');

      // Select saved payment method
      await page.click('[data-testid="saved-method-pm_test_saved"]');

      // Should skip card input form
      await page.click('[data-testid="submit-payment"]');

      // Should proceed directly to processing
      await page.waitForSelector('[data-testid="payment-processing"]');

      await page.waitForSelector('[data-testid="payment-success"]');
    });

    it('should handle payment with discount codes', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      await page.click('[data-testid="amount-5000"]'); // $50.00

      // Apply discount code
      await page.click('[data-testid="show-discount-code"]');
      await page.type('[data-testid="discount-code"]', 'SAVE10');
      await page.click('[data-testid="apply-discount"]');

      // Wait for discount to be applied
      await page.waitForSelector('[data-testid="discount-applied"]');

      const discountedAmount = await page.$eval(
        '[data-testid="final-amount"]',
        el => el.textContent
      );
      expect(discountedAmount).toContain('$45.00'); // 10% discount applied

      await page.click('[data-testid="payment-method-stripe"]');
      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      // Complete payment with discounted amount
      await page.type('[data-testid="card-number"]', '4242424242424242');
      await page.type('[data-testid="card-expiry"]', '1225');
      await page.type('[data-testid="card-cvc"]', '123');
      await page.type('[data-testid="card-holder-name"]', 'Test User');

      await page.click('[data-testid="submit-payment"]');
      await page.waitForSelector('[data-testid="payment-success"]');

      // Verify final amount charged
      const chargedAmount = await page.$eval(
        '[data-testid="charged-amount"]',
        el => el.textContent
      );
      expect(chargedAmount).toContain('$45.00');
    });
  });

  describe('Mobile Payment Flows', () => {
    beforeEach(async () => {
      // Set mobile viewport
      await page.setViewport({ width: 375, height: 667 });
      await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 14_7 like Mac OS X) AppleWebKit/605.1.15');
    });

    it('should handle mobile Stripe payment flow', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      // Mobile UI should be responsive
      const mobileLayout = await page.$('[data-testid="mobile-payment-layout"]');
      expect(mobileLayout).toBeTruthy();

      await page.tap('[data-testid="amount-5000"]');
      await page.tap('[data-testid="payment-method-stripe"]');

      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      // Mobile card input should be optimized
      const mobileCardInput = await page.$('[data-testid="mobile-card-input"]');
      expect(mobileCardInput).toBeTruthy();

      await page.type('[data-testid="card-number"]', '4242424242424242');
      await page.type('[data-testid="card-expiry"]', '1225');
      await page.type('[data-testid="card-cvc"]', '123');

      await page.tap('[data-testid="submit-payment"]');
      await page.waitForSelector('[data-testid="payment-success"]');
    });

    it('should handle mobile Paystack flow with optimized popup', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      await page.tap('[data-testid="currency-ngn"]');
      await page.tap('[data-testid="amount-50000"]');
      await page.tap('[data-testid="payment-method-paystack"]');

      // Mobile should optimize email input
      const mobileEmailInput = await page.$('[data-testid="mobile-email-input"]');
      expect(mobileEmailInput).toBeTruthy();

      await page.type('[data-testid="customer-email"]', testUser.email);
      await page.tap('[data-testid="initialize-payment"]');

      // Mobile Paystack popup should be optimized
      await page.waitForSelector('[data-testid="mobile-paystack-overlay"]');

      // Complete mobile flow
      await page.evaluate(() => {
        if (window.paystackCallback) {
          window.paystackCallback({
            reference: 'mobile_ref_123',
            status: 'success',
          });
        }
      });

      await page.waitForSelector('[data-testid="payment-success"]');
    });
  });

  describe('Accessibility Testing', () => {
    it('should be keyboard navigable', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      // Navigate using keyboard only
      await page.keyboard.press('Tab'); // Focus first amount button
      await page.keyboard.press('Enter'); // Select amount

      await page.keyboard.press('Tab'); // Focus payment method
      await page.keyboard.press('Enter'); // Select Stripe

      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      // Tab through form fields
      await page.keyboard.press('Tab'); // Card number
      await page.keyboard.type('4242424242424242');

      await page.keyboard.press('Tab'); // Expiry
      await page.keyboard.type('1225');

      await page.keyboard.press('Tab'); // CVC
      await page.keyboard.type('123');

      await page.keyboard.press('Tab'); // Name
      await page.keyboard.type('Test User');

      await page.keyboard.press('Tab'); // Submit button
      await page.keyboard.press('Enter'); // Submit

      await page.waitForSelector('[data-testid="payment-success"]');
    });

    it('should have proper ARIA labels', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);

      // Check for ARIA labels
      const amountButtons = await page.$$eval(
        '[data-testid^="amount-"]',
        buttons => buttons.map(btn => btn.getAttribute('aria-label'))
      );

      expect(amountButtons).toEqual(
        expect.arrayContaining([
          expect.stringContaining('amount'),
          expect.stringContaining('dollar'),
        ])
      );

      const paymentMethods = await page.$$eval(
        '[data-testid^="payment-method-"]',
        methods => methods.map(method => method.getAttribute('aria-label'))
      );

      expect(paymentMethods).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Stripe'),
          expect.stringContaining('Paystack'),
        ])
      );
    });

    it('should announce status changes to screen readers', async () => {
      await page.goto(`${process.env.TEST_SERVER_URL}/payment`);
      
      await page.evaluate((token) => {
        localStorage.setItem('authToken', token);
      }, authToken);

      await page.click('[data-testid="amount-5000"]');
      await page.click('[data-testid="payment-method-stripe"]');

      // Check for live region updates
      const liveRegion = await page.$('[aria-live="polite"]');
      expect(liveRegion).toBeTruthy();

      await page.waitForSelector('[data-testid="stripe-payment-form"]');

      const liveRegionText = await page.$eval(
        '[aria-live="polite"]',
        el => el.textContent
      );
      expect(liveRegionText).toContain('payment form loaded');
    });
  });
});