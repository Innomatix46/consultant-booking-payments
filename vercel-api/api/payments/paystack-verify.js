import PaystackService from '../../lib/services/paystackService.js';
import { withCors } from '../../lib/middleware/cors.js';
import { withErrorHandling } from '../../lib/utils/errors.js';
import { withRateLimit } from '../../lib/middleware/rateLimiter.js';
import { logRequest, logPaymentEvent } from '../../lib/utils/logger.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { reference } = req.query;

  if (!reference) {
    return res.status(400).json({
      success: false,
      message: 'Payment reference is required'
    });
  }

  logRequest(req, { action: 'verify_paystack_payment', reference });

  const result = await PaystackService.verifyPayment(reference);

  if (!result) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  logPaymentEvent('paystack_payment_verified', result.payment);

  return res.status(200).json({
    success: true,
    message: 'Payment verified successfully',
    data: {
      payment: result.payment.toJSON(),
      transaction_data: result.transaction_data
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many verification requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withErrorHandling(handler),
    rateLimitOptions
  )
);