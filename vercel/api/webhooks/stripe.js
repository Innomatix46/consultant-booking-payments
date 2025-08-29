// Vercel Serverless Function for Stripe Webhooks
import Stripe from 'stripe';
import { createConnection } from '../../../src/database/database.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    // Verify webhook signature
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const db = await createConnection(process.env.DATABASE_URL);
    
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSuccess(event.data.object, db);
        break;
      case 'payment_intent.payment_failed':
        await handlePaymentFailure(event.data.object, db);
        break;
      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object, db);
        break;
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    // Log webhook event
    await db.run(
      `INSERT INTO payment_events (payment_id, event_type, event_data, processed_at)
       VALUES (?, ?, ?, ?)`,
      [
        event.data.object.id,
        event.type,
        JSON.stringify(event.data.object),
        new Date().toISOString()
      ]
    );

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handlePaymentSuccess(paymentIntent, db) {
  await db.run(
    `UPDATE payments 
     SET status = 'completed', updated_at = ? 
     WHERE id = ?`,
    [new Date().toISOString(), paymentIntent.id]
  );

  // Update appointment status
  const payment = await db.get('SELECT appointment_id FROM payments WHERE id = ?', [paymentIntent.id]);
  if (payment) {
    await db.run(
      `UPDATE appointments 
       SET status = 'confirmed', payment_status = 'paid' 
       WHERE id = ?`,
      [payment.appointment_id]
    );
  }
}

async function handlePaymentFailure(paymentIntent, db) {
  await db.run(
    `UPDATE payments 
     SET status = 'failed', updated_at = ? 
     WHERE id = ?`,
    [new Date().toISOString(), paymentIntent.id]
  );
}

async function handlePaymentCanceled(paymentIntent, db) {
  await db.run(
    `UPDATE payments 
     SET status = 'canceled', updated_at = ? 
     WHERE id = ?`,
    [new Date().toISOString(), paymentIntent.id]
  );
}