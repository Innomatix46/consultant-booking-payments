import Stripe from 'stripe';
import Payment from '../models/Payment.js';
import PaymentEvent from '../models/PaymentEvent.js';
import logger from '../utils/logger.js';
import { validatePaymentAmount, validateCurrency } from '../utils/validation.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  static async createPaymentIntent(paymentData) {
    try {
      // Validate input data
      if (!validatePaymentAmount(paymentData.amount)) {
        throw new Error('Invalid payment amount');
      }

      if (!validateCurrency(paymentData.currency)) {
        throw new Error('Invalid currency code');
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: paymentData.amount,
        currency: paymentData.currency.toLowerCase(),
        customer: paymentData.customer_id,
        metadata: {
          user_id: paymentData.user_id,
          consultation_id: paymentData.consultation_id,
          appointment_id: paymentData.appointment_id || '',
          customer_email: paymentData.customer_email || '',
          customer_name: paymentData.customer_name || ''
        },
        automatic_payment_methods: {
          enabled: true,
        },
        receipt_email: paymentData.customer_email
      });

      // Create payment record in database
      const payment = await Payment.create({
        user_id: paymentData.user_id,
        consultation_id: paymentData.consultation_id,
        appointment_id: paymentData.appointment_id,
        provider: 'stripe',
        provider_payment_id: paymentIntent.id,
        provider_customer_id: paymentData.customer_id,
        amount: paymentData.amount,
        currency: paymentData.currency.toUpperCase(),
        status: 'pending',
        customer_email: paymentData.customer_email,
        customer_name: paymentData.customer_name,
        metadata: {
          stripe_payment_intent_id: paymentIntent.id,
          client_secret: paymentIntent.client_secret
        }
      });

      // Log payment creation event
      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.created',
        event_data: {
          provider: 'stripe',
          payment_intent_id: paymentIntent.id,
          amount: paymentData.amount,
          currency: paymentData.currency
        }
      });

      logger.info(`Stripe PaymentIntent created: ${paymentIntent.id}`);

      return {
        payment,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      };

    } catch (error) {
      logger.error('Error creating Stripe PaymentIntent:', error);
      throw new Error(`Payment creation failed: ${error.message}`);
    }
  }

  static async createCheckoutSession(paymentData) {
    try {
      // Validate input data
      if (!paymentData.price_id) {
        throw new Error('Stripe price ID is required for checkout session');
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [
          {
            price: paymentData.price_id,
            quantity: 1,
          },
        ],
        customer_email: paymentData.customer_email,
        metadata: {
          user_id: paymentData.user_id,
          consultation_id: paymentData.consultation_id,
          appointment_id: paymentData.appointment_id || '',
          customer_name: paymentData.customer_name || ''
        },
        success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        expires_at: Math.floor(Date.now() / 1000) + (30 * 60) // 30 minutes from now
      });

      // Create payment record
      const payment = await Payment.create({
        user_id: paymentData.user_id,
        consultation_id: paymentData.consultation_id,
        appointment_id: paymentData.appointment_id,
        provider: 'stripe',
        provider_payment_id: session.id,
        amount: paymentData.amount,
        currency: paymentData.currency || 'USD',
        status: 'pending',
        customer_email: paymentData.customer_email,
        customer_name: paymentData.customer_name,
        metadata: {
          stripe_session_id: session.id,
          stripe_price_id: paymentData.price_id
        }
      });

      // Log checkout session creation
      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'checkout.session.created',
        event_data: {
          provider: 'stripe',
          session_id: session.id,
          price_id: paymentData.price_id
        }
      });

      logger.info(`Stripe Checkout Session created: ${session.id}`);

      return {
        payment,
        session_id: session.id,
        checkout_url: session.url
      };

    } catch (error) {
      logger.error('Error creating Stripe Checkout Session:', error);
      throw new Error(`Checkout session creation failed: ${error.message}`);
    }
  }

  static async retrievePaymentIntent(paymentIntentId) {
    try {
      const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
      return paymentIntent;
    } catch (error) {
      logger.error(`Error retrieving PaymentIntent ${paymentIntentId}:`, error);
      throw error;
    }
  }

  static async retrieveCheckoutSession(sessionId) {
    try {
      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent']
      });
      return session;
    } catch (error) {
      logger.error(`Error retrieving Checkout Session ${sessionId}:`, error);
      throw error;
    }
  }

  static async handleWebhookEvent(event, signature) {
    try {
      // Verify webhook signature
      const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
      if (webhookSecret) {
        try {
          event = stripe.webhooks.constructEvent(
            event.body || event,
            signature,
            webhookSecret
          );
        } catch (err) {
          logger.error('Webhook signature verification failed:', err.message);
          throw new Error('Webhook signature verification failed');
        }
      }

      logger.info(`Processing Stripe webhook: ${event.type}`);

      switch (event.type) {
        case 'payment_intent.succeeded':
          await this.handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          await this.handlePaymentIntentFailed(event.data.object);
          break;

        case 'checkout.session.completed':
          await this.handleCheckoutSessionCompleted(event.data.object);
          break;

        case 'payment_intent.canceled':
          await this.handlePaymentIntentCanceled(event.data.object);
          break;

        default:
          logger.info(`Unhandled Stripe webhook event: ${event.type}`);
      }

      return { received: true };

    } catch (error) {
      logger.error('Error processing Stripe webhook:', error);
      throw error;
    }
  }

  static async handlePaymentIntentSucceeded(paymentIntent) {
    try {
      const payment = await Payment.findByProviderPaymentId(paymentIntent.id);
      if (!payment) {
        logger.warn(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
        return;
      }

      await payment.updateStatus('succeeded', {
        payment_method: paymentIntent.charges.data[0]?.payment_method_details?.type,
        metadata: {
          ...JSON.parse(payment.metadata || '{}'),
          stripe_charge_id: paymentIntent.charges.data[0]?.id,
          receipt_url: paymentIntent.charges.data[0]?.receipt_url
        }
      });

      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.succeeded',
        event_data: {
          provider: 'stripe',
          payment_intent_id: paymentIntent.id,
          amount_received: paymentIntent.amount_received
        }
      });

      logger.info(`Payment succeeded: ${payment.id}`);

    } catch (error) {
      logger.error('Error handling payment_intent.succeeded:', error);
      throw error;
    }
  }

  static async handlePaymentIntentFailed(paymentIntent) {
    try {
      const payment = await Payment.findByProviderPaymentId(paymentIntent.id);
      if (!payment) {
        logger.warn(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
        return;
      }

      await payment.updateStatus('failed', {
        metadata: {
          ...JSON.parse(payment.metadata || '{}'),
          failure_code: paymentIntent.last_payment_error?.code,
          failure_message: paymentIntent.last_payment_error?.message
        }
      });

      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.failed',
        event_data: {
          provider: 'stripe',
          payment_intent_id: paymentIntent.id,
          error: paymentIntent.last_payment_error
        }
      });

      logger.info(`Payment failed: ${payment.id}`);

    } catch (error) {
      logger.error('Error handling payment_intent.payment_failed:', error);
      throw error;
    }
  }

  static async handleCheckoutSessionCompleted(session) {
    try {
      const payment = await Payment.findByProviderPaymentId(session.id);
      if (!payment) {
        logger.warn(`Payment not found for Checkout Session: ${session.id}`);
        return;
      }

      await payment.updateStatus('succeeded', {
        provider_customer_id: session.customer,
        payment_method: session.payment_method_types?.[0],
        metadata: {
          ...JSON.parse(payment.metadata || '{}'),
          stripe_payment_intent_id: session.payment_intent,
          customer_id: session.customer
        }
      });

      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'checkout.session.completed',
        event_data: {
          provider: 'stripe',
          session_id: session.id,
          payment_intent: session.payment_intent,
          amount_total: session.amount_total
        }
      });

      logger.info(`Checkout session completed: ${payment.id}`);

    } catch (error) {
      logger.error('Error handling checkout.session.completed:', error);
      throw error;
    }
  }

  static async handlePaymentIntentCanceled(paymentIntent) {
    try {
      const payment = await Payment.findByProviderPaymentId(paymentIntent.id);
      if (!payment) {
        logger.warn(`Payment not found for PaymentIntent: ${paymentIntent.id}`);
        return;
      }

      await payment.updateStatus('cancelled');

      await PaymentEvent.create({
        payment_id: payment.id,
        event_type: 'payment.cancelled',
        event_data: {
          provider: 'stripe',
          payment_intent_id: paymentIntent.id
        }
      });

      logger.info(`Payment cancelled: ${payment.id}`);

    } catch (error) {
      logger.error('Error handling payment_intent.canceled:', error);
      throw error;
    }
  }

  static async refundPayment(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refund = await stripe.refunds.create({
        payment_intent: paymentIntentId,
        amount: amount,
        reason: reason
      });

      const payment = await Payment.findByProviderPaymentId(paymentIntentId);
      if (payment) {
        await payment.updateStatus('refunded', {
          metadata: {
            ...JSON.parse(payment.metadata || '{}'),
            refund_id: refund.id,
            refund_amount: refund.amount,
            refund_reason: reason
          }
        });

        await PaymentEvent.create({
          payment_id: payment.id,
          event_type: 'payment.refunded',
          event_data: {
            provider: 'stripe',
            refund_id: refund.id,
            amount: refund.amount,
            reason: reason
          }
        });
      }

      logger.info(`Payment refunded: ${refund.id}`);
      return refund;

    } catch (error) {
      logger.error('Error creating refund:', error);
      throw error;
    }
  }
}

export default StripeService;