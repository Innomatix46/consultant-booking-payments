import StripeService from '../services/stripeService.js';
import PaystackService from '../services/paystackService.js';
import Payment from '../models/Payment.js';
import logger from '../utils/logger.js';
import { validationResult } from 'express-validator';
import { ApiError } from '../utils/errors.js';

class PaymentController {
  static async createStripePaymentIntent(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        amount,
        currency = 'USD',
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name,
        customer_id
      } = req.body;

      const result = await StripeService.createPaymentIntent({
        amount,
        currency,
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name,
        customer_id
      });

      res.status(201).json({
        success: true,
        message: 'Payment intent created successfully',
        data: {
          payment_id: result.payment.id,
          client_secret: result.client_secret,
          payment_intent_id: result.payment_intent_id
        }
      });

    } catch (error) {
      logger.error('Error creating Stripe payment intent:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async createStripeCheckoutSession(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        price_id,
        amount,
        currency = 'USD',
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name
      } = req.body;

      const result = await StripeService.createCheckoutSession({
        price_id,
        amount,
        currency,
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name
      });

      res.status(201).json({
        success: true,
        message: 'Checkout session created successfully',
        data: {
          payment_id: result.payment.id,
          session_id: result.session_id,
          checkout_url: result.checkout_url
        }
      });

    } catch (error) {
      logger.error('Error creating Stripe checkout session:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async initializePaystackPayment(req, res, next) {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Validation errors',
          errors: errors.array()
        });
      }

      const {
        amount,
        currency = 'NGN',
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name
      } = req.body;

      const result = await PaystackService.initializePayment({
        amount,
        currency,
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name
      });

      res.status(201).json({
        success: true,
        message: 'Payment initialized successfully',
        data: {
          payment_id: result.payment.id,
          authorization_url: result.authorization_url,
          access_code: result.access_code,
          reference: result.reference
        }
      });

    } catch (error) {
      logger.error('Error initializing Paystack payment:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async verifyPaystackPayment(req, res, next) {
    try {
      const { reference } = req.params;

      if (!reference) {
        return res.status(400).json({
          success: false,
          message: 'Payment reference is required'
        });
      }

      const result = await PaystackService.verifyPayment(reference);

      if (!result) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment verified successfully',
        data: {
          payment: result.payment.toJSON(),
          transaction_data: result.transaction_data
        }
      });

    } catch (error) {
      logger.error('Error verifying Paystack payment:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async getPaymentStatus(req, res, next) {
    try {
      const { paymentId } = req.params;

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment status retrieved successfully',
        data: {
          payment: payment.toJSON()
        }
      });

    } catch (error) {
      logger.error('Error getting payment status:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async getUserPayments(req, res, next) {
    try {
      const { userId } = req.params;
      const { limit = 10, offset = 0 } = req.query;

      const payments = await Payment.findByUserId(userId, parseInt(limit), parseInt(offset));

      res.status(200).json({
        success: true,
        message: 'User payments retrieved successfully',
        data: {
          payments: payments.map(payment => payment.toJSON()),
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      });

    } catch (error) {
      logger.error('Error getting user payments:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async refundPayment(req, res, next) {
    try {
      const { paymentId } = req.params;
      const { amount, reason = 'requested_by_customer' } = req.body;

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (payment.status !== 'succeeded') {
        return res.status(400).json({
          success: false,
          message: 'Payment must be successful to process refund'
        });
      }

      let refundResult;

      if (payment.provider === 'stripe') {
        refundResult = await StripeService.refundPayment(
          payment.provider_payment_id,
          amount ? Math.round(amount * 100) : null, // Convert to cents
          reason
        );
      } else if (payment.provider === 'paystack') {
        refundResult = await PaystackService.refundPayment(
          payment.provider_payment_id,
          amount ? Math.round(amount * 100) : null, // Convert to kobo
          reason
        );
      } else {
        return res.status(400).json({
          success: false,
          message: 'Unsupported payment provider for refunds'
        });
      }

      res.status(200).json({
        success: true,
        message: 'Refund processed successfully',
        data: {
          refund: refundResult,
          payment_id: payment.id
        }
      });

    } catch (error) {
      logger.error('Error processing refund:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async getPaymentStats(req, res, next) {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          message: 'Start date and end date are required'
        });
      }

      const stats = await Payment.getPaymentStats(startDate, endDate);

      // Organize stats by provider and status
      const organizedStats = stats.reduce((acc, stat) => {
        if (!acc[stat.provider]) {
          acc[stat.provider] = {};
        }
        acc[stat.provider][stat.status] = {
          count: stat.count,
          total_amount: stat.total_amount,
          avg_amount: stat.avg_amount
        };
        return acc;
      }, {});

      res.status(200).json({
        success: true,
        message: 'Payment statistics retrieved successfully',
        data: {
          stats: organizedStats,
          period: { startDate, endDate }
        }
      });

    } catch (error) {
      logger.error('Error getting payment stats:', error);
      next(new ApiError(500, error.message));
    }
  }

  static async cancelPayment(req, res, next) {
    try {
      const { paymentId } = req.params;

      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: 'Payment not found'
        });
      }

      if (!['pending', 'processing'].includes(payment.status)) {
        return res.status(400).json({
          success: false,
          message: 'Payment cannot be cancelled in its current status'
        });
      }

      await payment.updateStatus('cancelled');

      res.status(200).json({
        success: true,
        message: 'Payment cancelled successfully',
        data: {
          payment: payment.toJSON()
        }
      });

    } catch (error) {
      logger.error('Error cancelling payment:', error);
      next(new ApiError(500, error.message));
    }
  }
}

export default PaymentController;