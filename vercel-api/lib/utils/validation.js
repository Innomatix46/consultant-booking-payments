import { body, param, query, validationResult } from 'express-validator';
import { ValidationError } from './errors.js';

export const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    throw new ValidationError('Validation failed', errors.array());
  }
  next();
};

// Payment validation rules
export const createStripePaymentValidation = [
  body('amount')
    .isInt({ min: 50 }) // Minimum $0.50
    .withMessage('Amount must be at least 50 cents'),
  body('currency')
    .optional()
    .isIn(['USD', 'EUR', 'GBP'])
    .withMessage('Currency must be USD, EUR, or GBP'),
  body('user_id')
    .notEmpty()
    .withMessage('User ID is required'),
  body('consultation_id')
    .notEmpty()
    .withMessage('Consultation ID is required'),
  body('customer_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('customer_name')
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Customer name is required')
];

export const createPaystackPaymentValidation = [
  body('amount')
    .isInt({ min: 100 }) // Minimum 1 NGN
    .withMessage('Amount must be at least 100 kobo (1 NGN)'),
  body('currency')
    .optional()
    .isIn(['NGN', 'USD', 'GHS'])
    .withMessage('Currency must be NGN, USD, or GHS'),
  body('user_id')
    .notEmpty()
    .withMessage('User ID is required'),
  body('consultation_id')
    .notEmpty()
    .withMessage('Consultation ID is required'),
  body('customer_email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('customer_name')
    .notEmpty()
    .trim()
    .escape()
    .withMessage('Customer name is required')
];

export const paymentStatsValidation = [
  query('startDate')
    .notEmpty()
    .isISO8601()
    .withMessage('Valid start date is required'),
  query('endDate')
    .notEmpty()
    .isISO8601()
    .withMessage('Valid end date is required')
    .custom((value, { req }) => {
      if (new Date(value) <= new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    })
];

export const refundValidation = [
  param('paymentId')
    .notEmpty()
    .withMessage('Payment ID is required'),
  body('amount')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Refund amount must be at least 1 cent/kobo'),
  body('reason')
    .optional()
    .isIn(['duplicate', 'fraudulent', 'requested_by_customer'])
    .withMessage('Invalid refund reason')
];

export const webhookLogsValidation = [
  query('provider')
    .optional()
    .isIn(['stripe', 'paystack'])
    .withMessage('Provider must be stripe or paystack'),
  query('processed')
    .optional()
    .isBoolean()
    .withMessage('Processed must be a boolean'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  query('offset')
    .optional()
    .isInt({ min: 0 })
    .withMessage('Offset must be a positive integer')
];

// Serverless validation wrapper
export const withValidation = (validations, handler) => {
  return async (req, res) => {
    // Run validations
    await Promise.all(validations.map(validation => validation.run(req)));
    
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation errors',
        errors: errors.array()
      });
    }
    
    return handler(req, res);
  };
};

// Sanitize input data
export const sanitizePaymentData = (data) => {
  return {
    amount: parseInt(data.amount),
    currency: (data.currency || 'USD').toUpperCase(),
    user_id: String(data.user_id).trim(),
    consultation_id: String(data.consultation_id).trim(),
    appointment_id: data.appointment_id ? String(data.appointment_id).trim() : null,
    customer_email: String(data.customer_email).toLowerCase().trim(),
    customer_name: String(data.customer_name).trim(),
    customer_id: data.customer_id ? String(data.customer_id).trim() : null
  };
};