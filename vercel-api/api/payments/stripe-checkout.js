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

  logRequest(req, { action: 'create_stripe_checkout_session' });

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

  logPaymentEvent('stripe_checkout_session_created', result.payment);

  return res.status(201).json({
    success: true,
    message: 'Checkout session created successfully',
    data: {
      payment_id: result.payment.id,
      session_id: result.session_id,
      checkout_url: result.checkout_url
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