import Stripe from 'stripe';
import Payment from '../models/Payment.js';
import logger from '../utils/logger.js';
import { PaymentError } from '../utils/errors.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

class StripeService {
  static async createPaymentIntent({
    amount,
    currency = 'USD',
    user_id,
    consultation_id,
    appointment_id,
    customer_email,
    customer_name,
    customer_id
  }) {
    try {
      // Create or retrieve customer
      let stripeCustomer;
      if (customer_id) {
        stripeCustomer = await stripe.customers.retrieve(customer_id);
      } else {
        stripeCustomer = await stripe.customers.create({
          email: customer_email,
          name: customer_name,
        });
      }

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: Math.round(amount * 100), // Convert to cents
        currency: currency.toLowerCase(),
        customer: stripeCustomer.id,
        metadata: {
          user_id,
          consultation_id,
          appointment_id: appointment_id || '',
          customer_email,
          customer_name
        },
        automatic_payment_methods: {
          enabled: true,
        },
      });

      // Save payment to database
      const payment = await Payment.createPayment({
        provider: 'stripe',
        provider_payment_id: paymentIntent.id,
        provider_customer_id: stripeCustomer.id,
        amount,
        currency: currency.toUpperCase(),
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name,
        status: 'pending',
        metadata: paymentIntent.metadata
      });

      logger.info('Stripe payment intent created', {
        paymentId: payment.id,
        stripeIntentId: paymentIntent.id,
        amount,
        currency
      });

      return {
        payment,
        client_secret: paymentIntent.client_secret,
        payment_intent_id: paymentIntent.id
      };
    } catch (error) {
      logger.error('Error creating Stripe payment intent:', error);
      throw new PaymentError(`Failed to create payment intent: ${error.message}`, 'stripe', error);
    }
  }

  static async createCheckoutSession({
    price_id,
    amount,
    currency = 'USD',
    user_id,
    consultation_id,
    appointment_id,
    customer_email,
    customer_name
  }) {
    try {
      const sessionConfig = {
        payment_method_types: ['card'],
        customer_email,
        mode: 'payment',
        success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/payment/cancel`,
        metadata: {
          user_id,
          consultation_id,
          appointment_id: appointment_id || '',
          customer_email,
          customer_name
        }
      };

      if (price_id) {
        sessionConfig.line_items = [{
          price: price_id,
          quantity: 1,
        }];
      } else {
        sessionConfig.line_items = [{
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: 'Consultation Session',
              description: `Consultation session for ${customer_name}`,
            },
            unit_amount: Math.round(amount * 100), // Convert to cents
          },
          quantity: 1,
        }];
      }

      const session = await stripe.checkout.sessions.create(sessionConfig);

      // Save payment to database
      const payment = await Payment.createPayment({
        provider: 'stripe',
        provider_payment_id: session.id,
        amount: amount || (price_id ? 0 : amount), // Will be updated via webhook
        currency: currency.toUpperCase(),
        user_id,
        consultation_id,
        appointment_id,
        customer_email,
        customer_name,
        status: 'pending',
        metadata: session.metadata
      });

      logger.info('Stripe checkout session created', {
        paymentId: payment.id,
        sessionId: session.id,
        amount,
        currency
      });

      return {
        payment,
        session_id: session.id,
        checkout_url: session.url
      };
    } catch (error) {
      logger.error('Error creating Stripe checkout session:', error);
      throw new PaymentError(`Failed to create checkout session: ${error.message}`, 'stripe', error);
    }
  }

  static async refundPayment(paymentIntentId, amount = null, reason = 'requested_by_customer') {
    try {
      const refundData = {
        payment_intent: paymentIntentId,
        reason
      };

      if (amount) {
        refundData.amount = Math.round(amount * 100); // Convert to cents
      }

      const refund = await stripe.refunds.create(refundData);

      logger.info('Stripe refund processed', {
        refundId: refund.id,
        paymentIntentId,
        amount: refund.amount / 100,
        reason
      });

      return {
        id: refund.id,
        amount: refund.amount / 100,
        status: refund.status,
        reason: refund.reason
      };
    } catch (error) {
      logger.error('Error processing Stripe refund:', error);
      throw new PaymentError(`Failed to process refund: ${error.message}`, 'stripe', error);
    }
  }

  static async handleWebhookEvent(body, signature) {
    try {
      const event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );

      logger.info('Processing Stripe webhook', {
        eventType: event.type,
        eventId: event.id
      });

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
        case 'invoice.payment_succeeded':
          await this.handleInvoicePaymentSucceeded(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.handleInvoicePaymentFailed(event.data.object);
          break;
        default:
          logger.info(`Unhandled Stripe event type: ${event.type}`);
      }

      return {
        success: true,
        message: 'Webhook processed successfully',
        eventType: event.type
      };
    } catch (error) {
      logger.error('Error processing Stripe webhook:', error);
      throw error;
    }
  }

  static async handlePaymentIntentSucceeded(paymentIntent) {
    const payment = Payment.findByProviderPaymentId(paymentIntent.id);
    if (payment) {
      await payment.updateStatus('succeeded', {
        payment_method: paymentIntent.payment_method,
        amount_received: paymentIntent.amount_received / 100
      });
      logger.info('Payment marked as succeeded', { paymentId: payment.id });
    }
  }

  static async handlePaymentIntentFailed(paymentIntent) {
    const payment = Payment.findByProviderPaymentId(paymentIntent.id);
    if (payment) {
      await payment.updateStatus('failed', {
        failure_reason: paymentIntent.last_payment_error?.message
      });
      logger.info('Payment marked as failed', { paymentId: payment.id });
    }
  }

  static async handleCheckoutSessionCompleted(session) {
    const payment = Payment.findByProviderPaymentId(session.id);
    if (payment) {
      await payment.updateStatus('succeeded', {
        payment_status: session.payment_status,
        amount_total: session.amount_total / 100
      });
      logger.info('Checkout session completed', { paymentId: payment.id });
    }
  }

  static async handleInvoicePaymentSucceeded(invoice) {
    // Handle subscription payments if needed
    logger.info('Invoice payment succeeded', { invoiceId: invoice.id });
  }

  static async handleInvoicePaymentFailed(invoice) {
    // Handle subscription payment failures if needed
    logger.info('Invoice payment failed', { invoiceId: invoice.id });
  }
}

export default StripeService;