import axios from 'axios';
import crypto from 'crypto';
import Payment from '../models/Payment.js';
import PaymentEvent from '../models/PaymentEvent.js';
import logger from '../utils/logger.js';
import { validatePaymentAmount, validateEmail } from '../utils/validation.js';

const PAYSTACK_BASE_URL = 'https://api.paystack.co';
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

class PaystackService {
  static getHeaders() {
    return {
      'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json'
    };
  }

  static async initializePayment(paymentData) {
    try {
      // Validate input data
      if (!validatePaymentAmount(paymentData.amount)) {
        throw new Error('Invalid payment amount');
      }

      if (!validateEmail(paymentData.customer_email)) {
        throw new Error('Invalid email address');
      }

      // Convert amount to kobo (Paystack uses kobo for NGN)
      const amountInKobo = paymentData.currency?.toUpperCase() === 'NGN' ? 
        paymentData.amount : paymentData.amount * 100;

      const initializationData = {
        email: paymentData.customer_email,
        amount: amountInKobo,
        currency: paymentData.currency?.toUpperCase() || 'NGN',
        reference: `${Date.now()}-${paymentData.user_id}`,
        callback_url: `${process.env.FRONTEND_URL}/payment/success`,
        metadata: {
          user_id: paymentData.user_id,
          consultation_id: paymentData.consultation_id,
          appointment_id: paymentData.appointment_id || '',
          customer_name: paymentData.customer_name || '',
          cancel_action: `${process.env.FRONTEND_URL}/payment/cancel`
        },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
      };

      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/transaction/initialize`,
        initializationData,
        { headers: this.getHeaders() }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to initialize payment');
      }

      const { authorization_url, access_code, reference } = response.data.data;

      // Create payment record in database
      const payment = await Payment.create({
        user_id: paymentData.user_id,
        consultation_id: paymentData.consultation_id,
        appointment_id: paymentData.appointment_id,
        provider: 'paystack',
        provider_payment_id: reference,
        amount: paymentData.amount,
        currency: paymentData.currency?.toUpperCase() || 'NGN',
        status: 'pending',
        customer_email: paymentData.customer_email,
        customer_name: paymentData.customer_name,
        metadata: {
          paystack_reference: reference,
          paystack_access_code: access_code,
          authorization_url: authorization_url
        }
      });

      // Log payment initialization
      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.initialized',
        event_data: {
          provider: 'paystack',
          reference: reference,
          amount: amountInKobo,
          currency: initializationData.currency
        }
      });

      logger.info(`Paystack payment initialized: ${reference}`);

      return {
        payment,
        authorization_url,
        access_code,
        reference
      };

    } catch (error) {
      logger.error('Error initializing Paystack payment:', error);
      throw new Error(`Payment initialization failed: ${error.response?.data?.message || error.message}`);
    }
  }

  static async verifyPayment(reference) {
    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Payment verification failed');
      }

      const transactionData = response.data.data;
      
      // Find payment in database
      const payment = await Payment.findByProviderPaymentId(reference);
      if (!payment) {
        logger.warn(`Payment not found for Paystack reference: ${reference}`);
        return null;
      }

      // Update payment status based on verification result
      let status = 'failed';
      if (transactionData.status === 'success') {
        status = 'succeeded';
      } else if (transactionData.status === 'abandoned') {
        status = 'cancelled';
      }

      await payment.updateStatus(status, {
        provider_customer_id: transactionData.customer?.id,
        payment_method: transactionData.channel,
        metadata: {
          ...JSON.parse(payment.metadata || '{}'),
          paystack_transaction_id: transactionData.id,
          gateway_response: transactionData.gateway_response,
          paid_at: transactionData.paid_at,
          fees: transactionData.fees
        }
      });

      // Log verification event
      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.verified',
        event_data: {
          provider: 'paystack',
          reference: reference,
          status: transactionData.status,
          amount: transactionData.amount,
          fees: transactionData.fees
        }
      });

      logger.info(`Payment verified: ${payment.id} - Status: ${status}`);

      return {
        payment,
        transaction_data: transactionData
      };

    } catch (error) {
      logger.error(`Error verifying Paystack payment ${reference}:`, error);
      throw new Error(`Payment verification failed: ${error.response?.data?.message || error.message}`);
    }
  }

  static async handleWebhookEvent(event, signature) {
    try {
      // Verify webhook signature
      const secret = process.env.PAYSTACK_SECRET_KEY;
      const hash = crypto.createHmac('sha512', secret).update(JSON.stringify(event)).digest('hex');
      
      if (hash !== signature) {
        logger.error('Webhook signature verification failed');
        throw new Error('Webhook signature verification failed');
      }

      logger.info(`Processing Paystack webhook: ${event.event}`);

      switch (event.event) {
        case 'charge.success':
          await this.handleChargeSuccess(event.data);
          break;

        case 'charge.failed':
          await this.handleChargeFailed(event.data);
          break;

        case 'transfer.success':
          await this.handleTransferSuccess(event.data);
          break;

        case 'transfer.failed':
          await this.handleTransferFailed(event.data);
          break;

        default:
          logger.info(`Unhandled Paystack webhook event: ${event.event}`);
      }

      return { received: true };

    } catch (error) {
      logger.error('Error processing Paystack webhook:', error);
      throw error;
    }
  }

  static async handleChargeSuccess(chargeData) {
    try {
      const payment = await Payment.findByProviderPaymentId(chargeData.reference);
      if (!payment) {
        logger.warn(`Payment not found for Paystack reference: ${chargeData.reference}`);
        return;
      }

      await payment.updateStatus('succeeded', {
        provider_customer_id: chargeData.customer?.id,
        payment_method: chargeData.channel,
        metadata: {
          ...JSON.parse(payment.metadata || '{}'),
          paystack_transaction_id: chargeData.id,
          gateway_response: chargeData.gateway_response,
          paid_at: chargeData.paid_at,
          fees: chargeData.fees
        }
      });

      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.succeeded',
        event_data: {
          provider: 'paystack',
          reference: chargeData.reference,
          transaction_id: chargeData.id,
          amount: chargeData.amount,
          fees: chargeData.fees
        }
      });

      logger.info(`Payment succeeded: ${payment.id}`);

    } catch (error) {
      logger.error('Error handling charge.success:', error);
      throw error;
    }
  }

  static async handleChargeFailed(chargeData) {
    try {
      const payment = await Payment.findByProviderPaymentId(chargeData.reference);
      if (!payment) {
        logger.warn(`Payment not found for Paystack reference: ${chargeData.reference}`);
        return;
      }

      await payment.updateStatus('failed', {
        metadata: {
          ...JSON.parse(payment.metadata || '{}'),
          paystack_transaction_id: chargeData.id,
          gateway_response: chargeData.gateway_response,
          failure_reason: chargeData.gateway_response
        }
      });

      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.failed',
        event_data: {
          provider: 'paystack',
          reference: chargeData.reference,
          transaction_id: chargeData.id,
          gateway_response: chargeData.gateway_response
        }
      });

      logger.info(`Payment failed: ${payment.id}`);

    } catch (error) {
      logger.error('Error handling charge.failed:', error);
      throw error;
    }
  }

  static async handleTransferSuccess(transferData) {
    // Handle successful transfers (for refunds, etc.)
    logger.info(`Transfer successful: ${transferData.reference}`);
  }

  static async handleTransferFailed(transferData) {
    // Handle failed transfers
    logger.info(`Transfer failed: ${transferData.reference}`);
  }

  static async refundPayment(reference, amount = null, reason = 'requested_by_customer') {
    try {
      // First verify the original transaction
      const verificationResponse = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );

      if (!verificationResponse.data.status) {
        throw new Error('Original transaction not found');
      }

      const originalTransaction = verificationResponse.data.data;
      
      const refundData = {
        transaction: reference,
        amount: amount || originalTransaction.amount, // Amount in kobo for NGN
        currency: originalTransaction.currency,
        customer_note: reason,
        merchant_note: `Refund requested: ${reason}`
      };

      const response = await axios.post(
        `${PAYSTACK_BASE_URL}/refund`,
        refundData,
        { headers: this.getHeaders() }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Refund failed');
      }

      const payment = await Payment.findByProviderPaymentId(reference);
      if (payment) {
        await payment.updateStatus('refunded', {
          metadata: {
            ...JSON.parse(payment.metadata || '{}'),
            refund_id: response.data.data.id,
            refund_amount: amount || originalTransaction.amount,
            refund_reason: reason
          }
        });

        await PaymentEvent.create({
          payment_id: payment.id,
          event_type: 'payment.refunded',
          event_data: {
            provider: 'paystack',
            refund_id: response.data.data.id,
            amount: refundData.amount,
            reason: reason
          }
        });
      }

      logger.info(`Payment refunded: ${response.data.data.id}`);
      return response.data.data;

    } catch (error) {
      logger.error('Error creating refund:', error);
      throw new Error(`Refund failed: ${error.response?.data?.message || error.message}`);
    }
  }

  static async getTransactionDetails(reference) {
    try {
      const response = await axios.get(
        `${PAYSTACK_BASE_URL}/transaction/verify/${reference}`,
        { headers: this.getHeaders() }
      );

      if (!response.data.status) {
        throw new Error(response.data.message || 'Transaction not found');
      }

      return response.data.data;
    } catch (error) {
      logger.error(`Error getting transaction details for ${reference}:`, error);
      throw error;
    }
  }
}

export default PaystackService;