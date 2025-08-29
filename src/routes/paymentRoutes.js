import express from 'express';
import { body } from 'express-validator';
import PaymentController from '../controllers/paymentController.js';
import authMiddleware from '../middleware/authMiddleware.js';
import adminMiddleware from '../middleware/adminMiddleware.js';

const router = express.Router();

// Validation rules
const stripePaymentIntentValidation = [
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer in cents'),
  body('currency').isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code'),
  body('user_id').isUUID().withMessage('User ID must be a valid UUID'),
  body('consultation_id').isUUID().withMessage('Consultation ID must be a valid UUID'),
  body('customer_email').isEmail().withMessage('Valid email is required'),
  body('customer_name').optional().isLength({ min: 1, max: 100 }).withMessage('Customer name must be 1-100 characters'),
  body('appointment_id').optional().isUUID().withMessage('Appointment ID must be a valid UUID'),
  body('customer_id').optional().isString().withMessage('Customer ID must be a string')
];

const stripeCheckoutValidation = [
  body('price_id').isString().withMessage('Stripe price ID is required'),
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer in cents'),
  body('currency').optional().isLength({ min: 3, max: 3 }).withMessage('Currency must be a 3-letter ISO code'),
  body('user_id').isUUID().withMessage('User ID must be a valid UUID'),
  body('consultation_id').isUUID().withMessage('Consultation ID must be a valid UUID'),
  body('customer_email').isEmail().withMessage('Valid email is required'),
  body('customer_name').optional().isLength({ min: 1, max: 100 }).withMessage('Customer name must be 1-100 characters'),
  body('appointment_id').optional().isUUID().withMessage('Appointment ID must be a valid UUID')
];

const paystackPaymentValidation = [
  body('amount').isInt({ min: 1 }).withMessage('Amount must be a positive integer in kobo (for NGN) or cents'),
  body('currency').optional().isIn(['NGN', 'USD', 'GHS', 'ZAR', 'KES']).withMessage('Invalid currency for Paystack'),
  body('user_id').isUUID().withMessage('User ID must be a valid UUID'),
  body('consultation_id').isUUID().withMessage('Consultation ID must be a valid UUID'),
  body('customer_email').isEmail().withMessage('Valid email is required'),
  body('customer_name').optional().isLength({ min: 1, max: 100 }).withMessage('Customer name must be 1-100 characters'),
  body('appointment_id').optional().isUUID().withMessage('Appointment ID must be a valid UUID')
];

const refundValidation = [
  body('amount').optional().isFloat({ min: 0 }).withMessage('Refund amount must be a positive number'),
  body('reason').optional().isLength({ min: 1, max: 200 }).withMessage('Reason must be 1-200 characters')
];

// Stripe payment routes
router.post(
  '/stripe/payment-intent',
  stripePaymentIntentValidation,
  PaymentController.createStripePaymentIntent
);

router.post(
  '/stripe/checkout-session',
  stripeCheckoutValidation,
  PaymentController.createStripeCheckoutSession
);

// Paystack payment routes
router.post(
  '/paystack/initialize',
  paystackPaymentValidation,
  PaymentController.initializePaystackPayment
);

router.get(
  '/paystack/verify/:reference',
  PaymentController.verifyPaystackPayment
);

// General payment routes
router.get(
  '/status/:paymentId',
  PaymentController.getPaymentStatus
);

router.get(
  '/user/:userId',
  PaymentController.getUserPayments
);

router.post(
  '/refund/:paymentId',
  refundValidation,
  PaymentController.refundPayment
);

router.post(
  '/cancel/:paymentId',
  PaymentController.cancelPayment
);

// Admin routes (require admin authentication)
router.get(
  '/admin/stats',
  adminMiddleware,
  PaymentController.getPaymentStats
);

// Health check for payment services
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Payment service is healthy',
    timestamp: new Date().toISOString(),
    services: {
      stripe: !!process.env.STRIPE_SECRET_KEY,
      paystack: !!process.env.PAYSTACK_SECRET_KEY
    }
  });
});

export default router;