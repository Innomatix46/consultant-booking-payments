// Vercel Serverless Function for Paystack Webhooks
import crypto from 'crypto';
import { createConnection } from '../../../src/database/database.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const hash = crypto
    .createHmac('sha512', process.env.PAYSTACK_WEBHOOK_SECRET)
    .update(JSON.stringify(req.body))
    .digest('hex');

  if (hash !== req.headers['x-paystack-signature']) {
    console.error('Invalid Paystack webhook signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  try {
    const db = await createConnection(process.env.DATABASE_URL);
    const event = req.body;

    switch (event.event) {
      case 'charge.success':
        await handlePaymentSuccess(event.data, db);
        break;
      case 'charge.failed':
        await handlePaymentFailure(event.data, db);
        break;
      case 'charge.cancelled':
        await handlePaymentCanceled(event.data, db);
        break;
      default:
        console.log(`Unhandled Paystack event: ${event.event}`);
    }

    // Log webhook event
    await db.run(
      `INSERT INTO payment_events (payment_id, event_type, event_data, processed_at)
       VALUES (?, ?, ?, ?)`,
      [
        event.data.reference,
        event.event,
        JSON.stringify(event.data),
        new Date().toISOString()
      ]
    );

    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Paystack webhook processing error:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
}

async function handlePaymentSuccess(charge, db) {
  await db.run(
    `UPDATE payments 
     SET status = 'completed', updated_at = ? 
     WHERE id = ?`,
    [new Date().toISOString(), charge.reference]
  );

  // Update appointment status
  const payment = await db.get('SELECT appointment_id FROM payments WHERE id = ?', [charge.reference]);
  if (payment) {
    await db.run(
      `UPDATE appointments 
       SET status = 'confirmed', payment_status = 'paid' 
       WHERE id = ?`,
      [payment.appointment_id]
    );
  }
}

async function handlePaymentFailure(charge, db) {
  await db.run(
    `UPDATE payments 
     SET status = 'failed', updated_at = ? 
     WHERE id = ?`,
    [new Date().toISOString(), charge.reference]
  );
}

async function handlePaymentCanceled(charge, db) {
  await db.run(
    `UPDATE payments 
     SET status = 'canceled', updated_at = ? 
     WHERE id = ?`,
    [new Date().toISOString(), charge.reference]
  );
}