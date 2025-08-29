import { withCors } from '../../lib/middleware/cors.js';
import { withErrorHandling } from '../../lib/utils/errors.js';
import { withRateLimit } from '../../lib/middleware/rateLimiter.js';
import { logRequest } from '../../lib/utils/logger.js';
import { getDatabase } from '../../lib/database/connection.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  const { startDate, endDate } = req.query;

  logRequest(req, { action: 'get_webhook_stats', startDate, endDate });

  const db = getDatabase();
  let query = `
    SELECT 
      provider,
      event_type,
      processed,
      COUNT(*) as count,
      DATE(created_at) as date
    FROM webhook_logs
    WHERE 1=1
  `;
  const params = [];

  if (startDate) {
    query += ' AND created_at >= ?';
    params.push(startDate);
  }

  if (endDate) {
    query += ' AND created_at <= ?';
    params.push(endDate);
  }

  query += ' GROUP BY provider, event_type, processed, DATE(created_at) ORDER BY date DESC';

  const stmt = db.prepare(query);
  const stats = stmt.all(params);

  // Organize stats by provider
  const organizedStats = stats.reduce((acc, stat) => {
    if (!acc[stat.provider]) {
      acc[stat.provider] = {};
    }
    if (!acc[stat.provider][stat.event_type]) {
      acc[stat.provider][stat.event_type] = {
        processed: 0,
        failed: 0,
        total: 0
      };
    }

    if (stat.processed) {
      acc[stat.provider][stat.event_type].processed += stat.count;
    } else {
      acc[stat.provider][stat.event_type].failed += stat.count;
    }
    acc[stat.provider][stat.event_type].total += stat.count;

    return acc;
  }, {});

  return res.status(200).json({
    success: true,
    message: 'Webhook statistics retrieved successfully',
    data: {
      stats: organizedStats,
      period: { startDate, endDate }
    }
  });
};

const rateLimitOptions = {
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: 'Too many webhook stats requests from this IP, please try again later.'
};

export default withCors(
  withRateLimit(
    withErrorHandling(handler),
    rateLimitOptions
  )
);