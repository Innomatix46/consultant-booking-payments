/**
 * Payment Provider Interface
 * Defines the common contract that all payment providers must implement
 */

class PaymentProvider {
  constructor() {
    if (this.constructor === PaymentProvider) {
      throw new Error('PaymentProvider is an abstract class and cannot be instantiated directly');
    }
  }

  /**
   * Create a payment intent
   * @param {Object} params - Payment intent parameters
   * @param {number} params.amount - Amount in smallest currency unit
   * @param {string} params.currency - Currency code (ISO 4217)
   * @param {string} [params.customerId] - Customer ID
   * @param {Array<string>} [params.paymentMethodTypes] - Allowed payment methods
   * @param {Object} [params.metadata] - Additional metadata
   * @param {string} [params.returnUrl] - Return URL for redirects
   * @returns {Promise<Object>} Normalized payment intent object
   */
  async createPaymentIntent(params) {
    throw new Error('createPaymentIntent method must be implemented');
  }

  /**
   * Confirm a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {Object} params - Confirmation parameters
   * @param {string} [params.paymentMethod] - Payment method ID
   * @param {string} [params.returnUrl] - Return URL for redirects
   * @returns {Promise<Object>} Normalized payment intent object
   */
  async confirmPaymentIntent(paymentIntentId, params = {}) {
    throw new Error('confirmPaymentIntent method must be implemented');
  }

  /**
   * Capture a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {number} [amountToCapture] - Amount to capture (optional, captures full amount if not provided)
   * @returns {Promise<Object>} Normalized payment intent object
   */
  async capturePaymentIntent(paymentIntentId, amountToCapture) {
    throw new Error('capturePaymentIntent method must be implemented');
  }

  /**
   * Cancel a payment intent
   * @param {string} paymentIntentId - Payment intent ID
   * @param {string} [cancellationReason] - Reason for cancellation
   * @returns {Promise<Object>} Normalized payment intent object
   */
  async cancelPaymentIntent(paymentIntentId, cancellationReason) {
    throw new Error('cancelPaymentIntent method must be implemented');
  }

  /**
   * Create a refund
   * @param {string} paymentIntentId - Payment intent ID
   * @param {Object} params - Refund parameters
   * @param {number} [params.amount] - Amount to refund (optional, refunds full amount if not provided)
   * @param {string} [params.reason] - Reason for refund
   * @param {Object} [params.metadata] - Additional metadata
   * @returns {Promise<Object>} Normalized refund object
   */
  async createRefund(paymentIntentId, params = {}) {
    throw new Error('createRefund method must be implemented');
  }

  /**
   * Get payment intent details
   * @param {string} paymentIntentId - Payment intent ID
   * @returns {Promise<Object>} Normalized payment intent object
   */
  async getPaymentIntent(paymentIntentId) {
    throw new Error('getPaymentIntent method must be implemented');
  }

  /**
   * Create a customer
   * @param {Object} customerData - Customer data
   * @param {string} customerData.email - Customer email
   * @param {string} [customerData.name] - Customer name
   * @param {string} [customerData.phone] - Customer phone
   * @param {Object} [customerData.address] - Customer address
   * @param {Object} [customerData.metadata] - Additional metadata
   * @returns {Promise<Object>} Normalized customer object
   */
  async createCustomer(customerData) {
    throw new Error('createCustomer method must be implemented');
  }

  /**
   * Create a payment method
   * @param {string} customerId - Customer ID
   * @param {Object} paymentMethodData - Payment method data
   * @param {string} paymentMethodData.type - Payment method type
   * @param {Object} [paymentMethodData.card] - Card details (if applicable)
   * @param {Object} [paymentMethodData.billingDetails] - Billing details
   * @returns {Promise<Object>} Normalized payment method object
   */
  async createPaymentMethod(customerId, paymentMethodData) {
    throw new Error('createPaymentMethod method must be implemented');
  }

  /**
   * Verify webhook signature
   * @param {string|Buffer} payload - Webhook payload
   * @param {string} signature - Webhook signature
   * @returns {Object} Verified webhook event
   */
  verifyWebhookSignature(payload, signature) {
    throw new Error('verifyWebhookSignature method must be implemented');
  }

  /**
   * Process webhook event
   * @param {Object} event - Webhook event
   * @returns {Promise<Object>} Normalized event object
   */
  async processWebhookEvent(event) {
    throw new Error('processWebhookEvent method must be implemented');
  }

  /**
   * Get supported currencies
   * @returns {Array<string>} Array of supported currency codes
   */
  getSupportedCurrencies() {
    throw new Error('getSupportedCurrencies method must be implemented');
  }

  /**
   * Get supported payment method types
   * @returns {Array<string>} Array of supported payment method types
   */
  getSupportedPaymentMethods() {
    throw new Error('getSupportedPaymentMethods method must be implemented');
  }

  /**
   * Get provider name
   * @returns {string} Provider name
   */
  getProviderName() {
    return this.providerName || 'unknown';
  }
}

module.exports = { PaymentProvider };