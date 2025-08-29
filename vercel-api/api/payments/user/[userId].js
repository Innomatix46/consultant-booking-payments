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

  const { userId } = req.query;
  const { limit = 10, offset = 0 } = req.query;

  logRequest(req, { action: 'get_user_payments', userId });

  const payments = Payment.findByUserId(userId, parseInt(limit), parseInt(offset));

  return res.status(200).json({
    success: true,
    message: 'User payments retrieved successfully',
    data: {
      payments: payments.map(payment => payment.toJSON()),
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: payments.length
      }
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withErrorHandling(handler),
    rateLimitOptions
  )
);