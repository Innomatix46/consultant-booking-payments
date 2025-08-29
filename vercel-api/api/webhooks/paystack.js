import PaystackService from '../../lib/services/paystackService.js';
import { withCors } from '../../lib/middleware/cors.js';
import { withErrorHandling } from '../../lib/utils/errors.js';
import { logWebhookEvent } from '../../lib/utils/logger.js';
import { getDatabase } from '../../lib/database/connection.js';
import { v4 as uuidv4 } from 'uuid';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const signature = req.headers['x-paystack-signature'];
  let eventBody;

  // Handle raw body for webhook verification
  if (Buffer.isBuffer(req.body)) {
    eventBody = req.body;
  } else if (typeof req.body === 'string') {
    eventBody = Buffer.from(req.body);
  } else {
    eventBody = req.body;
  }

  let webhookLogId = uuidv4();

  try {
    // Parse the body for logging
    const parsedBody = typeof eventBody === 'string' ? JSON.parse(eventBody) : eventBody;

    // Log incoming webhook
    await logWebhook({
      id: webhookLogId,
      provider: 'paystack',
      event_type: parsedBody.event || 'unknown',
      event_id: parsedBody.data?.id || parsedBody.data?.reference || 'unknown',
      payload: Buffer.isBuffer(eventBody) ? eventBody.toString() : JSON.stringify(eventBody),
      signature: signature
    });

    // Process the webhook
    const result = await PaystackService.handleWebhookEvent(eventBody, signature);

    // Update webhook log as processed
    await updateWebhookLog(webhookLogId, true, null);

    logWebhookEvent('paystack', parsedBody, true);

    return res.status(200).json({
      success: true,
      message: 'Webhook processed successfully',
      eventType: result.eventType
    });

  } catch (error) {
    console.error('Error processing Paystack webhook:', error);
    
    // Update webhook log with error
    await updateWebhookLog(webhookLogId, false, error.message);

    logWebhookEvent('paystack', { event: 'error' }, false, error);

    return res.status(400).json({
      success: false,
      message: error.message
    });
  }
};

// Helper functions
const logWebhook = async (webhookData) => {
  const db = getDatabase();
  const stmt = db.prepare(`
    INSERT INTO webhook_logs (
      id, provider, event_type, event_id, payload, signature, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  stmt.run([
    webhookData.id,
    webhookData.provider,
    webhookData.event_type,
    webhookData.event_id,
    webhookData.payload,
    webhookData.signature,
    new Date().toISOString()
  ]);
};

const updateWebhookLog = async (webhookId, processed, errorMessage = null) => {
  const db = getDatabase();
  const stmt = db.prepare(`
    UPDATE webhook_logs 
    SET processed = ?, error_message = ?
    WHERE id = ?
  `);

  stmt.run([processed, errorMessage, webhookId]);
};

export default withCors(withErrorHandling(handler));

// Vercel configuration for raw body parsing
export const config = {
  api: {
    bodyParser: false,
  },
};