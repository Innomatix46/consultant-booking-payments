import axios from 'axios';
import Payment from '../models/Payment.js';
import logger from '../utils/logger.js';
import { PaymentError } from '../utils/errors.js';
import crypto from 'crypto';

class PaystackService {
  constructor() {
    this.baseURL = 'https://api.paystack.co';
    this.secretKey = process.env.PAYSTACK_SECRET_KEY;
    this.publicKey = process.env.PAYSTACK_PUBLIC_KEY;
    
    this.axiosInstance = axios.create({
      baseURL: this.baseURL,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json',
      },
    });
  }

  static getInstance() {
    if (!PaystackService.instance) {
      PaystackService.instance = new PaystackService();
    }
    return PaystackService.instance;
  }

  static async initializePayment({
    amount,
    currency = 'NGN',
    user_id,
    consultation_id,
    appointment_id,
    customer_email,
    customer_name
  }) {
    const instance = PaystackService.getInstance();
    
    try {
      const reference = `ref_${Date.now()}_${user_id}`;
      
      const paymentData = {
        email: customer_email,
        amount: Math.round(amount * 100), // Convert to kobo
        currency: currency.toUpperCase(),
        reference,
        callback_url: `${process.env.FRONTEND_URL}/payment/verify`,
        metadata: {
          user_id,
          consultation_id,
          appointment_id: appointment_id || '',
          customer_name,
          custom_fields: [
            {
              display_name: 'Customer Name',
              variable_name: 'customer_name',
              value: customer_name
            }
          ]
        }
      };

      const response = await instance.axiosInstance.post('/transaction/initialize', paymentData);

      if (!response.data.status) {
        throw new Error(response.data.message || 'Failed to initialize payment');
      }

      // Save payment to database
      const payment = await Payment.createPayment({
        provider: 'paystack',
        provider_payment_id: reference,
        amount,
        currency: currency.toUpperCase(),
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name,
        status: 'pending',
        metadata: paymentData.metadata
      });

      logger.info('Paystack payment initialized', {
        paymentId: payment.id,
        reference,
        amount,
        currency
      });

      return {
        payment,
        authorization_url: response.data.data.authorization_url,
        access_code: response.data.data.access_code,
        reference: response.data.data.reference
      };
    } catch (error) {
      logger.error('Error initializing Paystack payment:', error);
      throw new PaymentError(`Failed to initialize payment: ${error.message}`, 'paystack', error);
    }
  }

  static async verifyPayment(reference) {
    const instance = PaystackService.getInstance();
    
    try {
      const response = await instance.axiosInstance.get(`/transaction/verify/${reference}`);

      if (!response.data.status) {
        throw new Error(response.data.message || 'Payment verification failed');
      }

      const transaction = response.data.data;
      const payment = Payment.findByProviderPaymentId(reference);

      if (!payment) {
        logger.error('Payment not found for reference:', reference);
        return null;
      }

      // Update payment status based on transaction status
      let status = 'pending';
      if (transaction.status === 'success') {
        status = 'succeeded';
      } else if (transaction.status === 'failed') {
        status = 'failed';
      }

      await payment.updateStatus(status, {
        gateway_response: transaction.gateway_response,
        paid_at: transaction.paid_at,
        channel: transaction.channel,
        fees: transaction.fees / 100, // Convert from kobo
        authorization: transaction.authorization
      });

      logger.info('Paystack payment verified', {
        paymentId: payment.id,
        reference,
        status: transaction.status
      });

      return {
        payment,
        transaction_data: transaction
      };
    } catch (error) {
      logger.error('Error verifying Paystack payment:', error);
      throw new PaymentError(`Failed to verify payment: ${error.message}`, 'paystack', error);
    }
  }

  static async refundPayment(transactionId, amount = null, reason = 'requested_by_customer') {
    const instance = PaystackService.getInstance();
    
    try {
      const refundData = {
        transaction: transactionId,
        merchant_note: reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to kobo
      }

      const response = await instance.axiosInstance.post('/refund', refundData);

      if (!response.data.status) {
        throw new Error(response.data.message || 'Refund failed');
      }

      logger.info('Paystack refund processed', {
        refundId: response.data.data.id,
        transactionId,
        amount: response.data.data.amount / 100,
        reason
      });

      return {
        id: response.data.data.id,
        amount: response.data.data.amount / 100,
        status: response.data.data.status,
        reason: reason
      };
    } catch (error) {
      logger.error('Error processing Paystack refund:', error);
      throw new PaymentError(`Failed to process refund: ${error.message}`, 'paystack', error);
    }
  }

  static async handleWebhookEvent(body, signature) {
    try {
      // Verify webhook signature
      const hash = crypto.createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
        .update(JSON.stringify(body))
        .digest('hex');

      if (hash !== signature) {
        throw new Error('Invalid webhook signature');
      }

      const event = typeof body === 'string' ? JSON.parse(body) : body;

      logger.info('Processing Paystack webhook', {
        eventType: event.event,
        reference: event.data?.reference
      });

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
          logger.info(`Unhandled Paystack event type: ${event.event}`);
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventType: event.event
      };
    } catch (error) {
      logger.error('Error processing Paystack webhook:', error);
      throw error;
    }
  }

  static async handleChargeSuccess(data) {
    const payment = Payment.findByProviderPaymentId(data.reference);
    if (payment) {
      await payment.updateStatus('succeeded', {
        gateway_response: data.gateway_response,
        paid_at: data.paid_at,
        channel: data.channel,
        fees: data.fees / 100,
        authorization: data.authorization
      });
      logger.info('Payment marked as succeeded', { paymentId: payment.id });
    }
  }

  static async handleChargeFailed(data) {
    const payment = Payment.findByProviderPaymentId(data.reference);
    if (payment) {
      await payment.updateStatus('failed', {
        gateway_response: data.gateway_response,
        failure_reason: data.gateway_response
      });
      logger.info('Payment marked as failed', { paymentId: payment.id });
    }
  }

  static async handleTransferSuccess(data) {
    logger.info('Transfer succeeded', { transferCode: data.transfer_code });
  }

  static async handleTransferFailed(data) {
    logger.info('Transfer failed', { transferCode: data.transfer_code });
  }

  // Additional utility methods
  static async listTransactions(page = 1, perPage = 50) {
    const instance = PaystackService.getInstance();
    
    try {
      const response = await instance.axiosInstance.get('/transaction', {
        params: { page, perPage }
      });

      return response.data.data;
    } catch (error) {
      logger.error('Error fetching Paystack transactions:', error);
      throw new PaymentError(`Failed to fetch transactions: ${error.message}`, 'paystack', error);
    }
  }

  static async getBanks() {
    const instance = PaystackService.getInstance();
    
    try {
      const response = await instance.axiosInstance.get('/bank');
      return response.data.data;
    } catch (error) {
      logger.error('Error fetching banks:', error);
      throw new PaymentError(`Failed to fetch banks: ${error.message}`, 'paystack', error);
    }
  }
}

export default PaystackService;