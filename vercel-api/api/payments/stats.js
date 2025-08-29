import Payment from '../../lib/models/Payment.js';
import { withCors } from '../../lib/middleware/cors.js';
import { withErrorHandling } from '../../lib/utils/errors.js';
import { withRateLimit } from '../../lib/middleware/rateLimiter.js';
import { withValidation, paymentStatsValidation } from '../../lib/utils/validation.js';
import { logRequest } from '../../lib/utils/logger.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { startDate, endDate } = req.query;

  logRequest(req, { action: 'get_payment_stats', startDate, endDate });

  const stats = Payment.getPaymentStats(startDate, endDate);

  // Organize stats by provider and status
  const organizedStats = stats.reduce((acc, stat) => {
    if (!acc[stat.provider]) {
      acc[stat.provider] = {};
    }
    acc[stat.provider][stat.status] = {
      count: stat.count,
      total_amount: stat.total_amount,
      avg_amount: stat.avg_amount,
      currency: stat.currency
    };
    return acc;
  }, {});

  return res.status(200).json({
    success: true,
    message: 'Payment statistics retrieved successfully',
    data: {
      stats: organizedStats,
      period: { startDate, endDate }
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many stats requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withValidation(
      paymentStatsValidation,
      withErrorHandling(handler)
    ),
    rateLimitOptions
  )
);