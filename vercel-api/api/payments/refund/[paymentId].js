import Payment from '../../../lib/models/Payment.js';
import StripeService from '../../../lib/services/stripeService.js';
import PaystackService from '../../../lib/services/paystackService.js';
import { withCors } from '../../../lib/middleware/cors.js';
import { withErrorHandling } from '../../../lib/utils/errors.js';
import { withRateLimit } from '../../../lib/middleware/rateLimiter.js';
import { withValidation, refundValidation } from '../../../lib/utils/validation.js';
import { logRequest, logPaymentEvent } from '../../../lib/utils/logger.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { paymentId } = req.query;
  const { amount, reason = 'requested_by_customer' } = req.body;

  logRequest(req, { action: 'refund_payment', paymentId, amount, reason });

  const payment = Payment.findById(paymentId);
  
  if (!payment) {
    return res.status(404).json({
      success: false,
      message: 'Payment not found'
    });
  }

  if (payment.status !== 'succeeded') {
    return res.status(400).json({
      success: false,
      message: 'Payment must be successful to process refund'
    });
  }

  let refundResult;

  if (payment.provider === 'stripe') {
    refundResult = await StripeService.refundPayment(
      payment.provider_payment_id,
      amount ? amount : null,
      reason
    );
  } else if (payment.provider === 'paystack') {
    refundResult = await PaystackService.refundPayment(
      payment.provider_payment_id,
      amount ? amount : null,
      reason
    );
  } else {
    return res.status(400).json({
      success: false,
      message: 'Unsupported payment provider for refunds'
    });
  }

  // Update payment status
  await payment.updateStatus('refunded', {
    refund_id: refundResult.id,
    refund_amount: refundResult.amount,
    refund_reason: reason,
    refunded_at: new Date().toISOString()
  });

  logPaymentEvent('payment_refunded', payment);

  return res.status(200).json({
    success: true,
    message: 'Refund processed successfully',
    data: {
      refund: refundResult,
      payment_id: payment.id
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many refund requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withValidation(
      refundValidation,
      withErrorHandling(handler)
    ),
    rateLimitOptions
  )
);