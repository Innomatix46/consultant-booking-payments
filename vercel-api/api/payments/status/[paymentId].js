import Payment from '../../../lib/models/Payment.js';
import { withCors } from '../../../lib/middleware/cors.js';
import { withErrorHandling } from '../../../lib/utils/errors.js';
import { withRateLimit } from '../../../lib/middleware/rateLimiter.js';
import { logRequest } from '../../../lib/utils/logger.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { paymentId } = req.query;

  logRequest(req, { action: 'get_payment_status', paymentId });

  const payment = Payment.findById(paymentId);
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Payment status retrieved successfully',
    data: {
      payment: payment.toJSON()
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many status requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withErrorHandling(handler),
    rateLimitOptions
  )
);