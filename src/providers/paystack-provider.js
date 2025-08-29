/**
 * Paystack Payment Provider Implementation
 * Implements the PaymentProvider interface for Paystack integration
 */

const axios = require('axios');
const crypto = require('crypto');
const { PaymentProvider } = require('./payment-provider-interface');
const { PaymentError, PaymentErrorTypes } = require('../utils/errors');

class PaystackProvider extends PaymentProvider {
  constructor(config) {
    super();
    this.config = config;
    this.providerName = 'paystack';
    this.baseURL = config.baseURL || 'https://api.paystack.co';
    
    this.client = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Initialize a transaction (equivalent to creating payment intent)
   */
  async createPaymentIntent(params) {
    try {
      const {
        amount,
        currency,
        customerId,
        paymentMethodTypes = ['card'],
        metadata = {},
        returnUrl,
        email
      } = params;

      // Convert amount to kobo for NGN or smallest unit for other currencies
      const amountInSmallestUnit = this.convertToSmallestUnit(amount, currency);

      const initializeParams = {
        email: email || (customerId ? await this.getCustomerEmail(customerId) : null),
        amount: amountInSmallestUnit,
        currency: currency.toUpperCase(),
        reference: this.generateReference(),
        callback_url: returnUrl,
        metadata: {
          ...metadata,
          provider: 'paystack'
        },
        channels: this.mapPaymentMethodTypes(paymentMethodTypes)
      };

      if (customerId) {
        initializeParams.customer = await this.getPaystackCustomerId(customerId);
      }

      const response = await this.client.post('/transaction/initialize', initializeParams);

      if (!response.data.status) {
        throw new PaymentError(
          response.data.message || 'Transaction initialization failed',
          PaymentErrorTypes.PROVIDER_ERROR
        );
      }

      return this.normalizePaymentIntent(response.data.data, initializeParams);

    } catch (error) {
      throw this.handlePaystackError(error);
    }
  }

  /**
   * Verify a transaction (equivalent to confirming payment intent)
   */
  async confirmPaymentIntent(paymentIntentId, params = {}) {
    try {
      // For Paystack, confirmation happens through verification
      const response = await this.client.get(`/transaction/verify/${paymentIntentId}`);

      if (!response.data.status) {
        throw new PaymentError(
          response.data.message || 'Transaction verification failed',
          PaymentErrorTypes.PROVIDER_ERROR
        );
      }

      const transaction = response.data.data;
      return this.normalizePaymentIntent(transaction);

    } catch (error) {
      throw this.handlePaystackError(error);
    }
  }

  /**
   * Capture a payment (Paystack doesn't have separate capture - payments are captured immediately)
   */
  async capturePaymentIntent(paymentIntentId, amountToCapture) {
    // Paystack doesn't support authorization/capture flow like Stripe
    // All successful payments are captured immediately
    try {
      const paymentIntent = await this.getPaymentIntent(paymentIntentId);
      
      if (paymentIntent.status !== 'succeeded') {
        throw new PaymentError(
          'Cannot capture payment that has not succeeded',
          PaymentErrorTypes.INVALID_REQUEST
        );
      }

      return paymentIntent;

    } catch (error) {
      throw this.handlePaystackError(error);
    }
  }

  /**
   * Cancel a payment (not supported in Paystack after initialization)
   */
  async cancelPaymentIntent(paymentIntentId, cancellationReason = 'requested_by_customer') {
    throw new PaymentError(
      'Payment cancellation not supported after initialization in Paystack',
      PaymentErrorTypes.NOT_SUPPORTED
    );
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

      const refundParams = {
        transaction: paymentIntentId,
        currency: 'NGN', // Paystack primarily supports NGN for refunds
        metadata: {
          ...metadata,
          reason
        }
      };

      if (amount) {
        refundParams.amount = this.convertToSmallestUnit(amount, 'ngn');
      }

      const response = await this.client.post('/refund', refundParams);

      if (!response.data.status) {
        throw new PaymentError(
          response.data.message || 'Refund failed',
          PaymentErrorTypes.PROVIDER_ERROR
        );
      }

      return this.normalizeRefund(response.data.data);

    } catch (error) {
      throw this.handlePaystackError(error);
    }
  }

  /**
   * Get payment intent status
   */
  async getPaymentIntent(paymentIntentId) {
    try {
      const response = await this.client.get(`/transaction/${paymentIntentId}`);

      if (!response.data.status) {
        throw new PaymentError(
          response.data.message || 'Transaction not found',
          PaymentErrorTypes.NOT_FOUND
        );
      }

      return this.normalizePaymentIntent(response.data.data);

    } catch (error) {
      throw this.handlePaystackError(error);
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
        metadata = {}
      } = customerData;

      const customerParams = {
        email,
        first_name: name ? name.split(' ')[0] : '',
        last_name: name ? name.split(' ').slice(1).join(' ') : '',
        phone,
        metadata: {
          ...metadata,
          created_via: 'payment_system'
        }
      };

      const response = await this.client.post('/customer', customerParams);

      if (!response.data.status) {
        throw new PaymentError(
          response.data.message || 'Customer creation failed',
          PaymentErrorTypes.PROVIDER_ERROR
        );
      }

      return this.normalizeCustomer(response.data.data);

    } catch (error) {
      throw this.handlePaystackError(error);
    }
  }

  /**
   * Create a payment method (dedicated virtual account or authorization)
   */
  async createPaymentMethod(customerId, paymentMethodData) {
    try {
      const { type } = paymentMethodData;

      if (type === 'dedicated_account') {
        return await this.createDedicatedAccount(customerId);
      }

      // For card tokenization, this would typically happen through the frontend
      // and the token would be passed to create payment intent
      throw new PaymentError(
        'Payment method creation not directly supported. Use tokenization flow.',
        PaymentErrorTypes.NOT_SUPPORTED
      );

    } catch (error) {
      throw this.handlePaystackError(error);
    }
  }

  /**
   * Create dedicated virtual account
   */
  async createDedicatedAccount(customerId) {
    try {
      const response = await this.client.post('/dedicated_account', {
        customer: await this.getPaystackCustomerId(customerId),
        preferred_bank: 'wema-bank' // or other supported banks
      });

      if (!response.data.status) {
        throw new PaymentError(
          response.data.message || 'Dedicated account creation failed',
          PaymentErrorTypes.PROVIDER_ERROR
        );
      }

      return this.normalizeDedicatedAccount(response.data.data);

    } catch (error) {
      throw this.handlePaystackError(error);
    }
  }

  /**
   * Verify webhook signature
   */
  verifyWebhookSignature(payload, signature) {
    const hash = crypto.createHmac('sha512', this.config.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');

    if (hash !== signature) {
      throw new PaymentError(
        'Webhook signature verification failed',
        PaymentErrorTypes.INVALID_SIGNATURE
      );
    }

    return payload;
  }

  /**
   * Process webhook event
   */
  async processWebhookEvent(event) {
    const { event: eventType, data } = event;

    switch (eventType) {
      case 'charge.success':
        return {
          type: 'payment_succeeded',
          paymentIntent: this.normalizePaymentIntent(data)
        };

      case 'charge.failed':
        return {
          type: 'payment_failed',
          paymentIntent: this.normalizePaymentIntent(data)
        };

      case 'transfer.success':
        return {
          type: 'transfer_succeeded',
          transfer: this.normalizeTransfer(data)
        };

      case 'transfer.failed':
        return {
          type: 'transfer_failed',
          transfer: this.normalizeTransfer(data)
        };

      default:
        return {
          type: 'unhandled_event',
          originalType: eventType,
          data
        };
    }
  }

  /**
   * Generate unique reference for transactions
   */
  generateReference() {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `ref_${timestamp}_${random}`;
  }

  /**
   * Convert amount to smallest currency unit
   */
  convertToSmallestUnit(amount, currency) {
    const multipliers = {
      'ngn': 100, // kobo
      'ghs': 100, // pesewa
      'zar': 100, // cents
      'usd': 100, // cents
      'eur': 100, // cents
      'gbp': 100  // pence
    };

    const multiplier = multipliers[currency.toLowerCase()] || 100;
    return Math.round(amount * multiplier);
  }

  /**
   * Map payment method types to Paystack channels
   */
  mapPaymentMethodTypes(paymentMethodTypes) {
    const channelMap = {
      'card': 'card',
      'bank_transfer': 'bank_transfer',
      'ussd': 'ussd',
      'mobile_money': 'mobile_money',
      'qr': 'qr'
    };

    return paymentMethodTypes
      .map(type => channelMap[type])
      .filter(Boolean);
  }

  /**
   * Get customer's Paystack ID
   */
  async getPaystackCustomerId(customerId) {
    // This would typically involve a database lookup
    // For now, assume the customerId is already the Paystack customer ID
    return customerId;
  }

  /**
   * Get customer email by ID
   */
  async getCustomerEmail(customerId) {
    // This would typically involve a database lookup
    // For now, return a placeholder
    return 'customer@example.com';
  }

  /**
   * Normalize Paystack transaction to common payment intent format
   */
  normalizePaymentIntent(paystackTransaction, initParams = {}) {
    const statusMap = {
      'success': 'succeeded',
      'failed': 'payment_failed',
      'abandoned': 'canceled',
      'pending': 'processing'
    };

    return {
      id: paystackTransaction.reference || paystackTransaction.id,
      provider: 'paystack',
      amount: paystackTransaction.amount ? paystackTransaction.amount / 100 : initParams.amount / 100,
      currency: (paystackTransaction.currency || initParams.currency || 'NGN').toLowerCase(),
      status: statusMap[paystackTransaction.status] || 'requires_payment_method',
      clientSecret: paystackTransaction.access_code,
      customerId: paystackTransaction.customer?.customer_code,
      paymentMethodId: paystackTransaction.authorization?.authorization_code,
      metadata: paystackTransaction.metadata || initParams.metadata,
      createdAt: paystackTransaction.created_at ? new Date(paystackTransaction.created_at) : new Date(),
      confirmedAt: paystackTransaction.status === 'success' 
        ? new Date(paystackTransaction.paid_at || paystackTransaction.created_at)
        : null,
      lastError: paystackTransaction.gateway_response !== 'Successful' && paystackTransaction.gateway_response 
        ? {
            code: 'payment_failed',
            message: paystackTransaction.gateway_response,
            type: 'card_error'
          }
        : null,
      raw: paystackTransaction
    };
  }

  /**
   * Normalize customer data
   */
  normalizeCustomer(paystackCustomer) {
    return {
      id: paystackCustomer.customer_code || paystackCustomer.id,
      provider: 'paystack',
      email: paystackCustomer.email,
      name: `${paystackCustomer.first_name || ''} ${paystackCustomer.last_name || ''}`.trim(),
      phone: paystackCustomer.phone,
      metadata: paystackCustomer.metadata,
      createdAt: new Date(paystackCustomer.created_at || Date.now()),
      raw: paystackCustomer
    };
  }

  /**
   * Normalize dedicated account data
   */
  normalizeDedicatedAccount(dedicatedAccount) {
    return {
      id: dedicatedAccount.id,
      provider: 'paystack',
      type: 'dedicated_account',
      accountName: dedicatedAccount.account_name,
      accountNumber: dedicatedAccount.account_number,
      bankName: dedicatedAccount.bank.name,
      bankCode: dedicatedAccount.bank.code,
      customerId: dedicatedAccount.customer.customer_code,
      isActive: dedicatedAccount.active,
      createdAt: new Date(dedicatedAccount.created_at),
      raw: dedicatedAccount
    };
  }

  /**
   * Normalize refund data
   */
  normalizeRefund(paystackRefund) {
    return {
      id: paystackRefund.id,
      provider: 'paystack',
      amount: paystackRefund.amount / 100,
      currency: (paystackRefund.currency || 'NGN').toLowerCase(),
      status: paystackRefund.status,
      transactionId: paystackRefund.transaction,
      metadata: paystackRefund.metadata,
      createdAt: new Date(paystackRefund.created_at),
      raw: paystackRefund
    };
  }

  /**
   * Normalize transfer data
   */
  normalizeTransfer(paystackTransfer) {
    return {
      id: paystackTransfer.id,
      provider: 'paystack',
      amount: paystackTransfer.amount / 100,
      currency: (paystackTransfer.currency || 'NGN').toLowerCase(),
      status: paystackTransfer.status,
      reason: paystackTransfer.reason,
      recipient: paystackTransfer.recipient,
      reference: paystackTransfer.reference,
      createdAt: new Date(paystackTransfer.created_at),
      raw: paystackTransfer
    };
  }

  /**
   * Handle Paystack errors and convert to PaymentError
   */
  handlePaystackError(error) {
    if (error.response) {
      const { status, data } = error.response;
      
      if (status === 400) {
        return new PaymentError(
          data.message || 'Invalid request',
          PaymentErrorTypes.INVALID_REQUEST,
          {
            provider: 'paystack',
            details: data
          }
        );
      }

      if (status === 401) {
        return new PaymentError(
          'Authentication failed',
          PaymentErrorTypes.AUTHENTICATION_ERROR,
          {
            provider: 'paystack'
          }
        );
      }

      if (status === 404) {
        return new PaymentError(
          'Resource not found',
          PaymentErrorTypes.NOT_FOUND,
          {
            provider: 'paystack'
          }
        );
      }

      if (status >= 500) {
        return new PaymentError(
          'Payment provider error',
          PaymentErrorTypes.PROVIDER_ERROR,
          {
            provider: 'paystack',
            status
          }
        );
      }

      return new PaymentError(
        data.message || 'Payment error',
        PaymentErrorTypes.UNKNOWN_ERROR,
        {
          provider: 'paystack',
          status,
          details: data
        }
      );
    }

    if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
      return new PaymentError(
        'Unable to connect to payment provider',
        PaymentErrorTypes.NETWORK_ERROR,
        {
          provider: 'paystack'
        }
      );
    }

    // Unknown error
    return new PaymentError(
      error.message || 'Unknown payment error',
      PaymentErrorTypes.UNKNOWN_ERROR,
      {
        provider: 'paystack'
      }
    );
  }

  /**
   * Get supported currencies
   */
  getSupportedCurrencies() {
    return ['ngn', 'usd', 'ghs', 'zar', 'kes'];
  }

  /**
   * Get supported payment method types
   */
  getSupportedPaymentMethods() {
    return [
      'card',
      'bank_transfer',
      'ussd',
      'mobile_money',
      'qr'
    ];
  }
}

module.exports = PaystackProvider;