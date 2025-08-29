import { withCors } from '../../lib/middleware/cors.js';
import { withErrorHandling } from '../../lib/utils/errors.js';
import { withRateLimit } from '../../lib/middleware/rateLimiter.js';
import { withValidation, webhookLogsValidation } from '../../lib/utils/validation.js';
import { logRequest } from '../../lib/utils/logger.js';
import { getDatabase } from '../../lib/database/connection.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const {
    provider,
    processed,
    limit = 50,
    offset = 0,
    startDate,
    endDate
  } = req.query;

  logRequest(req, { action: 'get_webhook_logs', provider, processed });

  const db = getDatabase();
  let query = 'SELECT * FROM webhook_logs WHERE 1=1';
  const params = [];

  if (provider) {
    query += ' AND provider = ?';
    params.push(provider);
  }

  if (processed !== undefined) {
    query += ' AND processed = ?';
    params.push(processed === 'true');
  }

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(limit), parseInt(offset));

  const stmt = db.prepare(query);
  const logs = stmt.all(params);

  // Parse payload JSON for each log
  const formattedLogs = logs.map(log => ({
    ...log,
    payload: safeJSONParse(log.payload)
  }));

  return res.status(200).json({
    success: true,
    message: 'Webhook logs retrieved successfully',
    data: {
      logs: formattedLogs,
      pagination: {
        limit: parseInt(limit),
        offset: parseInt(offset),
        total: formattedLogs.length
      }
    }
  });
};

const safeJSONParse = (jsonString) => {
  try {
    return JSON.parse(jsonString);
  } catch (e) {
    console.warn('Failed to parse JSON:', jsonString);
    return jsonString;
  }
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: 'Too many webhook log requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withValidation(
      webhookLogsValidation,
      withErrorHandling(handler)
    ),
    rateLimitOptions
  )
);