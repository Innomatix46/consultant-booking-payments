// Vercel Serverless Function for Payment Processing
import { createConnection } from '../../src/database/database.js';
import { StripeProvider } from '../../src/providers/stripe-provider.js';
import { PaystackProvider } from '../../src/providers/paystack-provider.js';
import { validatePaymentData } from '../../src/utils/validation.js';
import { rateLimiter } from '../middleware/rateLimiter.js';

// Environment variables validation
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'PAYSTACK_SECRET_KEY',
  'DATABASE_URL',
  'JWT_SECRET'
];

function validateEnvironment() {
  const missing = requiredEnvVars.filter(key => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
}

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGINS || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // Validate environment
    validateEnvironment();

    // Apply rate limiting
    const rateLimitResult = await rateLimiter(req, res);
    if (rateLimitResult.blocked) {
      return res.status(429).json({ 
        error: 'Too many requests', 
        retryAfter: rateLimitResult.retryAfter 
      });
    }

    // Initialize database connection
    const db = await createConnection(process.env.DATABASE_URL);

    switch (req.method) {
      case 'POST':
        return await handlePaymentCreation(req, res, db);
      case 'GET':
        return await handlePaymentRetrieval(req, res, db);
      default:
        return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error) {
    console.error('Payment API Error:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

async function handlePaymentCreation(req, res, db) {
  const { provider, amount, currency, appointmentId, metadata } = req.body;

  // Validate input data
  const validation = validatePaymentData(req.body);
  if (!validation.isValid) {
    return res.status(400).json({ 
      error: 'Validation failed', 
      details: validation.errors 
    });
  }

  let paymentProvider;
  switch (provider) {
    case 'stripe':
      paymentProvider = new StripeProvider({
        secretKey: process.env.STRIPE_SECRET_KEY,
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET
      });
      break;
    case 'paystack':
      paymentProvider = new PaystackProvider({
        secretKey: process.env.PAYSTACK_SECRET_KEY,
        webhookSecret: process.env.PAYSTACK_WEBHOOK_SECRET
      });
      break;
    default:
      return res.status(400).json({ error: 'Invalid payment provider' });
  }

  try {
    const payment = await paymentProvider.createPayment({
      amount,
      currency,
      metadata: {
        appointmentId,
        ...metadata
      },
      successUrl: `${process.env.FRONTEND_URL}/payment/success`,
      cancelUrl: `${process.env.FRONTEND_URL}/payment/cancel`
    });

    // Store payment in database
    await db.run(
      `INSERT INTO payments (id, provider, amount, currency, status, appointment_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [payment.id, provider, amount, currency, payment.status, appointmentId, new Date().toISOString()]
    );

    return res.status(201).json({
      success: true,
      payment: {
        id: payment.id,
        url: payment.url,
        status: payment.status
      }
    });
  } catch (error) {
    console.error('Payment creation error:', error);
    return res.status(500).json({ 
      error: 'Failed to create payment',
      message: error.message
    });
  }
}

async function handlePaymentRetrieval(req, res, db) {
  const { id } = req.query;

  if (!id) {
    return res.status(400).json({ error: 'Payment ID required' });
  }

  try {
    const payment = await db.get(
      'SELECT * FROM payments WHERE id = ?',
      [id]
    );

    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    return res.status(200).json({
      success: true,
      payment
    });
  } catch (error) {
    console.error('Payment retrieval error:', error);
    return res.status(500).json({ 
      error: 'Failed to retrieve payment'
    });
  }
}