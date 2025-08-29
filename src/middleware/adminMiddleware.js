import { ApiError } from './errorHandler.js';
import logger from '../utils/logger.js';

const adminMiddleware = (req, res, next) => {
  try {
    // Check if user is authenticated
    if (!req.user) {
      return next(new ApiError(401, 'Authentication required'));
    }

    // Check if user has admin role
    if (!req.user.role || req.user.role !== 'admin') {
      logger.warn('Admin access denied', {
        userId: req.user.id,
        email: req.user.email,
        role: req.user.role,
        url: req.originalUrl,
        ip: req.ip
      });

      return next(new ApiError(403, 'Admin access required'));
    }

    logger.info('Admin access granted', {
      userId: req.user.id,
      email: req.user.email,
      url: req.originalUrl
    });

    next();
  } catch (error) {
    logger.error('Admin middleware error', {
      error: error.message,
      url: req.originalUrl,
      ip: req.ip
    });

    return next(new ApiError(500, 'Authorization check failed'));
  }
};

export default adminMiddleware;