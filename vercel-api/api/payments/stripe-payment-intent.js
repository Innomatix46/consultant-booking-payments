import StripeService from '../../lib/services/stripeService.js';
import { withCors } from '../../lib/middleware/cors.js';
import { withErrorHandling } from '../../lib/utils/errors.js';
import { withRateLimit } from '../../lib/middleware/rateLimiter.js';
import { withValidation, createStripePaymentValidation } from '../../lib/utils/validation.js';
import { logRequest, logPaymentEvent } from '../../lib/utils/logger.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  logRequest(req, { action: 'create_stripe_payment_intent' });

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

  logPaymentEvent('stripe_payment_intent_created', result.payment);

  return res.status(201).json({
    success: true,
    message: 'Payment intent created successfully',
    data: {
      payment_id: result.payment.id,
      client_secret: result.client_secret,
      payment_intent_id: result.payment_intent_id
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many payment requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withValidation(
      createStripePaymentValidation,
      withErrorHandling(handler)
    ),
    rateLimitOptions
  )
);