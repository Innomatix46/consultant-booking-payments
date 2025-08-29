import Payment from '../../../lib/models/Payment.js';
import { withCors } from '../../../lib/middleware/cors.js';
import { withErrorHandling } from '../../../lib/utils/errors.js';
import { withRateLimit } from '../../../lib/middleware/rateLimiter.js';
import { logRequest, logPaymentEvent } from '../../../lib/utils/logger.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { paymentId } = req.query;

  logRequest(req, { action: 'cancel_payment', paymentId });

  const payment = Payment.findById(paymentId);
  
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

  await payment.updateStatus('cancelled', {
    cancelled_at: new Date().toISOString(),
    cancellation_reason: 'user_request'
  });

  logPaymentEvent('payment_cancelled', payment);

  return res.status(200).json({
    success: true,
    message: 'Payment cancelled successfully',
    data: {
      payment: payment.toJSON()
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: 'Too many cancellation requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withErrorHandling(handler),
    rateLimitOptions
  )
);