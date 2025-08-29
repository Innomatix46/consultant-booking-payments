import { withCors } from '../lib/middleware/cors.js';
import { withErrorHandling } from '../lib/utils/errors.js';

const handler = async (req, res) => {
  if (req.method !== 'GET') {
    return res.status(405).json({
      success: false,
      message: 'Method not allowed'
    });
  }

  return res.status(200).json({
    success: true,
    message: 'API is healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development',
    version: '1.0.0'
  });
};

export default withCors(withErrorHandling(handler));