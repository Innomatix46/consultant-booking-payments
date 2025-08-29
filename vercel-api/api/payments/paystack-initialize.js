import PaystackService from '../../lib/services/paystackService.js';
import { withCors } from '../../lib/middleware/cors.js';
import { withErrorHandling } from '../../lib/utils/errors.js';
import { withRateLimit } from '../../lib/middleware/rateLimiter.js';
import { withValidation, createPaystackPaymentValidation } from '../../lib/utils/validation.js';
import { logRequest, logPaymentEvent } from '../../lib/utils/logger.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  logRequest(req, { action: 'initialize_paystack_payment' });

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

  logPaymentEvent('paystack_payment_initialized', result.payment);

  return res.status(201).json({
    success: true,
    message: 'Payment initialized successfully',
    data: {
      payment_id: result.payment.id,
      authorization_url: result.authorization_url,
      access_code: result.access_code,
      reference: result.reference
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
      createPaystackPaymentValidation,
      withErrorHandling(handler)
    ),
    rateLimitOptions
  )
);