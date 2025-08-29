/**
 * Stripe Payment Provider Implementation
 * Implements the PaymentProvider interface for Stripe integration
 */

const Stripe = require('stripe');
const { PaymentProvider } = require('./payment-provider-interface');
const { PaymentError, PaymentErrorTypes } = require('../utils/errors');

class StripeProvider extends PaymentProvider {
  constructor(config) {
    super();
    this.stripe = new Stripe(config.secretKey);
    this.config = config;
    this.providerName = 'stripe';
  }

  /**
   * Create a payment intent with Stripe
   */
  async createPaymentIntent(params) {
    try {
      const {
        amount,
        currency,
        customerId,
        paymentMethodTypes = ['card'],
        metadata = {},
        returnUrl
      } = params;

      const createParams = {
        amount,
        currency: currency.toLowerCase(),
        payment_method_types: paymentMethodTypes,
        metadata: {
          ...metadata,
          provider: 'stripe'
        }
      };

      // Add customer if provided
      if (customerId) {
        createParams.customer = await this.getStripeCustomerId(customerId);
      }

      // Add return URL for payment methods that require it
      if (returnUrl && paymentMethodTypes.includes('card')) {
        createParams.automatic_payment_methods = {
          enabled: true,
          allow_redirects: 'always'
        };
      }

      const paymentIntent = await this.stripe.paymentIntents.create(createParams);

      return this.normalizePaymentIntent(paymentIntent);

    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Confirm a payment intent
   */
  async confirmPaymentIntent(paymentIntentId, params = {}) {
    try {
      const {
        paymentMethod,
        returnUrl,
        useStripeSdk = false
      } = params;

      const confirmParams = {};

      if (paymentMethod) {
        confirmParams.payment_method = paymentMethod;
      }

      if (returnUrl) {
        confirmParams.return_url = returnUrl;
      }

      if (useStripeSdk) {
        confirmParams.use_stripe_sdk = true;
      }

      const paymentIntent = await this.stripe.paymentIntents.confirm(
        paymentIntentId,
        confirmParams
      );

      return this.normalizePaymentIntent(paymentIntent);

    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Capture a payment intent
   */
  async capturePaymentIntent(paymentIntentId, amountToCapture) {
    try {
      const captureParams = {};
      
      if (amountToCapture) {
        captureParams.amount_to_capture = amountToCapture;
      }

      const paymentIntent = await this.stripe.paymentIntents.capture(
        paymentIntentId,
        captureParams
      );

      return this.normalizePaymentIntent(paymentIntent);

    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Cancel a payment intent
   */
  async cancelPaymentIntent(paymentIntentId, cancellationReason = 'requested_by_customer') {
    try {
      const paymentIntent = await this.stripe.paymentIntents.cancel(
        paymentIntentId,
        { cancellation_reason: cancellationReason }
      );

      return this.normalizePaymentIntent(paymentIntent);

    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Create a refund
   */
  async createRefund(paymentIntentId, params = {}) {
    try {
      const {
        amount,
        reason = 'requested_by_customer',
        metadata = {}
      } = params;

      // Get the payment intent to find the charge
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      
      if (!paymentIntent.latest_charge) {
        throw new PaymentError(
          'No charge found for this payment intent',
          PaymentErrorTypes.INVALID_REQUEST
        );
      }

      const refundParams = {
        charge: paymentIntent.latest_charge,
        reason,
        metadata: {
          ...metadata,
          payment_intent_id: paymentIntentId
        }
      };

      if (amount) {
        refundParams.amount = amount;
      }

      const refund = await this.stripe.refunds.create(refundParams);

      return this.normalizeRefund(refund);

    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await this.stripe.paymentIntents.retrieve(paymentIntentId);
      return this.normalizePaymentIntent(paymentIntent);
    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Create a customer
   */
  async createCustomer(customerData) {
    try {
      const {
        email,
        name,
        phone,
        address,
        metadata = {}
      } = customerData;

      const customer = await this.stripe.customers.create({
        email,
        name,
        phone,
        address,
        metadata: {
          ...metadata,
          created_via: 'payment_system'
        }
      });

      return this.normalizeCustomer(customer);

    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Create a payment method
   */
  async createPaymentMethod(customerId, paymentMethodData) {
    try {
      const { type, card, billingDetails } = paymentMethodData;

      const paymentMethod = await this.stripe.paymentMethods.create({
        type,
        card,
        billing_details: billingDetails
      });

      // Attach to customer
      await this.stripe.paymentMethods.attach(paymentMethod.id, {
        customer: await this.getStripeCustomerId(customerId)
      });

      return this.normalizePaymentMethod(paymentMethod);

    } catch (error) {
      throw this.handleStripeError(error);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    try {
      const event = this.stripe.webhooks.constructEvent(
        payload,
        signature,
        this.config.webhookSecret
      );
      return event;
    } catch (error) {
      throw new PaymentError(
        `Webhook signature verification failed: ${error.message}`,
        PaymentErrorTypes.INVALID_SIGNATURE
      );
    }
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event) {
    const { type, data } = event;
    const object = data.object;

    switch (type) {
      case 'payment_intent.succeeded':
        return {
          type: 'payment_succeeded',
          paymentIntent: this.normalizePaymentIntent(object)
        };

      case 'payment_intent.payment_failed':
        return {
          type: 'payment_failed',
          paymentIntent: this.normalizePaymentIntent(object)
        };

      case 'payment_intent.canceled':
        return {
          type: 'payment_canceled',
          paymentIntent: this.normalizePaymentIntent(object)
        };

      case 'payment_intent.requires_action':
        return {
          type: 'payment_requires_action',
          paymentIntent: this.normalizePaymentIntent(object)
        };

      case 'charge.dispute.created':
        return {
          type: 'dispute_created',
          dispute: this.normalizeDispute(object)
        };

      default:
        return {
          type: 'unhandled_event',
          originalType: type,
          data: object
        };
    }
  }

  /**
   * Get customer's Stripe ID
   */
  async getStripeCustomerId(customerId) {
    // This would typically involve a database lookup
    // For now, assume the customerId is already the Stripe customer ID
    // In production, you'd map your internal customer ID to Stripe's customer ID
    return customerId;
  }

  /**
   * Normalize Stripe payment intent to common format
   */
  normalizePaymentIntent(stripePaymentIntent) {
    return {
      id: stripePaymentIntent.id,
      provider: 'stripe',
      amount: stripePaymentIntent.amount,
      currency: stripePaymentIntent.currency,
      status: this.normalizePaymentStatus(stripePaymentIntent.status),
      clientSecret: stripePaymentIntent.client_secret,
      customerId: stripePaymentIntent.customer,
      paymentMethodId: stripePaymentIntent.payment_method,
      metadata: stripePaymentIntent.metadata,
      createdAt: new Date(stripePaymentIntent.created * 1000),
      confirmedAt: stripePaymentIntent.status === 'succeeded' 
        ? new Date() 
        : null,
      lastError: stripePaymentIntent.last_payment_error 
        ? {
            code: stripePaymentIntent.last_payment_error.code,
            message: stripePaymentIntent.last_payment_error.message,
            type: stripePaymentIntent.last_payment_error.type
          } 
        : null,
      raw: stripePaymentIntent
    };
  }

  /**
   * Normalize payment status
   */
  normalizePaymentStatus(stripeStatus) {
    const statusMap = {
      'requires_payment_method': 'requires_payment_method',
      'requires_confirmation': 'requires_confirmation',
      'requires_action': 'requires_action',
      'processing': 'processing',
      'requires_capture': 'requires_capture',
      'canceled': 'canceled',
      'succeeded': 'succeeded'
    };

    return statusMap[stripeStatus] || stripeStatus;
  }

  /**
   * Normalize customer data
   */
  normalizeCustomer(stripeCustomer) {
    return {
      id: stripeCustomer.id,
      provider: 'stripe',
      email: stripeCustomer.email,
      name: stripeCustomer.name,
      phone: stripeCustomer.phone,
      address: stripeCustomer.address,
      metadata: stripeCustomer.metadata,
      createdAt: new Date(stripeCustomer.created * 1000),
      raw: stripeCustomer
    };
  }

  /**
   * Normalize payment method data
   */
  normalizePaymentMethod(stripePaymentMethod) {
    return {
      id: stripePaymentMethod.id,
      provider: 'stripe',
      type: stripePaymentMethod.type,
      card: stripePaymentMethod.card ? {
        brand: stripePaymentMethod.card.brand,
        last4: stripePaymentMethod.card.last4,
        expMonth: stripePaymentMethod.card.exp_month,
        expYear: stripePaymentMethod.card.exp_year,
        country: stripePaymentMethod.card.country
      } : null,
      billingDetails: stripePaymentMethod.billing_details,
      metadata: stripePaymentMethod.metadata,
      createdAt: new Date(stripePaymentMethod.created * 1000),
      raw: stripePaymentMethod
    };
  }

  /**
   * Normalize refund data
   */
  normalizeRefund(stripeRefund) {
    return {
      id: stripeRefund.id,
      provider: 'stripe',
      amount: stripeRefund.amount,
      currency: stripeRefund.currency,
      status: stripeRefund.status,
      reason: stripeRefund.reason,
      chargeId: stripeRefund.charge,
      metadata: stripeRefund.metadata,
      createdAt: new Date(stripeRefund.created * 1000),
      raw: stripeRefund
    };
  }

  /**
   * Normalize dispute data
   */
  normalizeDispute(stripeDispute) {
    return {
      id: stripeDispute.id,
      provider: 'stripe',
      amount: stripeDispute.amount,
      currency: stripeDispute.currency,
      status: stripeDispute.status,
      reason: stripeDispute.reason,
      chargeId: stripeDispute.charge,
      evidence: stripeDispute.evidence,
      createdAt: new Date(stripeDispute.created * 1000),
      raw: stripeDispute
    };
  }

  /**
   * Handle Stripe errors and convert to PaymentError
   */
  handleStripeError(error) {
    if (error.type === 'StripeCardError') {
      return new PaymentError(
        error.message,
        PaymentErrorTypes.CARD_DECLINED,
        {
          code: error.code,
          declineCode: error.decline_code,
          provider: 'stripe'
        }
      );
    }

    if (error.type === 'StripeInvalidRequestError') {
      return new PaymentError(
        error.message,
        PaymentErrorTypes.INVALID_REQUEST,
        {
          param: error.param,
          provider: 'stripe'
        }
      );
    }

    if (error.type === 'StripeAPIError') {
      return new PaymentError(
        'Payment provider error',
        PaymentErrorTypes.PROVIDER_ERROR,
        {
          originalMessage: error.message,
          provider: 'stripe'
        }
      );
    }

    if (error.type === 'StripeConnectionError') {
      return new PaymentError(
        'Unable to connect to payment provider',
        PaymentErrorTypes.NETWORK_ERROR,
        {
          provider: 'stripe'
        }
      );
    }

    // Unknown Stripe error
    return new PaymentError(
      error.message || 'Unknown payment error',
      PaymentErrorTypes.UNKNOWN_ERROR,
      {
        originalType: error.type,
        provider: 'stripe'
      }
    );
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies() {
    return [
      'usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'sek', 'nok', 'dkk',
      'pln', 'czk', 'huf', 'bgn', 'ron', 'hrk', 'ils', 'inr', 'krw', 'myr',
      'php', 'sgd', 'thb', 'vnd', 'brl', 'mxn', 'hkd', 'nzd'
    ];
  }

  /**
   * Get supported payment method types
   */
  getSupportedPaymentMethods() {
    return [
      'card',
      'acss_debit',
      'afterpay_clearpay',
      'alipay',
      'au_becs_debit',
      'bacs_debit',
      'bancontact',
      'boleto',
      'eps',
      'fpx',
      'giropay',
      'grabpay',
      'ideal',
      'klarna',
      'oxxo',
      'p24',
      'sepa_debit',
      'sofort',
      'wechat_pay'
    ];
  }
}

module.exports = StripeProvider;