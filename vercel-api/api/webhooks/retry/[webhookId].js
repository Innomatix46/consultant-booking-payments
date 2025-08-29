import StripeService from '../../../lib/services/stripeService.js';
import PaystackService from '../../../lib/services/paystackService.js';
import { withCors } from '../../../lib/middleware/cors.js';
import { withErrorHandling } from '../../../lib/utils/errors.js';
import { withRateLimit } from '../../../lib/middleware/rateLimiter.js';
import { logRequest, logWebhookEvent } from '../../../lib/utils/logger.js';
import { getDatabase } from '../../../lib/database/connection.js';

const handler = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { webhookId } = req.query;

  logRequest(req, { action: 'retry_webhook', webhookId });

  // Get webhook log
  const db = getDatabase();
  const stmt = db.prepare('SELECT * FROM webhook_logs WHERE id = ?');
  const log = stmt.get([webhookId]);

  if (!log) {
    return res.status(404).json({
      success: false,
      message: 'Webhook log not found'
    });
  }

  if (log.processed) {
    return res.status(400).json({
      success: false,
      message: 'Webhook has already been processed successfully'
    });
  }

  const payload = safeJSONParse(log.payload);
  let result;

  try {
    if (log.provider === 'stripe') {
      result = await StripeService.handleWebhookEvent(Buffer.from(log.payload), log.signature);
    } else if (log.provider === 'paystack') {
      result = await PaystackService.handleWebhookEvent(payload, log.signature);
    } else {
      return res.status(400).json({
        success: false,
        message: 'Unsupported webhook provider'
      });
    }

    // Update webhook log as processed
    await updateWebhookLog(webhookId, true, null);

    logWebhookEvent(log.provider, payload, true);

    return res.status(200).json({
      success: true,
      message: 'Webhook retried successfully',
      data: result
    });

  } catch (error) {
    console.error('Error retrying webhook:', error);
    
    // Update webhook log with new error
    await updateWebhookLog(webhookId, false, error.message);

    logWebhookEvent(log.provider, payload, false, error);

    return res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

const safeJSONParse = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn('Failed to parse JSON:', jsonString);
    return jsonString;
  }
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

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: 'Too many webhook retry requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withErrorHandling(handler),
    rateLimitOptions
  )
);